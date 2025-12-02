/**
 * Video MIME types and file extensions
 */
const VIDEO_PATTERNS = {
  mimeTypes: /^video\/(mp4|webm|quicktime|x-msvideo|x-matroska|ogg|mpeg|x-flv|3gpp|x-ms-wmv)$/i,
  extensions: /\.(mp4|webm|mov|avi|mkv|ogv|mpg|mpeg|m4v|flv|3gp|wmv)(\?.*)?$/i,
};

/**
 * Audio MIME types and file extensions
 */
const AUDIO_PATTERNS = {
  mimeTypes: /^audio\/(mpeg|mp4|wav|webm|ogg|flac|aac|x-m4a|x-wav|x-flac)$/i,
  extensions: /\.(mp3|m4a|wav|webm|ogg|flac|aac|opus)(\?.*)?$/i,
};

/**
 * Checks if a content type or URL indicates a video file
 */
export function isVideoContent(contentType: string | null, url: string): boolean {
  // Check MIME type
  if (contentType && VIDEO_PATTERNS.mimeTypes.test(contentType)) {
    return true;
  }

  // Check file extension
  if (VIDEO_PATTERNS.extensions.test(url)) {
    return true;
  }

  return false;
}

/**
 * Checks if a content type or URL indicates an audio file
 */
export function isAudioContent(contentType: string | null, url: string): boolean {
  // Check MIME type
  if (contentType && AUDIO_PATTERNS.mimeTypes.test(contentType)) {
    return true;
  }

  // Check file extension
  if (AUDIO_PATTERNS.extensions.test(url)) {
    return true;
  }

  return false;
}

/**
 * Extracts the file size from a Content-Range header
 * Content-Range format: "bytes 0-0/12345" or "bytes 0-999/12345"
 */
export function extractSizeFromContentRange(contentRange: string | null): number | null {
  if (!contentRange) return null;

  const match = contentRange.match(/bytes\s+\d+-\d+\/(\d+)/i);
  if (match && match[1]) {
    const size = parseInt(match[1], 10);
    return isNaN(size) ? null : size;
  }

  return null;
}

/**
 * Extracts the file size from a Content-Length header
 */
export function extractSizeFromContentLength(contentLength: string | null): number | null {
  if (!contentLength) return null;

  const size = parseInt(contentLength, 10);
  return isNaN(size) ? null : size;
}

/**
 * Normalizes content type by removing parameters (e.g., charset)
 */
export function normalizeContentType(contentType: string | null): string | null {
  if (!contentType) return null;

  // Remove parameters like charset, boundary, etc.
  const normalized = contentType.split(';')[0].trim().toLowerCase();
  return normalized || null;
}
