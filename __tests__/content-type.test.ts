import { describe, it, expect } from 'vitest';
import {
  isVideoContent,
  isAudioContent,
  extractSizeFromContentRange,
  extractSizeFromContentLength,
  normalizeContentType,
} from '../src/content-type.js';

describe('isVideoContent', () => {
  it('should detect video MIME types', () => {
    expect(isVideoContent('video/mp4', 'https://example.com/file')).toBe(true);
    expect(isVideoContent('video/webm', 'https://example.com/file')).toBe(true);
    expect(isVideoContent('video/quicktime', 'https://example.com/file')).toBe(true);
    expect(isVideoContent('video/x-msvideo', 'https://example.com/file')).toBe(true);
    expect(isVideoContent('video/x-matroska', 'https://example.com/file')).toBe(true);
    expect(isVideoContent('video/mp2t', 'https://example.com/file')).toBe(true);
  });

  it('should detect any video/* MIME type', () => {
    // Trust any video/* prefix as video content
    expect(isVideoContent('video/unknown-format', 'https://example.com/file')).toBe(true);
    expect(isVideoContent('video/x-custom', 'https://example.com/file')).toBe(true);
    expect(isVideoContent('video/av1', 'https://example.com/file')).toBe(true);
  });

  it('should detect video file extensions', () => {
    expect(isVideoContent(null, 'https://example.com/video.mp4')).toBe(true);
    expect(isVideoContent(null, 'https://example.com/video.webm')).toBe(true);
    expect(isVideoContent(null, 'https://example.com/video.mov')).toBe(true);
    expect(isVideoContent(null, 'https://example.com/video.avi')).toBe(true);
    expect(isVideoContent(null, 'https://example.com/video.mkv')).toBe(true);
    expect(isVideoContent(null, 'https://example.com/video.ogv')).toBe(true);
    expect(isVideoContent(null, 'https://example.com/video.mpg')).toBe(true);
    expect(isVideoContent(null, 'https://example.com/video.flv')).toBe(true);
    expect(isVideoContent(null, 'https://example.com/video.3gp')).toBe(true);
    expect(isVideoContent(null, 'https://example.com/video.ts')).toBe(true);
    expect(isVideoContent(null, 'https://example.com/video.m3u8')).toBe(true);
  });

  it('should handle URLs with query parameters', () => {
    expect(isVideoContent(null, 'https://example.com/video.mp4?token=abc')).toBe(true);
  });

  it('should return false for non-video content', () => {
    expect(isVideoContent('audio/mpeg', 'https://example.com/audio.mp3')).toBe(false);
    expect(isVideoContent('text/html', 'https://example.com/page.html')).toBe(false);
    expect(isVideoContent(null, 'https://example.com/file.txt')).toBe(false);
  });
});

describe('isAudioContent', () => {
  it('should detect audio MIME types', () => {
    expect(isAudioContent('audio/mpeg', 'https://example.com/file')).toBe(true);
    expect(isAudioContent('audio/mp4', 'https://example.com/file')).toBe(true);
    expect(isAudioContent('audio/wav', 'https://example.com/file')).toBe(true);
    expect(isAudioContent('audio/webm', 'https://example.com/file')).toBe(true);
    expect(isAudioContent('audio/ogg', 'https://example.com/file')).toBe(true);
    expect(isAudioContent('audio/flac', 'https://example.com/file')).toBe(true);
  });

  it('should detect any audio/* MIME type', () => {
    // Trust any audio/* prefix as audio content
    expect(isAudioContent('audio/unknown-format', 'https://example.com/file')).toBe(true);
    expect(isAudioContent('audio/x-custom', 'https://example.com/file')).toBe(true);
    expect(isAudioContent('audio/vnd.dolby.heaac.1', 'https://example.com/file')).toBe(true);
  });

  it('should detect audio file extensions', () => {
    expect(isAudioContent(null, 'https://example.com/audio.mp3')).toBe(true);
    expect(isAudioContent(null, 'https://example.com/audio.m4a')).toBe(true);
    expect(isAudioContent(null, 'https://example.com/audio.wav')).toBe(true);
    expect(isAudioContent(null, 'https://example.com/audio.flac')).toBe(true);
    expect(isAudioContent(null, 'https://example.com/audio.ogg')).toBe(true);
    expect(isAudioContent(null, 'https://example.com/audio.aac')).toBe(true);
    expect(isAudioContent(null, 'https://example.com/audio.opus')).toBe(true);
  });

  it('should handle URLs with query parameters', () => {
    expect(isAudioContent(null, 'https://example.com/audio.mp3?token=abc')).toBe(true);
  });

  it('should return false for non-audio content', () => {
    expect(isAudioContent('video/mp4', 'https://example.com/video.mp4')).toBe(false);
    expect(isAudioContent('text/html', 'https://example.com/page.html')).toBe(false);
    expect(isAudioContent(null, 'https://example.com/file.txt')).toBe(false);
  });
});

describe('extractSizeFromContentRange', () => {
  it('should extract size from valid Content-Range header', () => {
    expect(extractSizeFromContentRange('bytes 0-0/1000')).toBe(1000);
    expect(extractSizeFromContentRange('bytes 0-999/1000')).toBe(1000);
    expect(extractSizeFromContentRange('bytes 500-999/2048')).toBe(2048);
    expect(extractSizeFromContentRange('BYTES 0-0/5242880')).toBe(5242880); // case insensitive
  });

  it('should return null for invalid Content-Range header', () => {
    expect(extractSizeFromContentRange(null)).toBeNull();
    expect(extractSizeFromContentRange('')).toBeNull();
    expect(extractSizeFromContentRange('invalid')).toBeNull();
    expect(extractSizeFromContentRange('bytes 0-0')).toBeNull();
    expect(extractSizeFromContentRange('0-0/1000')).toBeNull();
  });

  it('should return null for non-numeric sizes', () => {
    expect(extractSizeFromContentRange('bytes 0-0/abc')).toBeNull();
  });
});

describe('extractSizeFromContentLength', () => {
  it('should extract size from valid Content-Length header', () => {
    expect(extractSizeFromContentLength('1000')).toBe(1000);
    expect(extractSizeFromContentLength('5242880')).toBe(5242880);
    expect(extractSizeFromContentLength('0')).toBe(0);
  });

  it('should return null for invalid Content-Length header', () => {
    expect(extractSizeFromContentLength(null)).toBeNull();
    expect(extractSizeFromContentLength('')).toBeNull();
    expect(extractSizeFromContentLength('abc')).toBeNull();
  });

  it('should parse floats as integers (parseInt behavior)', () => {
    // parseInt('12.5') returns 12, not null - this is expected behavior
    expect(extractSizeFromContentLength('12.5')).toBe(12);
  });
});

describe('normalizeContentType', () => {
  it('should normalize content type by removing parameters', () => {
    expect(normalizeContentType('video/mp4; codecs="avc1.42E01E"')).toBe('video/mp4');
    expect(normalizeContentType('audio/mpeg; charset=utf-8')).toBe('audio/mpeg');
    expect(normalizeContentType('text/html; charset=utf-8; boundary=something')).toBe('text/html');
  });

  it('should handle content type without parameters', () => {
    expect(normalizeContentType('video/mp4')).toBe('video/mp4');
    expect(normalizeContentType('audio/mpeg')).toBe('audio/mpeg');
  });

  it('should normalize case', () => {
    expect(normalizeContentType('VIDEO/MP4')).toBe('video/mp4');
    expect(normalizeContentType('Audio/MPEG')).toBe('audio/mpeg');
  });

  it('should handle null and empty strings', () => {
    expect(normalizeContentType(null)).toBeNull();
    expect(normalizeContentType('')).toBeNull();
  });

  it('should trim whitespace', () => {
    expect(normalizeContentType('  video/mp4  ')).toBe('video/mp4');
    expect(normalizeContentType('audio/mpeg ; charset=utf-8')).toBe('audio/mpeg');
  });
});
