import { parseBuffer } from 'music-metadata';
import { ExtractDurationOptions, ExtractDurationResult } from './types.js';
import { InvalidUrlError, NetworkError, TimeoutError } from './errors.js';

const DEFAULT_HEAD_BYTES = 1024 * 1024; // 1 MB
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Container types music-metadata can extract duration from via the file head.
 * Modern web-streamed mp4/m4a/quicktime almost always have `moov` at the front
 * (fast-start), webm Segment Info sits near the start, mp3 has CBR/Xing
 * headers in the first frames, and ogg has codec setup at the start.
 *
 * mp4 with `moov` at the end is the one tricky case — covered by the
 * `tailBytes` strategy below.
 */
const HEAD_PARSEABLE_CONTENT_TYPES: ReadonlyArray<RegExp> = [
  /^video\/(mp4|webm|quicktime|x-m4v)$/i,
  /^audio\/(mp4|mpeg|mp3|m4a|x-m4a|webm|ogg|opus|flac)$/i,
];

function isHeadParseable(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return HEAD_PARSEABLE_CONTENT_TYPES.some((re) => re.test(contentType));
}

function isMp4Family(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return /^(video|audio)\/(mp4|quicktime|x-m4v|x-m4a|m4a)$/i.test(contentType);
}

interface RangeFetchResult {
  buffer: Buffer;
  totalSize: number | null;
}

async function fetchRange(
  url: string,
  start: number,
  end: number,
  options: {
    fetch: typeof fetch;
    headers: Record<string, string>;
    timeout: number;
    followRedirects: boolean;
  }
): Promise<RangeFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout);

  try {
    const response = await options.fetch(url, {
      method: 'GET',
      headers: {
        ...options.headers,
        Range: `bytes=${start}-${end}`,
      },
      signal: controller.signal,
      redirect: options.followRedirects ? 'follow' : 'manual',
    });

    if (!response.ok && response.status !== 206) {
      throw new NetworkError(
        `Range request failed with status ${response.status}`,
        response.status
      );
    }

    // Total size from Content-Range "bytes start-end/total", fall back to
    // Content-Length when the server returned 200 instead of 206.
    let totalSize: number | null = null;
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)\s*$/);
      if (match) totalSize = parseInt(match[1], 10);
    }
    if (totalSize === null) {
      const contentLength = response.headers.get('content-length');
      if (contentLength) totalSize = parseInt(contentLength, 10);
    }

    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), totalSize };
  } catch (error: any) {
    if (error.name === 'AbortError') throw new TimeoutError(options.timeout);
    if (error instanceof NetworkError) throw error;
    throw new NetworkError(error.message || 'Range request failed');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract duration (and related codec metadata) from a remote media URL
 * by Range-fetching the file header and parsing it with `music-metadata`.
 *
 * Designed as a cheap last-resort duration source for callers that already
 * know the upstream API didn't return one (e.g. a Whisper response with no
 * `duration` field and no word timestamps). Never throws — failures
 * (network, parse, unrecognized format) return `{duration: null, method: null}`
 * so the caller can fall back to whatever heuristic it prefers.
 *
 * Strategy:
 *  1. `bytes=0-headBytes`. Works for fast-start mp4, webm, mp3, m4a, ogg.
 *  2. If still no duration and content is mp4-family and the total size is
 *     known: `bytes=(size-tailBytes)-(size-1)` to catch moov-at-end mp4.
 *
 * @example
 * ```ts
 * const probe = await probeMedia(url, { fetch });
 * const { duration } = await extractMediaDuration(url, {
 *   fetch,
 *   contentType: probe.contentType,
 *   fileSize: probe.size,
 * });
 * if (duration) bill(duration);
 * ```
 */
export async function extractMediaDuration(
  url: string,
  options: ExtractDurationOptions = {}
): Promise<ExtractDurationResult> {
  try {
    new URL(url);
  } catch {
    throw new InvalidUrlError(url);
  }

  const fetchFn = options.fetch ?? globalThis.fetch;
  const headers = options.headers ?? {};
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const followRedirects = options.followRedirects ?? true;
  const headBytes = options.headBytes ?? DEFAULT_HEAD_BYTES;
  const tailBytes = options.tailBytes ?? 512 * 1024;
  const contentTypeHint = options.contentType ?? null;
  const fileSizeHint = options.fileSize ?? null;

  // Bail early on content types music-metadata can't read at all — saves a
  // 1 MB network round-trip that we'd just throw away.
  if (contentTypeHint && !isHeadParseable(contentTypeHint)) {
    return emptyResult();
  }

  const fetchOptions = { fetch: fetchFn, headers, timeout, followRedirects };

  // Strategy 1: head Range
  let totalSize = fileSizeHint;
  try {
    const head = await fetchRange(url, 0, headBytes - 1, fetchOptions);
    if (head.totalSize !== null) totalSize = head.totalSize;

    const headMetadata = await parseBuffer(head.buffer, contentTypeHint ?? undefined, {
      duration: true,
    }).catch(() => null);

    if (headMetadata?.format.duration && headMetadata.format.duration > 0) {
      return {
        duration: headMetadata.format.duration,
        container: headMetadata.format.container ?? null,
        codec: headMetadata.format.codec ?? null,
        bitrate: headMetadata.format.bitrate ?? null,
        method: 'head',
      };
    }

    // Strategy 2: head + tail Range for mp4-family with moov-at-end.
    // Only attempt when:
    //   - content type is mp4-family (other containers don't put codec setup
    //     at file end);
    //   - we know the total size (need it to address the tail);
    //   - the file is bigger than head+tail combined (otherwise head already
    //     covered the whole file and a second fetch wouldn't help);
    //   - the tail fetch is small (skip giant fetches).
    if (
      isMp4Family(contentTypeHint) &&
      totalSize !== null &&
      totalSize > headBytes + tailBytes &&
      tailBytes <= 2 * 1024 * 1024
    ) {
      const tailStart = totalSize - tailBytes;
      const tail = await fetchRange(
        url,
        tailStart,
        totalSize - 1,
        fetchOptions
      );

      // Sparse buffer: head bytes at start, tail bytes at the right offset,
      // zero-fill in between. mp4 parsers walk box-by-box so the zero region
      // shows up as an unrecognized box and gets skipped. Allocating a full
      // multi-GB buffer here would be wasteful; cap by requiring totalSize
      // under a sane limit (1 GB) so we don't OOM on extreme inputs.
      const MAX_RECONSTRUCTED_SIZE = 1024 * 1024 * 1024;
      if (totalSize <= MAX_RECONSTRUCTED_SIZE) {
        const combined = Buffer.alloc(totalSize);
        head.buffer.copy(combined, 0);
        tail.buffer.copy(combined, tailStart);

        const combinedMetadata = await parseBuffer(
          combined,
          contentTypeHint ?? undefined,
          { duration: true }
        ).catch(() => null);

        if (combinedMetadata?.format.duration && combinedMetadata.format.duration > 0) {
          return {
            duration: combinedMetadata.format.duration,
            container: combinedMetadata.format.container ?? null,
            codec: combinedMetadata.format.codec ?? null,
            bitrate: combinedMetadata.format.bitrate ?? null,
            method: 'head+tail',
          };
        }
      }
    }

    // Head succeeded but no duration was extractable. Return metadata that
    // music-metadata DID surface (bitrate, container) so callers can do
    // size/bitrate math as their own fallback.
    if (headMetadata) {
      return {
        duration: null,
        container: headMetadata.format.container ?? null,
        codec: headMetadata.format.codec ?? null,
        bitrate: headMetadata.format.bitrate ?? null,
        method: null,
      };
    }
  } catch {
    // Swallow — duration extraction is best-effort.
  }

  return emptyResult();
}

function emptyResult(): ExtractDurationResult {
  return {
    duration: null,
    container: null,
    codec: null,
    bitrate: null,
    method: null,
  };
}
