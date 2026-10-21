# Gate B W2 — Changed Files

Generated from `git status --short` at implementation time. No production route, component, data
loader, or schema file is touched — every `src/` change is new, additive content under
`src/app/dev/ui-lab/gate-b/b05-post-match-report/` (dev-only, 404s in production) plus one
additive extension of the existing visual-review capture script and the existing Gate B/shared
fixture modules.

## Gate B candidate routes and fixtures (all new)

- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/report-data.ts` — shared raw
  attendance/goal/assist/debrief/combination-evidence records and `MatchDetailAfterData`/
  `MatchReportDetail` builders, reused by both scenarios.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/draft/{fixtures.ts,page.tsx,__tests__/{fixtures,page}.test.{ts,tsx}}`
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/completed/{fixtures.ts,page.tsx,__tests__/{fixtures,page}.test.{ts,tsx}}`

## Shared Gate B fixture module (additive extension only)

- `src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts` — added `B05_MATCH_ID`,
  `B05_REPORT_ID`, `B05_KICKOFF_AT`, `B05_NOW`, `B05_OPPONENT_NAME`, `b05DraftMatchIdentity`,
  `b05CompletedMatchIdentity`. No existing B01-B04 export modified.

## Gate B index (additive)

- `src/app/dev/ui-lab/gate-b/page.tsx` — added the two B05 entries; updated the deferred-scope
  blurb (B05 is no longer deferred) and heading. No B01-B04 entry modified.

## CI capture script (additive extension only)

- `scripts/ui-lab-visual-review.mjs` — added two new `scenarios` entries
  (`gate-b-w2-b05-draft`, `gate-b-w2-b05-completed`), reusing the existing `gbExtraSmokeViewports`
  constant. No existing entry modified.

## Documentation (this directory, all new)

- `BLOCKERS.md`, `CURRENT_STATE_AUDIT.md`, `DATA_TRUTH_AND_FIXTURES.md`,
  `INTERACTION_AND_STATE_AUDIT.md`, `SCENARIO_REGISTER.md`, `SOURCE_RECONCILIATION.md`,
  `THREE_PART_EXPERIENCE_CONTRACT.md`, `VISUAL_VS_CURRENT.md`, `CHANGED_FILES.md` (this file),
  `REVIEW_RECORD.md`, `candidate_manifest.json`.

`capture-attestation.json` is not yet present — added once this PR's own CI capture run
succeeds, following Gate B W1's own Phase 5 precedent.
