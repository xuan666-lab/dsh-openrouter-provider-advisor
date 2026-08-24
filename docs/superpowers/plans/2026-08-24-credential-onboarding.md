# DSH Credential Reuse and Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse credentials already bound to DSH OpenRouter providers and expose safe connection onboarding without leaking secrets.

**Architecture:** Resolve each OpenRouter route's `apiKeyEnv` through `ctx.credentials`, falling back to `OPENROUTER_API_KEY` only for compatibility. A value-free connection endpoint exposes route/ref/configured metadata to the settings card and model catalog. The panel remains accessible for explanation while credential-dependent actions stay disabled.

**Tech Stack:** TypeScript, DSH credentials/settings services, React, Vitest.

## Global Constraints

- Never return or render credential values.
- Prefer the selected DSH provider profile's `apiKeyEnv`.
- Fall back to `OPENROUTER_API_KEY` only when the profile reference is absent or unconfigured.
- Missing credentials must not prevent plugin or settings UI activation.
- Do not manage `DEEPSEEK_BASE_URL`; document DSH's launch-environment rule.

### Task 1: Provider-aware credential resolution

- [ ] Add failing controller and adapter tests for profile reference, fallback, and missing status.
- [ ] Resolve credentials after selecting the DSH provider route.
- [ ] Add a value-free controller connection summary.

### Task 2: Host and client status

- [ ] Add a failing `/connection` route test and missing-credential panel-store test.
- [ ] Return credential status in model catalog and prevent recommendation calls when unconfigured.
- [ ] Render localized settings connection state and panel onboarding warning.

### Task 3: Documentation and verification

- [ ] Document DSH provider credential reuse and `.env` launch-variable restrictions.
- [ ] Run unit tests, typecheck, build, package dry-run, and real DSH browser QA.
