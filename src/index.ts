/**
 * @supadata/media-probe
 *
 * Lightweight library for probing remote media assets to get their content type and size.
 *
 * @example
 * ```typescript
 * import { probeMedia } from '@supadata/media-probe';
 *
 * const result = await probeMedia('https://example.com/video.mp4');
 * console.log(result.size); // File size in bytes
 * console.log(result.contentType); // "video/mp4"
 * console.log(result.supportsRangeRequests); // true
 * console.log(result.isVideo); // true
 * ```
 */

export { probeMedia } from './probe.js';
export type { ProbeResult, ProbeOptions } from './types.js';
export {
  ProbeError,
  InvalidUrlError,
  NetworkError,
  TimeoutError,
  MaxRetriesExceededError,
  ClientError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ServerError,
} from './errors.js';
export {
  isVideoContent,
  isAudioContent,
  normalizeContentType,
} from './content-type.js';
