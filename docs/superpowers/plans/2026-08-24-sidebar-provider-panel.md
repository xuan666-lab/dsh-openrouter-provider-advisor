# Sidebar Provider Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/providers` client command with a permanent sidebar footer trigger and provider overlay.

**Architecture:** A framework-independent `ProviderPanelStore` owns open/loading/applying/error state and Host API calls. Two small React faces share it: a `sidebar.footer.action` trigger and a `shell.overlay` panel. Existing Host routes, ranking, switching, tools, and settings remain unchanged.

**Tech Stack:** TypeScript, React 18, DSH client slots, Vitest, agent-browser.

## Global Constraints

- Register exactly one `sidebar.footer.action` and one `shell.overlay` entry.
- Do not register `/providers` through `commandUi`.
- Preserve Top 5 grouping, current marking, complete eligible list, and existing `/refresh` and `/apply` protocols.
- Do not select a live provider during automated browser verification.

---

### Task 1: Provider panel state

**Files:**
- Create: `src/client/provider-panel-store.ts`
- Test: `tests/provider-panel-store.spec.ts`

**Interfaces:**
- Produces: `ProviderPanelStore`, `ProviderPanelSnapshot`, `createProviderPanelStore(fetch?)` with `toggle`, `open`, `close`, `refresh(sessionId)`, and `apply(sessionId, tag)`.

- [ ] Write tests asserting load success, refresh protocol, apply protocol, close-on-success, and error preservation.
- [ ] Run `npm test -- tests/provider-panel-store.spec.ts` and confirm the missing module failure.
- [ ] Implement the store with latest-request-wins generation fencing and abort support.
- [ ] Run the focused tests until green.

### Task 2: Sidebar trigger and overlay

**Files:**
- Create: `src/client/provider-panel.ts`
- Modify: `src/client/index.ts`
- Test: `tests/provider-panel.spec.ts`

**Interfaces:**
- Consumes: one shared `ProviderPanelStore` and `ctx.sessions` active session state.
- Produces: `ProviderSidebarTrigger`, `ProviderOverlay`, and slot registrations with ids `openrouter-providers-trigger` and `openrouter-providers-overlay`.

- [ ] Write pure view-model tests for Top 5/rest row labels, current state, and disabled trigger state.
- [ ] Run the focused test and confirm failure before implementation.
- [ ] Implement accessible React components and register `sidebar.footer.action` plus `shell.overlay`.
- [ ] Remove `providerCommand` registration and all `commandUi` imports/injection.
- [ ] Run focused tests and typecheck.

### Task 3: Package and live verification

**Files:**
- Modify: `package.json`, `README.md`, `docs/DESIGN.md`, `docs/VERIFICATION.md`
- Delete: `src/client/providers-command.ts`, `tests/providers-command.spec.ts`

**Interfaces:**
- Produces: a client bundle depending on runtime, sidebar, slots/settings services, but not ui-commands.

- [ ] Update `dsh.client.inject`, documentation, and bundle tests/searches.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and `npm pack --dry-run`.
- [ ] Restart `dsh web`, verify the sidebar button and overlay in a real browser, and inspect console errors.
- [ ] Confirm `/providers` is absent from command candidates and no live provider was selected.
