# Changelog

All notable changes to this project are documented here.

## [0.1.1] - 2026-08-24

### Added

- Explainable recommendation badges and per-dimension score breakdowns.
- Explicit input, output, and cache pricing in the provider list.
- Cache-heavy estimated savings compared with the current provider.
- One-click switching back to the previous provider.

### Changed

- Renamed the panel to “OpenRouter Provider Recommendations” / “OpenRouter 供应商推荐”.
- Polished refresh, close, provider-row, loading, success, and failure interactions.
- Replaced abrupt uptime safety bands with a continuous mild penalty curve, while retaining stronger penalties for genuinely unreliable endpoints.
- Updated the README provider-panel screenshot.

### Validation

- 75 automated tests passing.
- TypeScript typecheck and production build passing.
- `npm audit --omit=dev` reports zero vulnerabilities.

## [0.1.0] - 2026-08-24

- Initial public release.

[0.1.1]: https://github.com/xuanfengtechx/dsh-openrouter-provider-advisor/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/xuanfengtechx/dsh-openrouter-provider-advisor/releases/tag/v0.1.0
