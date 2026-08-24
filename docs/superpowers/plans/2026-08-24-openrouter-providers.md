# DSH OpenRouter Provider Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the external DSH bundle described by `docs/DESIGN.md`: rank OpenRouter endpoints for the selected model and switch the current session and default model to a provider-pinned preset.

**Architecture:** Pure modules own model matching and four-dimensional ranking. `OpenRouterClient` owns authenticated models/endpoints/preset HTTP and stale-cache behavior; `OpenRouterProviderDirectory` composes resolution and ranking. A host plugin exposes the directory through two tools and same-origin HTTP routes, while a client plugin supplies `/providers` and a live settings card.

**Tech Stack:** TypeScript ESM, Cordis/DSH extension APIs, Schema from `cordis`, native `fetch`, Vitest, tsdown.

## Global Constraints

- `recommendedCount` defaults to 5 and accepts integers 1–10; a short eligible set is never padded.
- OpenRouter data comes only from `/api/v1/models` and `/api/v1/models/{author}/{slug}/endpoints`; do not scrape HTML.
- Endpoint filters are `status === 0` and `context_length >= minContextTokens`.
- Ranking weights and price-blend weights each sum to `1.00 ± 0.001`.
- A switch runs preset upsert, DSH model upsert, current-session selection, then default selection; preset failure prevents all downstream writes.
- Do not create one DSH route per upstream provider and do not add a composer-seat button.

---

### Task 1: Package and pure domain modules

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsdown.config.ts`, `cordis.patch.yml`
- Create: `src/types.ts`, `src/config.ts`, `src/resolve-model.ts`, `src/score.ts`
- Test: `tests/resolve-model.spec.ts`, `tests/score.spec.ts`, `tests/fixtures/endpoints.ts`

**Interfaces:**
- Produces: `normalizeModelName(value: string): string`, `resolveOpenRouterModel(input, catalog): ResolveResult`, `rankEndpoints(endpoints, config, currentTag?): RankedProviders`, `validateConfig(config): void`.

- [ ] Write resolver tests for preset prefixes, provider suffixes, non-OpenRouter routes, unique/fuzzy/ambiguous/no matches.
- [ ] Run `npm test -- tests/resolve-model.spec.ts` and confirm missing-module failure.
- [ ] Implement deterministic normalization and catalog matching returning discriminated results instead of throwing for user-correctable outcomes.
- [ ] Write fixture-backed ranking tests for filters, score math, tie-breaks, uptime penalty, current marker, configurable count, and invalid sums/ranges.
- [ ] Run `npm test -- tests/score.spec.ts` and confirm missing-module failure.
- [ ] Implement ranking and validation, then run both test files and `npm run typecheck`.

### Task 2: OpenRouter transport and directory

**Files:**
- Create: `src/openrouter.ts`, `src/directory.ts`
- Test: `tests/openrouter.spec.ts`, `tests/directory.spec.ts`

**Interfaces:**
- Produces: `OpenRouterClient.listModels()`, `getEndpoints(modelId, { refresh? })`, `upsertPreset(modelId, tag)`, `clearEndpoints(modelId)`; `OpenRouterProviderDirectory.recommend(input)` and `refresh(input)`.

- [ ] Write tests proving bearer auth, URL encoding, API shape validation, 300-second endpoint caching, forced refresh, and stale-cache fallback after non-2xx.
- [ ] Run the transport tests and confirm expected failures.
- [ ] Implement injected-`fetch` transport and cache; never access reference-page HTML.
- [ ] Write directory tests for missing credentials, non-OpenRouter route, ambiguous/no model, empty eligible list, and successful canonical response.
- [ ] Run failing directory tests, implement the orchestration, and rerun the task suite.

### Task 3: Provider application transaction

**Files:**
- Create: `src/apply-provider.ts`
- Test: `tests/apply-provider.spec.ts`

**Interfaces:**
- Produces: `applyProvider(deps, { sessionId, route, model, endpoint, openrouterModel, reasoningEffort }): Promise<SwitchResult>`.

- [ ] Write tests asserting preset body (`provider.order=[tag]`, `allow_fallbacks=false`), generated slug, exact `llm-pi-ai.providers.<route>.models` mutation, copied reasoning efforts, `session.selectModel` arguments, and `saveSelection` arguments.
- [ ] Add failure-order tests: preset failure performs no settings/session writes; settings failure performs no session write; select failure returns the documented partial-state error.
- [ ] Run tests red, implement the ordered operation without rollback, then run green.

### Task 4: Host plugin, routes, and tools

**Files:**
- Create: `src/host-routes.ts`, `src/tools.ts`, `src/index.ts`
- Test: `tests/host-routes.spec.ts`, `tests/tools.spec.ts`, `tests/index.spec.ts`

**Interfaces:**
- Produces: same-origin `GET /api/openrouter-providers/recommend`, `POST /refresh`, `POST /apply`; tools `recommend_openrouter_providers` and `switch_openrouter_provider`; plugin exports `name`, `inject`, `Config`, `apply`.

- [ ] Write route contract tests for validation, status mapping, canonical response JSON, session-addressed-subagent rejection, and apply errors.
- [ ] Write tool tests proving optional provider/model fallback to execution-session context, `recommended.length <= recommendedCount`, rendered Top rows, and validation that a switch tag is currently eligible.
- [ ] Run red tests; register all resources inside `ctx.effect`; implement routes/tools and run green.

### Task 5: `/providers` client command

**Files:**
- Create: `src/client/providers-command.ts`, `src/client/index.ts`
- Test: `tests/client/providers-command.spec.ts`

**Interfaces:**
- Produces: a client-owned `/providers` `popupSelect` whose `options` loads recommendations and whose `onSelect` posts `{sessionId, tag}`.

- [ ] Write browser-contract tests for ordinary-session availability, addressed-subagent exclusion, recommended/rest grouping, current marker, exact price units, refresh option, and non-mutating error notices.
- [ ] Run tests red, implement against the official `commandUi` and connection/remote APIs, then rerun green.

### Task 6: Live settings card

**Files:**
- Create: `src/client/settings-card.ts`
- Test: `tests/client/settings-card.spec.ts`

**Interfaces:**
- Produces: `settings.plugin.item` contribution keyed `openrouter-providers`, editing every field in `Config` with `applies: 'live'`.

- [ ] Write tests for default values, numeric bounds, both sum validations, failed-write messages, and live mutation payload.
- [ ] Run red tests, implement the card and shared validation, then run green.

### Task 7: Packaging, documentation, and completion audit

**Files:**
- Modify: `package.json`, `docs/DESIGN.md`
- Create: `README.md`

**Interfaces:**
- Produces: installable host/client bundle with package exports matching the design.

- [ ] Build with `npm run build` and inspect generated host, client, and declaration exports.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build` from a clean process.
- [ ] Document install/development commands, credential requirement, menu/tools, score settings, partial-failure behavior, provider-side KV-cache invalidation, and manual OpenRouter smoke test.
- [ ] Compare every section of `docs/DESIGN.md` to code/tests/build artifacts; record or close every gap before completion.

