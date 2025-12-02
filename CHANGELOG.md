# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Platform Quirks Mode**: New `allowPlatformQuirks` option to handle CDN misconfigurations
- **TikTok CDN Support**: Automatically corrects incorrect content-type headers by checking `mime_type` query parameters
- Platform quirks utilities (`applyPlatformQuirks`, `getQuirkReason`)
- Comprehensive tests for platform quirks (12 new unit tests)
- Integration tests demonstrating quirks mode with real TikTok CDN URLs

### Changed
- Tests reorganized into `__tests__/` directory for better structure
- Integration tests now include both with and without quirks mode scenarios

## [0.1.0] - 2024-12-02

### Added
- Initial release
- Efficient media probing using Range requests
- Smart fallbacks (Range → HEAD → GET)
- TypeScript support with comprehensive types
- Retry logic with exponential backoff
- Media detection (video/audio) from content-type and URLs
- Custom fetch implementation support
- Timeout handling
- Full test coverage (47 tests)
- Integration tests with real media assets (R2, TikTok CDN)
- Comprehensive documentation
