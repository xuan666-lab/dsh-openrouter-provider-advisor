# Provider Table and DSH Locale Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add aligned provider-list headers and make all client UI follow DSH's live Chinese/English locale.

**Architecture:** A typed client locale module owns dictionaries and lookup. The plugin attaches and registers with DSH's `ctx.locale`; React slot components subscribe to that service and render translated copy. Provider group headers and rows share one exported grid layout.

**Tech Stack:** TypeScript, React `createElement`/`useSyncExternalStore`, Vitest, DSH client locale service.

## Global Constraints

- Follow DSH locale automatically; do not add a plugin language preference.
- Support `zh` and `en`; unknown locales fall back to English.
- Do not change scoring, routing, model resolution, or session mutation behavior.
- Do not read conversation messages.
- Repository has no Git metadata, so commit steps are not applicable.

---

### Task 1: Typed locale service

**Files:**
- Create: `src/client/locales.ts`
- Test: `tests/client-locales.test.ts`

**Interfaces:**
- Produces: `LOCALE_NS`, `zh`, `en`, `attachLocale(service)`, `t(key)`, `subscribeLocale(listener)`, and `getLocaleSnapshot()`.

- [ ] Write tests proving Chinese lookup, English lookup, non-Chinese fallback, and subscription forwarding.
- [ ] Run `npm test -- tests/client-locales.test.ts` and confirm failure because the module does not exist.
- [ ] Implement the typed dictionaries and small adapter functions.
- [ ] Run `npm test -- tests/client-locales.test.ts` and confirm all locale tests pass.

### Task 2: Localized table headers and panel copy

**Files:**
- Modify: `src/client/provider-panel.ts`
- Modify: `src/client/index.ts`
- Test: `tests/provider-panel.test.ts`
- Test: `tests/client-entry.test.ts`

**Interfaces:**
- Consumes: locale functions from Task 1 and DSH `ctx.locale` with `getSnapshot`, `subscribe`, and `register`.
- Produces: `providerGridColumns` shared by header and row rendering.

- [ ] Add failing tests for Chinese and English labels, three column headers, shared grid columns, locale injection, and dictionary registration.
- [ ] Run the two focused test files and confirm the new expectations fail.
- [ ] Add locale subscription to the trigger and overlay, translate all panel copy, and render one aligned header per provider group.
- [ ] Attach/register the locale service in the client entry and dispose registrations correctly.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Localized settings copy

**Files:**
- Modify: `src/client/settings-card.ts`
- Test: `tests/settings-card.test.ts`

**Interfaces:**
- Consumes: `t()` and locale subscription functions from Task 1.

- [ ] Add failing assertions for Chinese and English settings headings, descriptions, field labels, and action labels.
- [ ] Run `npm test -- tests/settings-card.test.ts` and confirm the localization assertions fail.
- [ ] Subscribe the settings card to DSH locale and replace hard-coded user-facing strings with typed translation keys.
- [ ] Run the focused test and confirm it passes.

### Task 4: Full verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/VERIFICATION.md`

- [ ] Document live DSH locale following, supported languages, table headers, and the session-data privacy boundary.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and `npm pack --dry-run`.
- [ ] Reinstall/reload the linked local plugin and restart the DSH web profile.
- [ ] Use browser QA to verify Chinese and English switching, table alignment, current-provider status, and narrow-panel behavior.
