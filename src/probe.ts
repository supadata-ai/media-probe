import { ProbeOptions, ProbeResult } from './types.js';
import {
  InvalidUrlError,
  NetworkError,
  TimeoutError,
  MaxRetriesExceededError,
} from './errors.js';
import {
  isVideoContent,
  isAudioContent,
  extractSizeFromContentRange,
  extractSizeFromContentLength,
  normalizeContentType,
} from './content-type.js';
import { applyPlatformQuirks } from './platform-quirks.js';

/**
 * Default options for probing
 */
const DEFAULT_OPTIONS: Required<ProbeOptions> = {
  maxRetries: 3,
  fetch: globalThis.fetch,
  headers: {},
  timeout: 10000,
  followRedirects: true,
  allowPlatformQuirks: false,
};

/**
 * Validates a URL
 */
function validateUrl(url: string): void {
  try {
    new URL(url);
  } catch {
    throw new InvalidUrlError(url);
  }
}

/**
 * Creates an AbortController with timeout
 */
function createTimeoutController(timeout: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller;
}

/**
 * Performs a fetch request with timeout and error handling
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number,
  fetchFn: typeof fetch
): Promise<Response> {
  const controller = createTimeoutController(timeout);

  try {
    const response = await fetchFn(url, {
      ...options,
      signal: controller.signal,
    });

    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new TimeoutError(timeout);
    }
    throw new NetworkError(error.message || 'Network request failed');
  }
}

/**
 * Attempts to probe using Range request (most efficient - only 1 byte)
 */
async function probeWithRange(
  url: string,
  options: Required<ProbeOptions>
): Promise<ProbeResult | null> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          ...options.headers,
          Range: 'bytes=0-0',
        },
        redirect: options.followRedirects ? 'follow' : 'manual',
      },
      options.timeout,
      options.fetch
    );

    // Range requests should return 206 Partial Content
    if (response.status !== 206) {
      return null;
    }

    let contentType = normalizeContentType(response.headers.get('content-type'));
    const contentRange = response.headers.get('content-range');
    const size = extractSizeFromContentRange(contentRange);

    // If we got a 206 but no size, the range request didn't work as expected
    if (size === null) {
      return null;
    }

    // Apply platform quirks if enabled
    if (options.allowPlatformQuirks) {
      contentType = applyPlatformQuirks(url, contentType);
    }

    return {
      contentType,
      size,
      supportsRangeRequests: true,
      isVideo: isVideoContent(contentType, url),
      isAudio: isAudioContent(contentType, url),
      method: 'range',
    };
  } catch (error) {
    // Range request failed, will try other methods
    return null;
  }
}

/**
 * Attempts to probe using HEAD request
 */
async function probeWithHead(
  url: string,
  options: Required<ProbeOptions>
): Promise<ProbeResult | null> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'HEAD',
        headers: options.headers,
        redirect: options.followRedirects ? 'follow' : 'manual',
      },
      options.timeout,
      options.fetch
    );

    if (!response.ok && response.status !== 405) {
      // 405 Method Not Allowed means HEAD is not supported, but other errors might be real
      throw new NetworkError(
        `HEAD request failed with status ${response.status}`,
        response.status
      );
    }

    // If HEAD is not allowed, return null to try GET
    if (response.status === 405) {
      return null;
    }

    let contentType = normalizeContentType(response.headers.get('content-type'));
    const contentLength = response.headers.get('content-length');
    const size = extractSizeFromContentLength(contentLength);
    const acceptRanges = response.headers.get('accept-ranges');

    // Apply platform quirks if enabled
    if (options.allowPlatformQuirks) {
      contentType = applyPlatformQuirks(url, contentType);
    }

    return {
      contentType,
      size,
      supportsRangeRequests: acceptRanges === 'bytes',
      isVideo: isVideoContent(contentType, url),
      isAudio: isAudioContent(contentType, url),
      method: 'head',
    };
  } catch (error) {
    // HEAD request failed, will try GET
    return null;
  }
}

/**
 * Attempts to probe using GET request (fallback, least efficient)
 */
async function probeWithGet(
  url: string,
  options: Required<ProbeOptions>
): Promise<ProbeResult> {
  const response = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers: {
        ...options.headers,
        Range: 'bytes=0-0', // Try to get minimal data
      },
      redirect: options.followRedirects ? 'follow' : 'manual',
    },
    options.timeout,
    options.fetch
  );

  if (!response.ok) {
    throw new NetworkError(
      `GET request failed with status ${response.status}`,
      response.status
    );
  }

  let contentType = normalizeContentType(response.headers.get('content-type'));
  const contentLength = response.headers.get('content-length');
  const contentRange = response.headers.get('content-range');
  const acceptRanges = response.headers.get('accept-ranges');

  // Try to extract size from various headers
  let size = extractSizeFromContentRange(contentRange);
  if (size === null) {
    size = extractSizeFromContentLength(contentLength);
  }

  // Apply platform quirks if enabled
  if (options.allowPlatformQuirks) {
    contentType = applyPlatformQuirks(url, contentType);
  }

  return {
    contentType,
    size,
    supportsRangeRequests: acceptRanges === 'bytes' || response.status === 206,
    isVideo: isVideoContent(contentType, url),
    isAudio: isAudioContent(contentType, url),
    method: 'get',
  };
}

/**
 * Probes a media URL to get its metadata
 *
 * Tries multiple strategies in order of efficiency:
 * 1. Range request (most efficient - 1 byte)
 * 2. HEAD request (no body)
 * 3. GET request (fallback)
 *
 * @param url - The URL to probe
 * @param options - Probing options
 * @returns Media metadata
 * @throws {InvalidUrlError} If the URL is invalid
 * @throws {NetworkError} If network requests fail
 * @throws {TimeoutError} If requests time out
 * @throws {MaxRetriesExceededError} If all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await probeMedia('https://example.com/video.mp4');
 * console.log(result.size); // File size in bytes
 * console.log(result.contentType); // "video/mp4"
 * console.log(result.supportsRangeRequests); // true
 * ```
 */
export async function probeMedia(
  url: string,
  options: ProbeOptions = {}
): Promise<ProbeResult> {
  validateUrl(url);

  const mergedOptions: Required<ProbeOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
    headers: {
      ...DEFAULT_OPTIONS.headers,
      ...options.headers,
    },
  };

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < mergedOptions.maxRetries) {
    attempt++;

    try {
      // Try Range request first (most efficient)
      const rangeResult = await probeWithRange(url, mergedOptions);
      if (rangeResult) {
        return rangeResult;
      }

      // Try HEAD request
      const headResult = await probeWithHead(url, mergedOptions);
      if (headResult) {
        return headResult;
      }

      // Fall back to GET request
      return await probeWithGet(url, mergedOptions);
    } catch (error) {
      lastError = error as Error;

      // Don't retry on invalid URL or certain error types
      if (
        error instanceof InvalidUrlError ||
        (error instanceof NetworkError && error.statusCode && error.statusCode < 500)
      ) {
        throw error;
      }

      // If this was the last attempt, throw
      if (attempt >= mergedOptions.maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * attempt, 5000)));
    }
  }

  // All retries exhausted
  if (lastError) {
    throw lastError;
  }

  throw new MaxRetriesExceededError(mergedOptions.maxRetries);
}
