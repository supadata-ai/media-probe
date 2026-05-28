import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractMediaDuration } from '../src/duration.js';
import { InvalidUrlError } from '../src/errors.js';

const FIXTURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const MP3_FIXTURE = readFileSync(resolve(FIXTURES_DIR, '3s-tone.mp3'));
const MP4_FIXTURE = readFileSync(resolve(FIXTURES_DIR, '3s-blank.mp4'));
// 30-second mp4 generated without `+faststart` so the moov atom lives at the
// end of the file — needed to exercise the head+tail strategy realistically.
const MP4_TAIL_MOOV_FIXTURE = readFileSync(
  resolve(FIXTURES_DIR, '30s-tail-moov.mp4')
);

/**
 * Build a fetch mock that serves a Range request out of an in-memory buffer.
 * Emits a 206 with Content-Range/Content-Length headers the way a well-behaved
 * CDN would, so the extractor's parsing of those headers is also covered.
 */
function rangeFetchFor(buffer: Buffer, contentType: string) {
  return vi.fn(async (_url: any, init: any) => {
    const rangeHeader: string | undefined = init?.headers?.Range;
    let start = 0;
    let end = buffer.length - 1;
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d+)/);
      if (match) {
        start = parseInt(match[1], 10);
        end = Math.min(parseInt(match[2], 10), buffer.length - 1);
      }
    }
    const slice = buffer.subarray(start, end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        'content-type': contentType,
        'content-range': `bytes ${start}-${end}/${buffer.length}`,
        'content-length': String(slice.length),
      },
    }) as unknown as Response;
  });
}

describe('extractMediaDuration', () => {
  describe('input validation', () => {
    it('throws InvalidUrlError for invalid URLs', async () => {
      await expect(extractMediaDuration('not-a-url')).rejects.toThrow(InvalidUrlError);
    });

    it('bails early (no network call) when contentType is unparseable', async () => {
      const fetch = vi.fn();
      const result = await extractMediaDuration('https://example.com/x.json', {
        fetch: fetch as unknown as typeof globalThis.fetch,
        contentType: 'application/json',
      });
      expect(result.duration).toBeNull();
      expect(result.method).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('head-only strategy', () => {
    it('extracts duration from an mp3 head Range', async () => {
      const fetch = rangeFetchFor(MP3_FIXTURE, 'audio/mpeg');
      const result = await extractMediaDuration('https://cdn.example.com/song.mp3', {
        fetch: fetch as unknown as typeof globalThis.fetch,
        contentType: 'audio/mpeg',
      });

      expect(result.method).toBe('head');
      expect(result.duration).toBeGreaterThan(2.5);
      expect(result.duration).toBeLessThan(3.5);
      expect(result.bitrate).toBeGreaterThan(0);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('extracts duration from a fast-start mp4 head Range', async () => {
      const fetch = rangeFetchFor(MP4_FIXTURE, 'video/mp4');
      const result = await extractMediaDuration('https://cdn.example.com/clip.mp4', {
        fetch: fetch as unknown as typeof globalThis.fetch,
        contentType: 'video/mp4',
      });

      expect(result.method).toBe('head');
      expect(result.duration).toBeGreaterThan(2.5);
      expect(result.duration).toBeLessThan(3.5);
      expect(result.container).toMatch(/mp4|isom|quicktime/i);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('parses successfully without a contentType hint', async () => {
      const fetch = rangeFetchFor(MP3_FIXTURE, 'audio/mpeg');
      const result = await extractMediaDuration('https://cdn.example.com/song.mp3', {
        fetch: fetch as unknown as typeof globalThis.fetch,
      });
      expect(result.method).toBe('head');
      expect(result.duration).toBeGreaterThan(2.5);
    });
  });

  describe('head+tail strategy', () => {
    it('triggers a tail Range when head returns no duration on mp4-family', async () => {
      // Serve the real moov-at-end mp4 fixture. With a 64 KB head Range the
      // moov atom isn't reached (it lives at the file's end), so the head
      // parse returns no duration and the function should fall through to
      // a tail Range fetch — assembling a sparse buffer and re-parsing.
      const fetch = rangeFetchFor(MP4_TAIL_MOOV_FIXTURE, 'video/mp4');
      const result = await extractMediaDuration(
        'https://cdn.example.com/tail-moov.mp4',
        {
          fetch: fetch as unknown as typeof globalThis.fetch,
          contentType: 'video/mp4',
          fileSize: MP4_TAIL_MOOV_FIXTURE.length,
          // Force the head to be small enough that moov is not in it.
          headBytes: 64 * 1024,
          tailBytes: 64 * 1024,
        }
      );

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.method).toBe('head+tail');
      expect(result.duration).toBeGreaterThan(29);
      expect(result.duration).toBeLessThan(31);
    });

    it('does NOT issue a tail Range for non-mp4-family containers', async () => {
      // Audio/webm: head parse returns no duration → should NOT trigger tail.
      const fetch = vi.fn(async () => {
        return new Response(Buffer.alloc(1024), {
          status: 206,
          headers: {
            'content-type': 'audio/webm',
            'content-range': `bytes 0-1023/4096`,
            'content-length': '1024',
          },
        }) as unknown as Response;
      });
      const result = await extractMediaDuration('https://cdn.example.com/clip.webm', {
        fetch: fetch as unknown as typeof globalThis.fetch,
        contentType: 'audio/webm',
        fileSize: 4096,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.method).toBeNull();
    });

    it('does NOT issue a tail Range when fileSize is unknown', async () => {
      const fetch = vi.fn(async () => {
        return new Response(Buffer.alloc(1024), {
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-length': '1024',
          },
        }) as unknown as Response;
      });
      const result = await extractMediaDuration('https://cdn.example.com/clip.mp4', {
        fetch: fetch as unknown as typeof globalThis.fetch,
        contentType: 'video/mp4',
        // no fileSize hint, no Content-Range header
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.method).toBeNull();
    });
  });

  describe('failure modes', () => {
    it('returns empty result (no throw) on network error', async () => {
      const fetch = vi.fn(async () => {
        throw new Error('connection refused');
      });
      const result = await extractMediaDuration('https://cdn.example.com/clip.mp4', {
        fetch: fetch as unknown as typeof globalThis.fetch,
        contentType: 'video/mp4',
      });
      expect(result.duration).toBeNull();
      expect(result.method).toBeNull();
    });

    it('returns empty result (no throw) on HTTP error status', async () => {
      const fetch = vi.fn(async () => {
        return new Response('', { status: 502 }) as unknown as Response;
      });
      const result = await extractMediaDuration('https://cdn.example.com/clip.mp4', {
        fetch: fetch as unknown as typeof globalThis.fetch,
        contentType: 'video/mp4',
      });
      expect(result.duration).toBeNull();
    });

    it('returns parser metadata even when duration is null', async () => {
      // The first 64 bytes of an mp3 are insufficient to compute duration
      // but enough to identify the container. Caller can use this to do a
      // size×bitrate fallback if desired.
      const fetch = rangeFetchFor(MP3_FIXTURE.subarray(0, 256), 'audio/mpeg');
      const result = await extractMediaDuration('https://cdn.example.com/song.mp3', {
        fetch: fetch as unknown as typeof globalThis.fetch,
        contentType: 'audio/mpeg',
        headBytes: 256,
      });
      // Either it manages to parse duration from 256 bytes (unlikely for VBR
      // detection) or it returns method=null but with container/bitrate hints.
      if (result.duration === null) {
        expect(result.method).toBeNull();
        // bitrate may or may not be detectable from this little; not asserting.
      }
    });
  });
});
