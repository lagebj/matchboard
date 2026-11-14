# Gate C W2 — Blockers and Known Limitations

## Genuine source gaps (not fixed, disclosed)

- **C06 position precision**: Round Board has no exact tactical-position field anywhere in its data model. The 24-code/14-code contrast the register's acceptance question names belongs to the separate Lineup/Formation editor. See `POSITION_VOCABULARY_AND_PRECISION.md`. Disposition: `BLOCKED_BY_SOURCE_OR_AUTHORITY`.

## Pre-existing, documented, not remediated here

- **Issue #827** (ADR-0159 Visual Authority fingerprint invalidation from a shared-fixture edit) remains open and separately tracked. This wave avoided reproducing its trigger (see `DATA_TRUTH_AND_FIXTURES.md`'s "new, not reused" fixture architecture) but did not fix the underlying fingerprinting behavior.
- **Allocation matrix unreachable in any closed-boundary round**: a real, low-severity consequence of existing gating (the Board/Allocation toggle only renders when `planningBoundaryOpen` is true, which requires every match open) — see `CURRENT_STATE_AUDIT.md` item 5. Not a defect; `handleMatrixToggle`'s own `isFinalized` guard is simply unreachable in production as currently gated. Not fixed — out of this wave's bounded scope.
- **No distinct error surfaced for a rejected assignment**: `movePlayerToMatch`'s callers (`handleDropOnMatch`, `handleAssignSuggestion`, `handleTouchDrop`) call `router.refresh()` unconditionally after `addPlayerToMatchAction`/`removePlayerFromMatchAction`, regardless of the result's `success`/`errors`. A real server-side rejection today produces no visible message to the coach — just no visible change. C06's `buildC06WithDeniedAssignmentFixture` proves the *fixture* layer doesn't fake a success (state genuinely doesn't change), which is what the brief asks for ("show... rejection... outcomes truthfully"), but it does not add a UI-level error toast, because that would be a materially larger behavioral change than this wave's bounded corrections and is not named in any C04-C06 acceptance question. Worth a future small UX pass; recorded here rather than silently fixed or silently ignored.

## Verification run locally in this devcontainer

- `npm run typecheck`, `npm run lint`, `npx vitest run --config vitest.config.components.ts` (full suite, 166 files / 1066 tests passed), and the default-config suite for `src/lib/selection`, `src/lib/touchline`, `src/components/round`, `src/components/touchline/round-board` (56 files / 590 tests passed) — all green, no regressions.
- Full Playwright/real-browser capture was **not** run locally: this devcontainer has a documented, pre-existing HMR/WebSocket issue that blocks `next dev` + Playwright from hydrating, reproducing on untouched pages too (see project memory `project_devcontainer_hmr_websocket_blocks_playwright`). Real Chromium capture evidence comes from this PR's CI run (`ui-lab-visual-review.yml`), exactly as Gate C W1 disclosed for the same reason — see `capture-attestation.json`'s `knownLimitations`.

## Not started (explicit scope exclusion, per the brief)

C07 (Today Assistant Coach OFF/ON), C08 (same-day quick add), any Lineup/Tactics formation editor work, any rewrite of existing assignment mutations, a general Round Board redesign beyond C04-C06, a second opportunity engine, and issue #827 remediation.
