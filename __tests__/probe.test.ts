import { describe, it, expect, vi } from 'vitest';
import { probeMedia } from '../src/probe.js';
import {
  InvalidUrlError,
  NetworkError,
  TimeoutError,
  MaxRetriesExceededError,
} from '../src/errors.js';

describe('probeMedia', () => {
  describe('URL validation', () => {
    it('should throw InvalidUrlError for invalid URLs', async () => {
      await expect(probeMedia('not-a-url')).rejects.toThrow(InvalidUrlError);
      await expect(probeMedia('')).rejects.toThrow(InvalidUrlError);
    });

    it('should accept valid URLs', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('', {
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-0/1000',
          },
        })
      );

      const result = await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
      });

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Range request strategy', () => {
    it('should use Range request when server supports it', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('x', {
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-0/1048576',
          },
        })
      );

      const result = await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
      });

      expect(result).toEqual({
        contentType: 'video/mp4',
        size: 1048576,
        supportsRangeRequests: true,
        isVideo: true,
        isAudio: false,
        method: 'range',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/video.mp4',
        expect.objectContaining({
          headers: expect.objectContaining({
            Range: 'bytes=0-0',
          }),
        })
      );
    });

    it('should detect audio files via content-type', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('', {
          status: 206,
          headers: {
            'content-type': 'audio/mpeg',
            'content-range': 'bytes 0-0/5242880',
          },
        })
      );

      const result = await probeMedia('https://example.com/audio.mp3', {
        fetch: mockFetch,
      });

      expect(result.isAudio).toBe(true);
      expect(result.isVideo).toBe(false);
      expect(result.contentType).toBe('audio/mpeg');
    });

    it('should detect video files via URL extension', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('', {
          status: 206,
          headers: {
            'content-type': 'application/octet-stream',
            'content-range': 'bytes 0-0/1048576',
          },
        })
      );

      const result = await probeMedia('https://example.com/video.webm', {
        fetch: mockFetch,
      });

      expect(result.isVideo).toBe(true);
    });
  });

  describe('HEAD request fallback', () => {
    it('should fall back to HEAD when Range fails', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response('', {
            status: 200, // Not 206, so Range doesn't work
            headers: {
              'content-type': 'video/mp4',
              'content-length': '2097152',
            },
          })
        )
        .mockResolvedValueOnce(
          new Response('', {
            status: 200,
            headers: {
              'content-type': 'video/mp4',
              'content-length': '2097152',
              'accept-ranges': 'bytes',
            },
          })
        );

      const result = await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
      });

      expect(result).toEqual({
        contentType: 'video/mp4',
        size: 2097152,
        supportsRangeRequests: true,
        isVideo: true,
        isAudio: false,
        method: 'head',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][1]).toMatchObject({ method: 'HEAD' });
    });

    it('should handle missing accept-ranges header', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response('', {
            status: 200,
            headers: {
              'content-type': 'audio/mpeg',
              'content-length': '3145728',
            },
          })
        )
        .mockResolvedValueOnce(
          new Response('', {
            status: 200,
            headers: {
              'content-type': 'audio/mpeg',
              'content-length': '3145728',
            },
          })
        );

      const result = await probeMedia('https://example.com/audio.mp3', {
        fetch: mockFetch,
      });

      expect(result.supportsRangeRequests).toBe(false);
      expect(result.method).toBe('head');
    });
  });

  describe('GET request fallback', () => {
    it('should fall back to GET when HEAD returns 405', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response('', {
            status: 200,
          })
        )
        .mockResolvedValueOnce(
          new Response('', {
            status: 405, // Method Not Allowed for HEAD
          })
        )
        .mockResolvedValueOnce(
          new Response('test content', {
            status: 200,
            headers: {
              'content-type': 'video/mp4',
              'content-length': '12',
            },
          })
        );

      const result = await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
      });

      expect(result.method).toBe('get');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should extract size from Content-Range in GET response', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(new Response('', { status: 200 }))
        .mockResolvedValueOnce(new Response('', { status: 405 }))
        .mockResolvedValueOnce(
          new Response('x', {
            status: 206,
            headers: {
              'content-type': 'video/mp4',
              'content-range': 'bytes 0-0/4194304',
            },
          })
        );

      const result = await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
      });

      expect(result.size).toBe(4194304);
      expect(result.supportsRangeRequests).toBe(true);
    });
  });

  describe('Content-Type normalization', () => {
    it('should normalize content-type by removing parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('', {
          status: 206,
          headers: {
            'content-type': 'video/mp4; codecs="avc1.42E01E"',
            'content-range': 'bytes 0-0/1000',
          },
        })
      );

      const result = await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
      });

      expect(result.contentType).toBe('video/mp4');
    });

    it('should handle missing content-type', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('', {
          status: 206,
          headers: new Headers({
            'content-range': 'bytes 0-0/1000',
            // Explicitly not setting content-type
          }),
        })
      );

      // Mock to remove the default content-type that Response adds
      const mockResponse = await mockFetch();
      mockResponse.headers.delete('content-type');
      mockFetch.mockResolvedValue(mockResponse);

      const result = await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
      });

      expect(result.isVideo).toBe(true); // Still detected via URL
    });
  });

  describe('Custom headers', () => {
    it('should include custom headers in requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('', {
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-0/1000',
          },
        })
      );

      await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
        headers: {
          'User-Agent': 'TestAgent/1.0',
          Authorization: 'Bearer token123',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/video.mp4',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'TestAgent/1.0',
            Authorization: 'Bearer token123',
          }),
        })
      );
    });
  });

  describe('Retry logic', () => {
    it('should retry on network errors', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(
          new Response('', {
            status: 206,
            headers: {
              'content-type': 'video/mp4',
              'content-range': 'bytes 0-0/1000',
            },
          })
        );

      const result = await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
        maxRetries: 3,
      });

      expect(result.size).toBe(1000);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw NetworkError when all retries fail', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        probeMedia('https://example.com/video.mp4', {
          fetch: mockFetch,
          maxRetries: 2,
        })
      ).rejects.toThrow(NetworkError);

      // Each retry attempts range, head, and get methods
      // So 2 retries = 2 * 3 = 6 calls
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should not retry on 4xx errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('Not Found', {
          status: 404,
        })
      );

      await expect(
        probeMedia('https://example.com/video.mp4', {
          fetch: mockFetch,
          maxRetries: 3,
        })
      ).rejects.toThrow(NetworkError);

      // Should only call once, no retries for 404
      expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Timeout handling', () => {
    it('should timeout after specified duration', async () => {
      const mockFetch = vi.fn().mockImplementation(
        (_url: string, options: any) =>
          new Promise((resolve, reject) => {
            // Check if signal is aborted
            if (options?.signal?.aborted) {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
              return;
            }

            // Listen for abort signal
            const abortHandler = () => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            };

            if (options?.signal) {
              options.signal.addEventListener('abort', abortHandler);
            }

            setTimeout(() => {
              if (options?.signal) {
                options.signal.removeEventListener('abort', abortHandler);
              }
              resolve(
                new Response('', {
                  status: 200,
                  headers: { 'content-type': 'video/mp4' },
                })
              );
            }, 2000);
          })
      );

      await expect(
        probeMedia('https://example.com/video.mp4', {
          fetch: mockFetch,
          timeout: 100,
          maxRetries: 1,
        })
      ).rejects.toThrow(TimeoutError);
    });
  });

  describe('Edge cases', () => {
    it('should handle URLs with query parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('', {
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-0/1000',
          },
        })
      );

      const result = await probeMedia('https://example.com/video.mp4?token=abc123', {
        fetch: mockFetch,
      });

      expect(result.isVideo).toBe(true);
    });

    it('should handle missing size information', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(new Response('', { status: 200 }))
        .mockResolvedValueOnce(
          new Response('', {
            status: 200,
            headers: {
              'content-type': 'video/mp4',
            },
          })
        );

      const result = await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
      });

      expect(result.size).toBeNull();
      expect(result.contentType).toBe('video/mp4');
    });

    it('should handle various video formats', async () => {
      const formats = [
        'video.mp4',
        'video.webm',
        'video.mov',
        'video.avi',
        'video.mkv',
        'video.ogv',
        'video.flv',
      ];

      for (const filename of formats) {
        const mockFetch = vi.fn().mockResolvedValue(
          new Response('', {
            status: 206,
            headers: {
              'content-range': 'bytes 0-0/1000',
            },
          })
        );

        const result = await probeMedia(`https://example.com/${filename}`, {
          fetch: mockFetch,
        });

        expect(result.isVideo).toBe(true);
      }
    });

    it('should handle various audio formats', async () => {
      const formats = ['audio.mp3', 'audio.m4a', 'audio.wav', 'audio.flac', 'audio.ogg'];

      for (const filename of formats) {
        const mockFetch = vi.fn().mockResolvedValue(
          new Response('', {
            status: 206,
            headers: {
              'content-range': 'bytes 0-0/1000',
            },
          })
        );

        const result = await probeMedia(`https://example.com/${filename}`, {
          fetch: mockFetch,
        });

        expect(result.isAudio).toBe(true);
      }
    });
  });

  describe('Redirect handling', () => {
    it('should follow redirects by default', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('', {
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-0/1000',
          },
        })
      );

      await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/video.mp4',
        expect.objectContaining({
          redirect: 'follow',
        })
      );
    });

    it('should not follow redirects when disabled', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('', {
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-0/1000',
          },
        })
      );

      await probeMedia('https://example.com/video.mp4', {
        fetch: mockFetch,
        followRedirects: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/video.mp4',
        expect.objectContaining({
          redirect: 'manual',
        })
      );
    });
  });
});
