# @supadata/media-probe

Lightweight library for probing remote media assets to get their content type and size efficiently.

## Features

- 🚀 **Efficient**: Uses HTTP Range requests (1 byte) when possible
- 🔄 **Smart Fallbacks**: Range → HEAD → GET
- 🎯 **Type-Safe**: Full TypeScript support
- 🔁 **Retry Logic**: Built-in exponential backoff
- 🎬 **Media Detection**: Automatic video/audio detection
- 🛠️ **Platform Quirks**: Handles TikTok CDN misconfigurations
- ⏱️ **Duration Extraction**: Opt-in `extractMediaDuration()` reads container metadata via Range fetch (mp4, webm, mp3, m4a, ogg, opus, flac)

## Installation

```bash
npm install @supadata/media-probe
# or
pnpm add @supadata/media-probe
```

## Quick Start

```typescript
import { probeMedia } from '@supadata/media-probe';

const result = await probeMedia('https://example.com/video.mp4');

console.log(result);
// {
//   contentType: 'video/mp4',
//   size: 1048576,
//   supportsRangeRequests: true,
//   isVideo: true,
//   isAudio: false,
//   method: 'range'
// }
```

## Usage

### Basic Options

```typescript
const result = await probeMedia('https://example.com/audio.mp3', {
  maxRetries: 5,
  timeout: 15000,
  headers: { 'User-Agent': 'MyApp/1.0' },
});
```

### Platform Quirks Mode (TikTok CDN)

Some CDNs return incorrect content-type headers. Enable `allowPlatformQuirks` to auto-correct:

```typescript
// TikTok CDN may return 'video/mp4' for MP3 files
const result = await probeMedia(tiktokUrl, {
  allowPlatformQuirks: true, // Checks mime_type query parameter
});

// Without quirks: contentType = 'video/mp4' (incorrect)
// With quirks:    contentType = 'audio/mpeg' (correct)
```

### Error Handling

The library provides specific error types for different failure scenarios:

```typescript
import {
  probeMedia,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  ClientError,
  ServerError,
  TimeoutError,
} from '@supadata/media-probe';

try {
  const result = await probeMedia(url);
  console.log('Media found:', result);
} catch (error) {
  // Handle specific HTTP errors
  if (error instanceof NotFoundError) {
    console.error('Media does not exist (404)');
  } else if (error instanceof ForbiddenError) {
    console.error('Access forbidden (403) - check permissions');
  } else if (error instanceof UnauthorizedError) {
    console.error('Authentication required (401)');
  } else if (error instanceof ClientError) {
    console.error('Client error (4xx):', error.statusCode);
  } else if (error instanceof ServerError) {
    console.error('Server error (5xx):', error.statusCode, '- might be temporary');
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  }
}
```

**Error Hierarchy:**

```text
ProbeError (base)
├── InvalidUrlError
├── NetworkError
│   ├── ClientError (4xx errors - won't be retried)
│   │   ├── NotFoundError (404)
│   │   ├── ForbiddenError (403)
│   │   └── UnauthorizedError (401)
│   └── ServerError (5xx errors - will be retried)
├── TimeoutError (will be retried)
└── MaxRetriesExceededError
```

**Retry Behavior:**

- ✅ **Retried:** Server errors (5xx), timeouts, network failures
- ❌ **Not Retried:** Client errors (4xx), invalid URLs

The library intelligently tries all three methods (Range → HEAD → GET) before failing, ensuring maximum compatibility.

### Batch Processing

```typescript
const urls = ['video1.mp4', 'audio1.mp3', 'video2.webm'];
const results = await Promise.all(urls.map(url => probeMedia(url)));
```

### Utility Functions

```typescript
import { isVideoContent, isAudioContent, normalizeContentType } from '@supadata/media-probe';

isVideoContent('video/mp4', 'file.mp4'); // true
isAudioContent(null, 'file.mp3'); // true (detected from extension)
normalizeContentType('video/mp4; codecs="avc1"'); // 'video/mp4'
```

## API

### `probeMedia(url, options?)`

Returns `Promise<ProbeResult>`

**Options:**

```typescript
interface ProbeOptions {
  maxRetries?: number;            // Default: 3
  timeout?: number;               // Default: 10000ms
  headers?: Record<string, string>;
  followRedirects?: boolean;      // Default: true
  allowPlatformQuirks?: boolean;  // Default: false
  fetch?: typeof fetch;           // Custom fetch implementation
}
```

**Result:**

```typescript
interface ProbeResult {
  contentType: string | null;
  size: number | null;
  supportsRangeRequests: boolean;
  isVideo: boolean;
  isAudio: boolean;
  method: 'range' | 'head' | 'get';
}
```

### Duration Extraction

`extractMediaDuration` reads container-level metadata (mp4 `moov` atom, EBML SegmentInfo, mp3 Xing/Info, etc.) by Range-fetching the file header and parsing it with [`music-metadata`](https://www.npmjs.com/package/music-metadata). It's separate from `probeMedia` so callers only pay the extra ~1 MB fetch when they actually need duration.

```typescript
import { probeMedia, extractMediaDuration } from '@supadata/media-probe';

const probe = await probeMedia(url);

if (probe.isVideo || probe.isAudio) {
  const { duration, method, container, bitrate } = await extractMediaDuration(url, {
    // Pass hints from the cheap probe so we can bail early on unparseable
    // content types without making a network call.
    contentType: probe.contentType,
    fileSize: probe.size,
    // Re-use the same fetch (e.g. a proxied one) to keep egress consistent
    // — useful when the CDN ip-binds signed URLs to the original fetcher.
    fetch: myProxiedFetch,
  });

  if (duration !== null) {
    console.log(`${duration}s — extracted via ${method} (${container})`);
  }
}
```

**Strategy:**

1. **Head Range** (`bytes=0-1048575`): covers fast-start mp4, webm, mp3, m4a, ogg.
2. **Head + Tail Range** (`bytes=(size-524288)-(size-1)`): fallback for mp4 with `moov` at end. Requires the `fileSize` hint.

Never throws on extraction failure — returns `{duration: null, method: null}` so callers can fall back to their own heuristic.

## Supported Formats

**Video:** MP4, WebM, MOV, AVI, MKV, OGV, MPEG, FLV, 3GP, WMV

**Audio:** MP3, M4A, WAV, OGG, FLAC, AAC, Opus

**Duration extraction** (`extractMediaDuration`): MP4/M4A/QuickTime, WebM, MP3, OGG/Opus, FLAC.

## Real-World Examples

### Check Streaming Support

```typescript
const result = await probeMedia(videoUrl);
if (result.supportsRangeRequests) {
  console.log('Video supports streaming/seeking');
}
```

### Estimate Download Time

```typescript
const result = await probeMedia(url);
const sizeInMB = result.size / (1024 * 1024);
const timeInSeconds = (sizeInMB * 8) / bandwidthMbps;
```

### Format Detection

```typescript
const result = await probeMedia(url);
if (result.isVideo) {
  await processVideo(url);
} else if (result.isAudio) {
  await processAudio(url);
}
```

## Requirements

- Node.js 18.0.0 or higher (native `fetch` support)

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Type check
pnpm type-check

# Build
pnpm build
```

## License

MIT
