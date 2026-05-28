/**
 * Result of a media probe operation
 */
export interface ProbeResult {
  /**
   * Content type of the media (e.g., "video/mp4", "audio/mpeg")
   */
  contentType: string | null;

  /**
   * Size of the media in bytes, or null if size could not be determined
   */
  size: number | null;

  /**
   * Whether the server supports HTTP Range requests
   */
  supportsRangeRequests: boolean;

  /**
   * Whether this media is a video format
   */
  isVideo: boolean;

  /**
   * Whether this media is an audio format
   */
  isAudio: boolean;

  /**
   * The probing method that succeeded (range, head, or get)
   */
  method: 'range' | 'head' | 'get';
}

/**
 * Options for probing media
 */
export interface ProbeOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Custom fetch function (useful for testing or custom HTTP clients)
   * @default global fetch
   */
  fetch?: typeof fetch;

  /**
   * Additional headers to include in requests
   */
  headers?: Record<string, string>;

  /**
   * Timeout in milliseconds for each request
   * @default 10000
   */
  timeout?: number;

  /**
   * Whether to follow redirects
   * @default true
   */
  followRedirects?: boolean;

  /**
   * Enable platform-specific quirks handling for known CDN misconfigurations.
   * When enabled, the library will attempt to detect and correct known issues:
   *
   * - **TikTok CDN**: Servers sometimes return incorrect content-type headers
   *   (e.g., "video/mp4" for MP3 audio). When this option is enabled, the library
   *   will check for `mime_type` query parameters and use them if they conflict
   *   with the server's content-type header.
   *
   * @default false
   * @example
   * ```typescript
   * // TikTok URL with mime_type=audio_mpeg in query but server returns video/mp4
   * const result = await probeMedia(tiktokUrl, { allowPlatformQuirks: true });
   * // result.contentType will be 'audio/mpeg' (from query param) instead of 'video/mp4'
   * ```
   */
  allowPlatformQuirks?: boolean;
}

/**
 * Options for `extractMediaDuration`
 */
export interface ExtractDurationOptions {
  /**
   * Custom fetch function (useful for routing through a proxy that matches
   * the egress your downstream consumer will use).
   * @default global fetch
   */
  fetch?: typeof fetch;

  /**
   * Additional headers to include in Range requests.
   */
  headers?: Record<string, string>;

  /**
   * Timeout in milliseconds for each Range request.
   * @default 10000
   */
  timeout?: number;

  /**
   * Whether to follow redirects.
   * @default true
   */
  followRedirects?: boolean;

  /**
   * Bytes to fetch in the initial head Range request. The default 1 MB
   * covers the `moov` atom for fast-start mp4, EBML SegmentInfo for webm,
   * Xing/Info headers for mp3, and codec setup pages for ogg.
   * @default 1048576 (1 MB)
   */
  headBytes?: number;

  /**
   * Bytes to fetch from the file tail as a fallback for mp4 with `moov`
   * at the end. Skipped when `fileSize` is unknown or when the file fits
   * inside `headBytes`.
   * @default 524288 (512 KB)
   */
  tailBytes?: number;

  /**
   * Content-Type hint (from a previous probe). When provided, lets the
   * function bail early on unparseable types without issuing a network
   * request.
   */
  contentType?: string | null;

  /**
   * Known total file size (from a previous probe). Required to address
   * the tail-Range fallback on mp4-family content.
   */
  fileSize?: number | null;
}

/**
 * Result of `extractMediaDuration`
 */
export interface ExtractDurationResult {
  /**
   * Duration in seconds. `null` when extraction failed for any reason —
   * network error, parse failure, unsupported format, or the container
   * simply doesn't carry duration metadata (e.g. some streamed mp3s).
   */
  duration: number | null;

  /**
   * Container format reported by music-metadata (e.g. "MPEG-4", "Matroska",
   * "MPEG"). `null` when parsing didn't surface enough bytes to identify it.
   */
  container: string | null;

  /**
   * Codec name reported by music-metadata (e.g. "MPEG-1/2 Audio Layer 3",
   * "AAC"). `null` when not available.
   */
  codec: string | null;

  /**
   * Bitrate in bits per second, when the parser identified one. Useful
   * for callers that want a size/bitrate fallback estimate when
   * `duration` is null.
   */
  bitrate: number | null;

  /**
   * Which strategy succeeded:
   *   - `'head'`: duration came from the initial head Range
   *   - `'head+tail'`: needed an additional tail Range (mp4 moov-at-end)
   *   - `null`: no duration could be extracted
   */
  method: 'head' | 'head+tail' | null;
}
