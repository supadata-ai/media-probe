import { describe, it, expect } from 'vitest';
import { applyPlatformQuirks, getQuirkReason } from '../src/platform-quirks.js';

describe('Platform Quirks', () => {
  describe('applyPlatformQuirks', () => {
    it('should return original content-type for non-TikTok URLs', () => {
      const url = 'https://example.com/video.mp4';
      const serverContentType = 'video/mp4';

      const result = applyPlatformQuirks(url, serverContentType);

      expect(result).toBe('video/mp4');
    });

    it('should correct TikTok CDN misconfigurations when types conflict', () => {
      const url =
        'https://v19.tiktokcdn-us.com/path/to/file?mime_type=audio_mpeg&other=params';
      const serverContentType = 'video/mp4';

      const result = applyPlatformQuirks(url, serverContentType);

      expect(result).toBe('audio/mpeg');
    });

    it('should not override when TikTok CDN types match', () => {
      const url =
        'https://v19.tiktokcdn-us.com/path/to/file?mime_type=video_mp4&other=params';
      const serverContentType = 'video/mp4';

      const result = applyPlatformQuirks(url, serverContentType);

      expect(result).toBe('video/mp4'); // No conflict, keep server response
    });

    it('should handle various mime_type query parameter values', () => {
      const testCases = [
        { query: 'audio_mpeg', expected: 'audio/mpeg' },
        { query: 'audio_mp3', expected: 'audio/mpeg' },
        { query: 'video_mp4', expected: 'video/mp4' },
        { query: 'audio_aac', expected: 'audio/aac' },
        { query: 'audio_wav', expected: 'audio/wav' },
      ];

      for (const { query, expected } of testCases) {
        const url = `https://v19.tiktokcdn-us.com/file?mime_type=${query}`;
        const serverContentType = 'video/mp4';

        const result = applyPlatformQuirks(url, serverContentType);

        if (expected.startsWith('audio')) {
          // Should correct video to audio
          expect(result).toBe(expected);
        }
      }
    });

    it('should return original when no query parameter present', () => {
      const url = 'https://v19.tiktokcdn-us.com/path/to/file';
      const serverContentType = 'video/mp4';

      const result = applyPlatformQuirks(url, serverContentType);

      expect(result).toBe('video/mp4');
    });

    it('should handle null server content-type', () => {
      const url =
        'https://v19.tiktokcdn-us.com/path/to/file?mime_type=audio_mpeg';
      const serverContentType = null;

      const result = applyPlatformQuirks(url, serverContentType);

      expect(result).toBeNull();
    });

    it('should handle various TikTok CDN domains', () => {
      const domains = [
        'v19.tiktokcdn-us.com',
        'v16.tiktokcdn.com',
        'v77.tiktokcdn-eu.com',
      ];

      for (const domain of domains) {
        const url = `https://${domain}/file?mime_type=audio_mpeg`;
        const result = applyPlatformQuirks(url, 'video/mp4');

        expect(result).toBe('audio/mpeg');
      }
    });

    it('should support alternative query parameter names', () => {
      const paramNames = ['mimetype', 'type', 'content_type', 'contenttype'];

      for (const paramName of paramNames) {
        const url = `https://v19.tiktokcdn-us.com/file?${paramName}=audio_mpeg`;
        const result = applyPlatformQuirks(url, 'video/mp4');

        expect(result).toBe('audio/mpeg');
      }
    });

    it('should handle MIME types in query params (not just mapped values)', () => {
      const url = 'https://v19.tiktokcdn-us.com/file?mime_type=audio/mpeg';
      const result = applyPlatformQuirks(url, 'video/mp4');

      expect(result).toBe('audio/mpeg');
    });

    it('should apply Google CDN quirk for googlevideo.com URLs', () => {
      const url = 'https://rr2---sn-i5heen7s.googlevideo.com/videoplayback?mime=audio%2Fwebm&other=params';
      const serverContentType = 'application/octet-stream';

      const result = applyPlatformQuirks(url, serverContentType);

      expect(result).toBe('audio/webm');
    });

    it('should handle Google CDN URLs with various mime types', () => {
      const testCases = [
        { mime: 'audio/webm', expected: 'audio/webm' },
        { mime: 'audio/mp4', expected: 'audio/mp4' },
        { mime: 'video/mp4', expected: 'video/mp4' },
        { mime: 'video/webm', expected: 'video/webm' },
      ];

      for (const { mime, expected } of testCases) {
        const url = `https://rr1---sn-test.googlevideo.com/videoplayback?mime=${encodeURIComponent(mime)}`;
        const result = applyPlatformQuirks(url, 'application/octet-stream');

        expect(result).toBe(expected);
      }
    });

    it('should return original content-type for Google CDN without mime param', () => {
      const url = 'https://rr1---sn-test.googlevideo.com/videoplayback?other=params';
      const serverContentType = 'video/mp4';

      const result = applyPlatformQuirks(url, serverContentType);

      expect(result).toBe('video/mp4');
    });
  });

  describe('getQuirkReason', () => {
    it('should return null when no quirk was applied', () => {
      const url = 'https://example.com/file.mp4';
      const reason = getQuirkReason(url, 'video/mp4', 'video/mp4');

      expect(reason).toBeNull();
    });

    it('should return descriptive reason for TikTok quirk', () => {
      const url = 'https://v19.tiktokcdn-us.com/file?mime_type=audio_mpeg';
      const reason = getQuirkReason(url, 'video/mp4', 'audio/mpeg');

      expect(reason).toContain('TikTok CDN quirk');
      expect(reason).toContain('video/mp4');
      expect(reason).toContain('audio/mpeg');
    });

    it('should return null when corrected type is null', () => {
      const url = 'https://v19.tiktokcdn-us.com/file';
      const reason = getQuirkReason(url, 'video/mp4', null);

      expect(reason).toBeNull();
    });

    it('should return descriptive reason for Google CDN quirk', () => {
      const url = 'https://rr1---sn-test.googlevideo.com/videoplayback?mime=audio%2Fwebm';
      const reason = getQuirkReason(url, 'application/octet-stream', 'audio/webm');

      expect(reason).toContain('Google CDN quirk');
      expect(reason).toContain('audio/webm');
    });
  });
});
