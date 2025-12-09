/**
 * Platform-specific quirks handling for known CDN misconfigurations
 */

/**
 * MIME type mapping from query parameter values to standard MIME types
 */
const MIME_TYPE_MAPPINGS: Record<string, string> = {
  audio_mpeg: 'audio/mpeg',
  audio_mp3: 'audio/mpeg',
  video_mp4: 'video/mp4',
  video_webm: 'video/webm',
  audio_aac: 'audio/aac',
  audio_wav: 'audio/wav',
  audio_flac: 'audio/flac',
  audio_ogg: 'audio/ogg',
  video_ogg: 'video/ogg',
};

/**
 * Extracts MIME type from URL query parameters
 * Looks for common query parameter names like 'mime_type', 'mimetype', 'type', etc.
 */
function extractMimeTypeFromQuery(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    // Check common query parameter names
    const paramNames = ['mime_type', 'mimetype', 'mime', 'type', 'content_type', 'contenttype'];

    for (const paramName of paramNames) {
      const value = params.get(paramName);
      if (value) {
        // Check if it's a mapped value (e.g., 'audio_mpeg')
        const mapped = MIME_TYPE_MAPPINGS[value.toLowerCase()];
        if (mapped) {
          return mapped;
        }

        // Check if it already looks like a MIME type (contains '/')
        if (value.includes('/')) {
          return value.toLowerCase();
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if the URL is from TikTok CDN
 */
function isTikTokCDN(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('tiktokcdn');
  } catch {
    return false;
  }
}

/**
 * Checks if the URL is from Google CDN (googlevideo.com)
 */
function isGoogleCDN(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('googlevideo.com');
  } catch {
    return false;
  }
}

/**
 * Applies platform-specific quirks to correct known CDN misconfigurations
 *
 * @param url - The original URL
 * @param serverContentType - Content-Type returned by the server
 * @returns Corrected content-type or null if no correction needed
 */
export function applyPlatformQuirks(
  url: string,
  serverContentType: string | null
): string | null {
  // TikTok CDN quirk: Server sometimes returns wrong content-type
  // Check if there's a mime_type query parameter that conflicts with server response
  if (isTikTokCDN(url)) {
    const queryMimeType = extractMimeTypeFromQuery(url);

    if (queryMimeType && serverContentType) {
      // Normalize both for comparison
      const normalizedServer = serverContentType.split('/')[0]; // 'video' or 'audio'
      const normalizedQuery = queryMimeType.split('/')[0]; // 'video' or 'audio'

      // If they conflict (e.g., server says 'video' but query says 'audio')
      if (normalizedServer !== normalizedQuery) {
        // Trust the query parameter over the server response for TikTok CDN
        return queryMimeType;
      }
    }
  }

  // Google CDN quirk: Always trust the 'mime' query parameter when available
  if (isGoogleCDN(url)) {
    const queryMimeType = extractMimeTypeFromQuery(url);
    if (queryMimeType) {
      // Google CDN provides accurate MIME type in the query parameter
      return queryMimeType;
    }
  }

  // No quirks applied, return original server content-type
  return serverContentType;
}

/**
 * Gets a descriptive reason for why a quirk was applied (for logging/debugging)
 */
export function getQuirkReason(url: string, originalType: string | null, correctedType: string | null): string | null {
  if (originalType === correctedType || !correctedType) {
    return null;
  }

  if (isTikTokCDN(url)) {
    return `TikTok CDN quirk: Server returned '${originalType}' but query parameter specified '${correctedType}'`;
  }

  if (isGoogleCDN(url)) {
    return `Google CDN quirk: Using MIME type from query parameter '${correctedType}'${originalType ? ` instead of server's '${originalType}'` : ''}`;
  }

  return null;
}
