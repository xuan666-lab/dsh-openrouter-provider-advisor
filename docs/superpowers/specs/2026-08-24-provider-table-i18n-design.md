# Provider Table and DSH Locale Integration Design

## Goal

Make the provider recommendation list easier to scan with explicit column headers, and make every user-facing client string switch live between Chinese and English with DSH.

## Scope

- Follow the active DSH locale through the official `ctx.locale` client service.
- Register plugin-owned `zh` and `en` dictionaries under a unique namespace.
- Translate the sidebar trigger, provider dialog, recommendation strategies, table groups and headers, status/error copy, and settings card.
- Render recommendation rows as a three-column table-like grid: provider, details, and score/status.
- Keep the existing provider scoring, API routes, model selection, and apply behavior unchanged.
- Continue reading only the active session identity and model metadata; do not fetch conversation messages.

## Client Architecture

Create a focused `src/client/locales.ts` module containing typed Chinese and English dictionaries, locale attachment, and `t()` lookup. `src/client/index.ts` injects the `locale` service, registers both dictionaries, and cleans up registrations on disposal. Components subscribe to the locale snapshot with `useSyncExternalStore`, so a DSH language switch immediately re-renders plugin UI.

The panel and settings components receive or access the attached locale service without storing a separate language preference. Chinese locales use the Chinese dictionary; every other DSH locale falls back to English.

## Provider List Layout

Each recommendation group has one header row aligned with its provider rows:

| Provider | Details | Score |
| --- | --- | --- |
| GMICloud | fp8 · 49 t/s · $0.0672/$0.1344 · 1,048,575 ctx | 72.7 |

Chinese labels are `供应商`, `规格详情`, and `分数`. The score cell continues to show `当前` / `Current` for the active provider. The grid uses the same column template for headers and rows. On narrow viewports, the details column can shrink and truncate while provider and score remain visible.

## Errors and Fallbacks

- Unknown or missing DSH locale falls back to English.
- Translation keys are compile-time constrained by the Chinese dictionary.
- Server-returned error details remain intact; only plugin-authored surrounding error copy is translated.
- Locale changes do not trigger recommendation API calls or reset panel state.

## Verification

- Unit tests cover Chinese/English lookup and fallback.
- Component tests cover localized column headers and strategy labels.
- Type checking ensures every English key matches the Chinese dictionary.
- Build verifies the locale dependency is resolved by the DSH client runtime.
- Browser QA verifies table alignment and live DSH language switching.
