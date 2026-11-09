# Gate C W1 — Changed Files

## Second remediation pass (second independent review of PR #826 — P1-04, P1-05)

### Production (narrow correction of the first remediation's own P1-03 fix)

- `src/components/touchline/today/today-surface.tsx` — corrected the context-rail suppression
  conditions: organisation-wide squad availability is suppressed only when the quiet-day hero is
  *actually* showing the identical fact inline (not whenever a Matchday anchor exists); carry-
  forward is suppressed only for the one item the quiet-day hero features (`.slice(1)`, not the
  whole collection).
- `src/components/touchline/today/today-context-rail.tsx` — new optional `squadStatusTitle`
  prop, forwarded to the existing `SquadReadinessWidget`'s own `title` override (no new widget);
  used to disambiguate organisation-wide availability from Matchday's own match-specific
  readiness when both are on the page.

### Test coverage

- `src/components/touchline/today/__tests__/today-surface.matchday-quiet-composition.test.tsx` —
  the former P1-03 "context rail duplication" describe block (4 tests, asserting the now-corrected-away
  behavior) replaced with two describe blocks: P1-04 (6 tests) and P1-05 (7 tests) — 19 tests
  total in the file.
- Gate C fixtures enhanced to exercise both fixes in real candidates, not only production unit
  tests: C01's `carryForwardItems` now carries three items (was one); all six C03 scenarios now
  pass a fixed, deliberately-different-from-match-readiness `squadStatus`
  (`gateCBuildBusyDay()`'s new return field).
- `e2e/ui-lab-gate-c.spec.ts` — new `test.describe` block with 4 desktop/mobile Playwright tests
  proving both fixes in a real browser.

### Documentation

- `CURRENT_STATE_AUDIT.md`, `INFORMATION_OWNERSHIP_MATRIX.md`, `DATA_TRUTH_AND_FIXTURES.md`,
  `INTERACTION_AND_STATE_AUDIT.md`, `VISUAL_VS_CURRENT.md`, `REVIEW_RECORD.md` — updated to
  record P1-04/P1-05 and why the first P1-03 fix was itself wrong, with the corrected ownership
  model (same data vs. related-but-different-scope data).
- `candidate_manifest.json` — `fixtureVersion` bumped again for C01 and all six C03 candidates
  (C02 unaffected — no Matchday anchor, no squad/carry-forward props); `componentOwners` for
  those seven candidates now include `today-context-rail.tsx`.
- `capture-attestation.json` — regenerated against this pass's own CI run; the prior
  (first-remediation) evidence is not reused, since rendering changed again.

## First remediation pass (first independent review — P1-01, P1-02, P1-03, P2-01, P2-02, P2-03)

- Production: `today-surface.tsx`, `today-quiet-state.tsx` (P1-01, P1-02, and the original,
  since-corrected P1-03).
- New test file: `today-surface.matchday-quiet-composition.test.tsx` (10 tests at the time).
- Rewritten Gate C fixtures and tests for P2-01 (fixed clock), P2-02 (org-scoped hrefs), P2-03
  (identity collision) — see git history for the exact diff; superseded in content (not in
  existence) by the second pass above.
- Rewritten `e2e/ui-lab-gate-c.spec.ts` for the same reasons.

## Original wave (first pass, PR #826 initial commits)

- New: 8 UI Lab candidate routes + fixtures + tests under `src/app/dev/ui-lab/gate-c/`.
- New: full documentation set under `docs/ui-lab/gate-c-w1-candidates/`.
- New: `e2e/ui-lab-gate-c.spec.ts`.
- Modified: `scripts/ui-lab-visual-review.mjs`, `playwright.config.ts`,
  `.github/workflows/ui-lab-visual-review.yml`, `AGENTS.md` (auto-generated block).

## Not changed, across all three passes

No file under `src/lib/touchline/presentation/*`, `today-operational-timeline.tsx`,
`today-matchday.tsx`, `today-quiet-state.tsx`'s own internal carry-forward slicing, or
`today-carry-forward.ts`/`get-org-active-player-availability.ts` (the underlying adapters) is
modified — every fix is in what `today-surface.tsx` computes and passes to otherwise-unchanged
components. No database migration, no new route outside `/dev/ui-lab`, no change to Today's
primary navigation, no change to any other Gate's approved candidates or documentation, no
change to Gate B's shared fixture files (issue #827, left untouched).
