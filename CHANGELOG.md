# Changelog

All notable changes to this project are documented here.

## [0.1.4] - 2026-09-04

### Fixed

- Compatible with DSH web `>= 0.1.2-rc.1` again after the breaking client/Host
  API changes in that release. The previous build failed to load on current
  DSH because it imported `settingsNamespace` / `installSettingsSection` from
  `@deepseek-ai/dsh-settings` (both removed in 0.1.2) and injected the removed
  `apiProxy` service.
- Host: the OpenRouter settings namespace is now registered through
  `ctx.settings.register(...)` and read through its live owner scope
  (`dsh >= 0.1.2` settings API), replacing the removed helper functions.
- Host: session model catalog reads and session model selections now go
  through `ctx.sessionController.modelCatalog()` / `selectModel(...)`
  (the Session business API that replaced the `apiProxy` RPC service).
- Client: dropped every import from the removed `@deepseek-ai/dsh-client-*`
  type packages (including `dsh-client-runtime`); the bundle now types the
  runtime structurally, like current first-party/external plugins.
- Client: `sidebar.footer.action` / `shell.overlay` seats no longer inject a
  `useSessions` render prop, so the trigger and overlay read the current
  session from the root `sessions` service's list store instead.
- Manifest: `dsh.plugin.json` engine floor raised to `>= 0.1.2-rc.1`, and the
  client module injection list narrowed to the modules current DSH serves.

### Validation

- 80 automated tests passing (adapter specs updated to the
  `sessionController` seam).
- TypeScript typecheck and production build passing.
- `npm audit --omit=dev` reports zero vulnerabilities.

## [0.1.3] - 2026-08-25

### Changed

- Updated npm `repository`, `homepage`, and `bugs` metadata after the GitHub account was renamed from `xuanfengtechx` to `xuan666-lab`, allowing DSH Store to associate the published package with the current repository URL.

### Validation

- Automated tests, TypeScript typecheck, and production build passing.
- `npm audit --omit=dev` reports zero vulnerabilities.

## [0.1.2] - 2026-08-24

### Added

- Switch history with the provider pair and before/after throughput of each switch, persisted across sessions and offering one-click revert.
- Recommendation freshness line showing how long ago the ranking data was fetched.

### Changed

- The panel now remembers the last ranking strategy across close, reopen, and reload instead of resetting to Best overall.
- Applying a provider removes the plugin's own stale `@preset/` entries for the same OpenRouter model, so repeated switching no longer accumulates near-duplicate models. User-authored model entries are left untouched.
- Neutral panel colors follow the host `--dsw-alias-*` theme tokens, with the previous dark values as fallbacks.

### Fixed

- The provider dialog closes on Escape, traps Tab focus inside itself, and returns focus to the trigger button on close.

### Validation

- 79 automated tests passing.
- TypeScript typecheck and production build passing.
- `npm audit --omit=dev` reports zero vulnerabilities.

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

[0.1.3]: https://github.com/xuan666-lab/dsh-openrouter-provider-advisor/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/xuan666-lab/dsh-openrouter-provider-advisor/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/xuan666-lab/dsh-openrouter-provider-advisor/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/xuan666-lab/dsh-openrouter-provider-advisor/releases/tag/v0.1.0
