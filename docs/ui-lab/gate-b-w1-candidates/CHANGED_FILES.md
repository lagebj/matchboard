# Gate B W1 — Changed Files

Generated from `git diff --cached --stat main` at implementation time. No production route,
component, data loader, or schema file is touched — every `src/` change is new, additive content
under `src/app/dev/ui-lab/gate-b/` (dev-only, 404s in production) plus one additive extension of
the existing visual-review capture script.

## Phase 2 (design audit, owner-requested) — additional changes

- `b01-planned-ready/page.tsx`, `b02-planned-incomplete/page.tsx` — removed an invented
  `DecisionBanner` duplicating `MatchPreparationWidget`'s own output; updated doc comments.
- `b03-completed-sparse/page.tsx` — added the Match Flow reconciliation note (additive,
  UI-Lab-local); updated doc comment to `PROPOSED_REFINEMENT`.
- `b04-completed-rich/page.tsx` — added the same reconciliation check for symmetry/regression
  coverage (confirmed `true`, renders nothing); updated doc comment.
- `shared/chronology-reconciliation.ts` — new helper, `chronologyReconcilesWithFinalScore()`.
- `shared/__tests__/chronology-reconciliation.test.ts` — new unit tests for the helper.
- Each scenario's `__tests__/page.test.tsx` — updated to assert the fixed/added behavior.
- `candidate_manifest.json`, `VISUAL_VS_CURRENT.md`, `SOURCE_RECONCILIATION.md`, `BLOCKERS.md`,
  `REVIEW_RECORD.md` — updated to record the audit and its findings.

## Documentation (this directory)

- `BLOCKERS.md`, `CURRENT_STATE_AUDIT.md`, `DATA_TRUTH_AND_FIXTURES.md`,
  `INTERACTION_AND_STATE_AUDIT.md`, `SCENARIO_REGISTER.md`, `SOURCE_RECONCILIATION.md`,
  `THREE_PART_EXPERIENCE_CONTRACT.md`, `VISUAL_VS_CURRENT.md`, `CHANGED_FILES.md` (this file),
  `REVIEW_RECORD.md`, `candidate_manifest.json` — all new.

## CI capture script (additive extension only)

- `scripts/ui-lab-visual-review.mjs` — added `gbExtraSmokeViewports` and four new `scenarios`
  entries (`gate-b-w1-b01-planned-ready` through `-b04-completed-rich`). No existing entry
  modified.

## Gate B candidate routes and fixtures (all new)

- `src/app/dev/ui-lab/gate-b/page.tsx` — wave index.
- `src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts` — shared match/squad/pitch fixture
  builders.
- `src/app/dev/ui-lab/gate-b/shared/__tests__/mock-viewport.ts` — test helper.
- `src/app/dev/ui-lab/gate-b/b01-planned-ready/{fixtures.ts,page.tsx,__tests__/{fixtures,page}.test.{ts,tsx}}`
- `src/app/dev/ui-lab/gate-b/b02-planned-incomplete/{fixtures.ts,page.tsx,__tests__/{fixtures,page}.test.{ts,tsx}}`
- `src/app/dev/ui-lab/gate-b/b03-completed-sparse/{fixtures.ts,page.tsx,__tests__/{fixtures,page}.test.{ts,tsx}}`
- `src/app/dev/ui-lab/gate-b/b04-completed-rich/{fixtures.ts,page.tsx,__tests__/{fixtures,page}.test.{ts,tsx}}`

28 files changed, 1571 insertions(+), 0 deletions (docs added after this count will bring the
total slightly higher — see the PR's own final diff for the authoritative number).
