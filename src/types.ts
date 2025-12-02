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
