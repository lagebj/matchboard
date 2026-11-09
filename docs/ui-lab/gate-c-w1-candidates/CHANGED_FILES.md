# Gate C W1 — Changed Files

## Remediation pass (independent review of PR #826)

### Production (new in this pass — narrow, justified, regression-tested; see `CURRENT_STATE_AUDIT.md`)

- `src/components/touchline/today/today-surface.tsx` — P1-01 (`showHero` pass-through), P1-02
  (`showOperationalTimeline`), P1-03 (context-rail squad-readiness/carry-forward suppression),
  P2-01 (`nowIso?: string` prop, preserving exact existing behavior when omitted).
- `src/components/touchline/today/today-quiet-state.tsx` — new `showHero: boolean` prop (P1-01).

### New production regression tests

- `src/components/touchline/today/__tests__/today-surface.matchday-quiet-composition.test.tsx` —
  10 tests covering P1-01/P1-02/P1-03 directly against `TodaySurface`.

### Rewritten Gate C fixtures and tests

- `src/app/dev/ui-lab/gate-c/shared/fixtures.ts` — `gateCBuildBusyDay()` (replaces the old
  `gateCBuildMatchdayContext()`), the fixed `GATE_C_NOW_ISO` reference clock, `gateCOrgUrl()`.
- `src/app/dev/ui-lab/gate-c/shared/today-mount.tsx` — threads `nowIso` through.
- `src/app/dev/ui-lab/gate-c/shared/__tests__/fixtures.test.ts` — new; P2-01 determinism/phase/
  date-eligibility proofs.
- `src/app/dev/ui-lab/gate-c/c01-quiet-day/{fixtures.ts,page.tsx,__tests__/page.test.tsx}` —
  org-scoped hrefs, relative upcoming-match dates, P1-03 dedup assertions, P2-01 window check.
- `src/app/dev/ui-lab/gate-c/c02-decision-day/{fixtures.ts,page.tsx,__tests__/page.test.tsx}` —
  P2-03 identity-collision primary decision, org-scoped hrefs.
- `src/app/dev/ui-lab/gate-c/c03-matchday-prelive/**/{fixtures.ts,page.tsx,__tests__/page.test.tsx}`
  (all six scenarios) — real busy-day fixture via `gateCBuildBusyDay()`, org-scoped hrefs, new
  featured-match id (`match-c03-featured`/`event-match-c03-featured`), P1-01/P1-02 assertions
  (league/prepare and event/prepare additionally demonstrate the busy-day chronology).
- `src/app/dev/ui-lab/gate-c/c03-matchday-prelive/shared/__tests__/live-now-matchday-exclusivity.test.tsx`
  — updated to the new busy-day fixture builder.

### Rewritten browser acceptance coverage

- `e2e/ui-lab-gate-c.spec.ts` — org-scoped href assertions throughout; new real click-through
  tests (P2-02) distinguishing href shape, actual click, and real verified destination
  (`/signin`, confirmed empirically via request/response logging before writing the assertion);
  new busy-day chronology assertions for league/prepare and event/prepare.

### Documentation

- `CURRENT_STATE_AUDIT.md`, `INFORMATION_OWNERSHIP_MATRIX.md`, `DATA_TRUTH_AND_FIXTURES.md`,
  `INTERACTION_AND_STATE_AUDIT.md`, `VISUAL_VS_CURRENT.md`, `BLOCKERS.md` — all updated to
  reflect the real findings and fixes above, not re-asserting "no proposed refinement."
  `candidate_manifest.json` — `fixtureVersion` bumped for every candidate; `componentOwners`
  updated to include the two changed production files; `baselineAssetRef` changed to
  `PROPOSED_REFINEMENT (implemented)` for the affected candidates.
- `capture-attestation.json` — regenerated against this remediation's own CI run (not the
  pre-remediation evidence) once that run completes — see `REVIEW_RECORD.md`.

## Original wave (first pass, PR #826 initial commits) — for reference

- New: 8 UI Lab candidate routes + fixtures + tests under `src/app/dev/ui-lab/gate-c/`
- New: full documentation set under `docs/ui-lab/gate-c-w1-candidates/`
- New: `e2e/ui-lab-gate-c.spec.ts` (Playwright)
- Modified: `scripts/ui-lab-visual-review.mjs` (registers the 8 routes, extends
  readiness/overflow/console-error gates to `gate-c/`)
- Modified: `playwright.config.ts` (new `ui-lab-gate-c` project)
- Modified: `.github/workflows/ui-lab-visual-review.yml` (runs the new Playwright suite)
- Modified: `AGENTS.md` (the `next dev`-regenerated block's heading level; auto-generated)

## Not changed

No file under `src/lib/touchline/presentation/*`, `today-context-rail.tsx`,
`today-operational-timeline.tsx`, or `today-matchday.tsx` itself is modified — the fixes are
entirely in what `today-surface.tsx` computes and passes to these otherwise-unchanged
components. No database migration, no new route outside `/dev/ui-lab`, no change to Today's
primary navigation, no change to any other Gate's approved candidates or documentation, no
change to Gate B's shared fixture files (the subject of issue #827, left untouched per that
issue's own disposition).
