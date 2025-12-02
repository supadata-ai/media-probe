import { describe, it, expect } from 'vitest';
import { probeMedia } from '../src/probe.js';

/**
 * Integration tests with real media assets
 * These tests make actual network requests and verify the library works with real-world URLs
 */
describe('Integration tests with real media assets', () => {
  // Increase timeout for network requests
  const TIMEOUT = 15000;

  it(
    'should probe M4A audio file',
    async () => {
      const url = 'https://pub-24142ddf1705422c8f379e0b09d55150.r2.dev/Bellflower_20Blvd.m4a';
      const result = await probeMedia(url, {
        timeout: TIMEOUT,
      });

      expect(result).toBeDefined();
      expect(result.isAudio).toBe(true);
      expect(result.isVideo).toBe(false);
      expect(result.size).toBeGreaterThan(0);
      expect(result.contentType).toMatch(/audio/i);
      expect(result.supportsRangeRequests).toBe(true);

      console.log('M4A Audio:', {
        size: result.size,
        contentType: result.contentType,
        method: result.method,
        supportsRangeRequests: result.supportsRangeRequests,
      });
    },
    { timeout: TIMEOUT }
  );

  it(
    'should probe MP4 video file',
    async () => {
      const url = 'https://pub-24142ddf1705422c8f379e0b09d55150.r2.dev/chatwith%20logo-2.mp4';
      const result = await probeMedia(url, {
        timeout: TIMEOUT,
      });

      expect(result).toBeDefined();
      expect(result.isVideo).toBe(true);
      expect(result.isAudio).toBe(false);
      expect(result.size).toBeGreaterThan(0);
      expect(result.contentType).toMatch(/video/i);
      expect(result.supportsRangeRequests).toBe(true);

      console.log('MP4 Video:', {
        size: result.size,
        contentType: result.contentType,
        method: result.method,
        supportsRangeRequests: result.supportsRangeRequests,
      });
    },
    { timeout: TIMEOUT }
  );

  it(
    'should probe MP3 audio file with special characters in URL',
    async () => {
      const url =
        'https://pub-24142ddf1705422c8f379e0b09d55150.r2.dev/EP612%20%20%F0%9F%8D%92%20-%20Gooaye%20%E8%82%A1%E7%99%8C.mp3';
      const result = await probeMedia(url, {
        timeout: TIMEOUT,
      });

      expect(result).toBeDefined();
      expect(result.isAudio).toBe(true);
      expect(result.isVideo).toBe(false);
      expect(result.size).toBeGreaterThan(0);
      expect(result.contentType).toMatch(/audio/i);
      expect(result.supportsRangeRequests).toBe(true);

      console.log('MP3 Audio (with special chars):', {
        size: result.size,
        contentType: result.contentType,
        method: result.method,
        supportsRangeRequests: result.supportsRangeRequests,
      });
    },
    { timeout: TIMEOUT }
  );

  it(
    'should probe TikTok CDN file without quirks mode (server content-type)',
    async () => {
      const url =
        'https://v19.tiktokcdn-us.com/65b3602a50aa32028dce6b725c776840/692f9428/video/tos/no1a/tos-no1a-v-2370-no/oIAA9EAf3yoCcFzoNCiWBieUJFHBhgAk4EPDzl/?a=1233&bti=ODszNWYuMDE6&ch=0&cr=0&dr=0&er=0&lr=default&cd=0%7C0%7C0%7C0&br=250&bt=125&ds=5&ft=GSDrKInz7ThCs~vPXq8Zmo&mime_type=audio_mpeg&qs=13&rc=Mzg2bWw5cnl0NjMzbzU8NUBpMzg2bWw5cnl0NjMzbzU8NUBiNGNkMmQ0LW9hLS1kMTFzYSNiNGNkMmQ0LW9hLS1kMTFzcw%3D%3D&vvpl=1&l=202512021936265A89D5155BE27113736A&btag=e00070000';

      const result = await probeMedia(url, {
        timeout: TIMEOUT,
        allowPlatformQuirks: false,
      });

      expect(result).toBeDefined();
      expect(result.size).toBeDefined();
      expect(result.contentType).toBe('video/mp4'); // Server returns this (incorrect)
      expect(result.isVideo).toBe(true); // Based on server content-type

      console.log('TikTok CDN without quirks mode:', {
        size: result.size,
        contentType: result.contentType,
        isAudio: result.isAudio,
        isVideo: result.isVideo,
      });
    },
    { timeout: TIMEOUT }
  );

  it(
    'should probe TikTok CDN file with quirks mode enabled (correct type from query)',
    async () => {
      const url =
        'https://v19.tiktokcdn-us.com/65b3602a50aa32028dce6b725c776840/692f9428/video/tos/no1a/tos-no1a-v-2370-no/oIAA9EAf3yoCcFzoNCiWBieUJFHBhgAk4EPDzl/?a=1233&bti=ODszNWYuMDE6&ch=0&cr=0&dr=0&er=0&lr=default&cd=0%7C0%7C0%7C0&br=250&bt=125&ds=5&ft=GSDrKInz7ThCs~vPXq8Zmo&mime_type=audio_mpeg&qs=13&rc=Mzg2bWw5cnl0NjMzbzU8NUBpMzg2bWw5cnl0NjMzbzU8NUBiNGNkMmQ0LW9hLS1kMTFzYSNiNGNkMmQ0LW9hLS1kMTFzcw%3D%3D&vvpl=1&l=202512021936265A89D5155BE27113736A&btag=e00070000';

      const result = await probeMedia(url, {
        timeout: TIMEOUT,
        allowPlatformQuirks: true, // Enable quirks mode
      });

      expect(result).toBeDefined();
      expect(result.size).toBeDefined();
      expect(result.contentType).toBe('audio/mpeg'); // Corrected from query parameter
      expect(result.isAudio).toBe(true); // Correctly identified as audio
      expect(result.isVideo).toBe(false);

      console.log('TikTok CDN with quirks mode enabled:', {
        size: result.size,
        contentType: result.contentType,
        isAudio: result.isAudio,
        isVideo: result.isVideo,
        note: 'Content-type corrected from video/mp4 to audio/mpeg using query parameter',
      });
    },
    { timeout: TIMEOUT }
  );

  it(
    'should handle all files efficiently with minimal data transfer',
    async () => {
      const urls = [
        'https://pub-24142ddf1705422c8f379e0b09d55150.r2.dev/Bellflower_20Blvd.m4a',
        'https://pub-24142ddf1705422c8f379e0b09d55150.r2.dev/chatwith%20logo-2.mp4',
        'https://pub-24142ddf1705422c8f379e0b09d55150.r2.dev/EP612%20%20%F0%9F%8D%92%20-%20Gooaye%20%E8%82%A1%E7%99%8C.mp3',
      ];

      const results = await Promise.all(
        urls.map((url) =>
          probeMedia(url, {
            timeout: TIMEOUT,
          })
        )
      );

      // All should succeed
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.size).toBeGreaterThan(0);
        expect(result.contentType).toBeDefined();
      });

      // Check that Range requests were used (most efficient)
      const rangeRequestCount = results.filter((r) => r.method === 'range').length;
      console.log(`Efficient probing: ${rangeRequestCount}/3 used Range requests`);

      // At least some should use range requests (most efficient method)
      expect(rangeRequestCount).toBeGreaterThan(0);
    },
    { timeout: TIMEOUT * 2 }
  );

  it(
    'should correctly identify media types across different CDNs',
    async () => {
      const testCases = [
        {
          url: 'https://pub-24142ddf1705422c8f379e0b09d55150.r2.dev/Bellflower_20Blvd.m4a',
          expectedType: 'audio',
        },
        {
          url: 'https://pub-24142ddf1705422c8f379e0b09d55150.r2.dev/chatwith%20logo-2.mp4',
          expectedType: 'video',
        },
        {
          url: 'https://pub-24142ddf1705422c8f379e0b09d55150.r2.dev/EP612%20%20%F0%9F%8D%92%20-%20Gooaye%20%E8%82%A1%E7%99%8C.mp3',
          expectedType: 'audio',
        },
      ];

      for (const testCase of testCases) {
        const result = await probeMedia(testCase.url, {
          timeout: TIMEOUT,
        });

        if (testCase.expectedType === 'audio') {
          expect(result.isAudio).toBe(true);
          expect(result.isVideo).toBe(false);
        } else if (testCase.expectedType === 'video') {
          expect(result.isVideo).toBe(true);
          expect(result.isAudio).toBe(false);
        }

        console.log(`✓ ${testCase.expectedType} correctly identified for: ${testCase.url}`);
      }
    },
    { timeout: TIMEOUT * 2 }
  );
});
