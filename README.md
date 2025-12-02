# @supadata/media-probe

Lightweight library for probing remote media assets to get their content type and size efficiently.

## Features

- 🚀 **Efficient**: Uses HTTP Range requests (1 byte) when possible
- 🔄 **Smart Fallbacks**: Range → HEAD → GET
- 📦 **Zero Dependencies**: Pure TypeScript, native `fetch`
- 🎯 **Type-Safe**: Full TypeScript support
- 🔁 **Retry Logic**: Built-in exponential backoff
- 🎬 **Media Detection**: Automatic video/audio detection
- 🛠️ **Platform Quirks**: Handles TikTok CDN misconfigurations

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

```typescript
import { probeMedia, NetworkError, TimeoutError } from '@supadata/media-probe';

try {
  const result = await probeMedia(url);
} catch (error) {
  if (error instanceof NetworkError) {
    console.error('Network error:', error.statusCode);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  }
}
```

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

## Supported Formats

**Video:** MP4, WebM, MOV, AVI, MKV, OGV, MPEG, FLV, 3GP, WMV

**Audio:** MP3, M4A, WAV, OGG, FLAC, AAC, Opus

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
