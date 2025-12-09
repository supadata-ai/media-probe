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
    'should probe Google CDN file',
    async () => {
      const url =
        'https://rr2---sn-i5heen7s.googlevideo.com/videoplayback?expire=1765166519&ei=V_k1aen6HquAkucPr7WI-AY&ip=216.195.9.105&id=o-ANDetcbkAhF7aUMmlt686S0pSV0hOkue_zlQ69ukbhiy&itag=251&source=youtube&requiressl=yes&xpc=EgVo2aDSNQ%3D%3D&bui=AYUSA3AvgQb877FYhqOHw_v7QYU757uu3sEXDIURMTX6t9dUXmlvFPo6EbYwNK4o7I5e6QOWX-rwppGq&spc=wH4Qq3oG_Zc3&vprv=1&svpuc=1&mime=audio%2Fwebm&rqh=1&gir=yes&clen=13857306&dur=764.681&lmt=1750624360450461&keepalive=yes&fexp=51552689,51565115,51565682,51580968&c=ANDROID&txp=5532534&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cxpc%2Cbui%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Crqh%2Cgir%2Cclen%2Cdur%2Clmt&sig=AJfQdSswRQIhAKYSq9uOARubWxuA75mfFFDG3aJCAeTm3wgZhJuA9yGhAiBjisJYHs5AjsTpZOvMack_6MrXmYPwLkb72x15xf0PIw%3D%3D&rm=sn-uvfopn2-cvne7e,sn-p5qel77e&rrc=79,104&req_id=99cb43c72332a3ee&rms=rdu,au&redirect_counter=2&cms_redirect=yes&cmsv=e&ipbypass=yes&met=1765145652,&mh=LE&mip=93.241.50.90&mm=29&mn=sn-i5heen7s&ms=rdu&mt=1765143312&mv=u&mvi=2&pl=26&lsparams=ipbypass,met,mh,mip,mm,mn,ms,mv,mvi,pl,rms&lsig=APaTxxMwRQIgRn05N5QRED5pasNO8ha4tA0wHyzL0nQV4eH6UtBCxyACIQCvtxvnuF06QSnZIkPZNHSi28X1e-RBNEBngB6Nhk21pw%3D%3D';

      const result = await probeMedia(url, {
        timeout: TIMEOUT,
        allowPlatformQuirks: true,
      });

      expect(result).toBeDefined();
      expect(result.size).toBeDefined();
      expect(result.contentType).toBeDefined();

      console.log('Google CDN result:', {
        size: result.size,
        contentType: result.contentType,
        isAudio: result.isAudio,
        isVideo: result.isVideo,
        method: result.method,
        supportsRangeRequests: result.supportsRangeRequests,
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
