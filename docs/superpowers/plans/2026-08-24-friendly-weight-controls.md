# Friendly Linked Weight Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace seven raw decimal inputs with understandable linked percentage controls while clearly documenting which ranking profiles they affect.

**Architecture:** A pure `rebalanceWeights` function maintains a unit sum by proportionally redistributing changes across unlocked peers. A reusable React weight-group component renders a segmented overview, sliders, percentage inputs, locks, reset/apply actions, and scope copy. The settings card keeps unrelated scalar settings separate and shows built-in strategy weights in a read-only disclosure.

**Tech Stack:** TypeScript, React, Vitest, DSH settings scope and locale service.

## Global Constraints

- Balanced ranking weights are editable and affect only `balanced`.
- Price blend is editable and affects every ranking strategy.
- Price blend defaults to 2% input, 8% output, and 90% cache.
- Every normalized group must remain non-negative and sum to exactly 1 within floating-point precision.
- Locked peers do not move; unlocked peers redistribute proportionally.
- All new copy supports Chinese and English.
- No scoring API or persisted config shape changes.

---

### Task 1: Linked weight algorithm

**Files:**
- Create: `src/client/linked-weights.ts`
- Test: `tests/linked-weights.spec.ts`

- [ ] Add failing tests for proportional redistribution, locked peers, clamping to remaining capacity, zero-valued peers, and exact unit totals.
- [ ] Run `npm test -- tests/linked-weights.spec.ts` and confirm the missing module failure.
- [ ] Implement `rebalanceWeights(values, changedKey, nextValue, lockedKeys)` and `percent(value)`.
- [ ] Run the focused test and confirm all cases pass.

### Task 2: Weight group UI and profile explanation

**Files:**
- Create: `src/client/weight-group.ts`
- Modify: `src/client/settings-card.ts`
- Modify: `src/client/i18n.ts`
- Test: `tests/settings-card.spec.ts`

- [ ] Add failing tests for localized section titles/scope text and built-in strategy summaries.
- [ ] Render two cards with a segmented overview, linked range/percentage controls, per-row locks, reset, and atomic apply.
- [ ] Keep context floor, count, TTL, and uptime settings in a separate compact advanced section.
- [ ] Add a collapsed, read-only table for price/speed/context built-in scoring weights.
- [ ] Run focused settings and locale tests.

### Task 3: Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/VERIFICATION.md`

- [ ] Document balanced-only weights and global price blending.
- [ ] Run full tests, typecheck, build, and dry-run packaging.
- [ ] Verify linked sliders, locks, reset/apply, strategy explanation, and both languages in a temporary DSH web instance.
