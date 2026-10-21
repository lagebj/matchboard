# Gate B W2 — Changed Files

Generated from `git status --short` at implementation time. No production route, data loader, or
schema file is touched. One real production component got a narrow bug fix (B2-R1, below) after
this wave's own CI capture found it; every other `src/` change is new, additive content under
`src/app/dev/ui-lab/gate-b/b05-post-match-report/` (dev-only, 404s in production) plus one
additive extension of the existing visual-review capture script and the existing Gate B/shared
fixture modules.

## Phase B2-R1 (CI capture finding) — production bug fix

- `src/components/matches/recovered-timing-callout.tsx` — fixed a real, pre-existing
  invalid-HTML-nesting bug (`<div>`/`<p>` nested inside `DecisionBanner`'s own `<p>`), found by
  this PR's own first CI capture run. Changed the offending elements to `<span>` (valid phrasing
  content) — markup only, no copy or behavior change. See `BLOCKERS.md`.

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

## CI capture attestation (new, added after the B2-R1 fix)

- `capture-attestation.json` — generated from this PR's own passing CI run (`39593337123`,
  branch head `1b91b7cb6`), 24 captures, every SHA-256 independently re-verified. Scenario-scoped
  filter of that run's full 1050-capture manifest, following the exact precedent Gate B W1's own
  `capture-attestation.json` established. **Superseded as current evidence by fixtureVersion 2's
  own real CI capture, added below — preserved here as the historical record of what
  fixtureVersion 1 actually looked like when approved.**

## fixtureVersion 2 — retrospective remediation (Gate B W3 session)

- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/report-data.ts` — rewritten: real
  canonical live events, corrected goal/assist/gap/combination-evidence model (B2-R2/R4).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/use-safe-report-lifecycle.ts` (new) —
  the fixture-local lifecycle state machine (B2-R3/R5).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/safe-post-match-report-shell.tsx`
  (new) — the UI-Lab-local page shell replacing direct use of the real `PostMatchReportPageShell`
  for the Players tab only (B2-R5/R6/R7).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/{draft,completed}/{page.tsx,fixtures.ts}` —
  rewritten to use the new safe shell/lifecycle; `fixtureVersion` bumped to 2; new
  `fixtureSha256`; corrected reference times (`B05_DRAFT_REFERENCE_AT`, `B05_NOW`).
- `src/app/dev/ui-lab/gate-b/{draft,completed}/__tests__/{fixtures,page}.test.{ts,tsx}` —
  rewritten/extended for the new model and the new interactive flow.
- `src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts` — added `B05_DRAFT_REFERENCE_AT`.
  No existing B01-B04/B06 export modified.
- `docs/ui-lab/gate-b-w2-candidates/candidate_manifest.json` — `fixtureVersion: 2`,
  `approval: null`, fixtureVersion 1's approval preserved unmodified in each entry's own
  `priorVersions`.
- `docs/ui-lab/gate-b-w2-candidates/{BLOCKERS,SOURCE_RECONCILIATION,DATA_TRUTH_AND_FIXTURES,
  VISUAL_VS_CURRENT,REVIEW_RECORD}.md` — remediation sections added, historical content
  preserved and marked superseded where relevant.
- `docs/ui-lab/gate-b-w3-candidates/` — B06's own remediation (B3-R1 through B3-R7); see that
  directory's own `CHANGED_FILES.md`.

## CI capture attestation — fixtureVersion 2 (regenerated after the remediation commit)

- `capture-attestation.json` — rewritten: top-level content is now the real CI run
  `39657393171` (branch head `568096efc`), 24 captures, every SHA-256 independently re-verified.
  fixtureVersion 1's own attestation (above) is preserved unmodified under this file's own
  `priorVersions[0]`.

## Second remediation pass (B5/R1, B5/R3, B5/R4, B5/R5, B5/R7)

- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/use-safe-report-lifecycle.ts` —
  rewritten: one central `reduce()` validation dispatcher for every mutation (B5/R3), state-scoped
  deterministic local-id counter and caller-supplied `completedAt` (B5/R3), no change to
  `SafeReportLocalState`'s externally-observed shape beyond the added `nextLocalId` field.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/safe-post-match-report-shell.tsx` —
  the goal-attribution-gap banner is no longer gated by `isDraft` (B5/R1); `attendanceSummary`/
  `playerInvolvement`'s present-participant list/the header's own identity card are now all
  derived live from current report state (B5/R4); "Back to match"/the "Matches" breadcrumb are
  real links to the new `match-details/` page, and the Review tab no longer renders the real
  `PostMatchReviewTab` with a fragment href (B5/R5); takes a new `completionTimestamp` prop.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/match-details/{page.tsx,__tests__/page.test.tsx}`
  (new) — the real fixture-backed Match Details stand-in B5/R5 links to.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/{draft,completed}/page.tsx` — pass the new
  `completionTimestamp`/`nextLocalId: 0` fields; no fixture DATA change.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/draft/__tests__/page.test.tsx` — extended with
  B5/R1 (both real completion outcomes), B5/R5 (navigation), and B5/R4 (live identity card) cases.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/completed/__tests__/page.test.tsx` — extended
  with the B5/R5 navigation case.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/__tests__/use-safe-report-lifecycle.test.tsx`
  (new) — direct action-interface coverage for B5/R3 (every rejection path, determinism, replay).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/__tests__/combination-evidence.test.ts`
  (new) — verifies B05's own combination row against the real `deriveCombinationsFromSegments()`
  (same provenance standard as B06's B5/R6 fix, applied here for consistency — no value changed).
- `src/app/dev/ui-lab/gate-b/page.tsx` — registered the new `match-details` nav entry.
- `scripts/ui-lab-visual-review.mjs` — `completeB05DraftFlow()` split into
  `completeB05DraftWithUnresolvedGapFlow()`/`completeB05DraftReconciledFlow()` (two real sequential
  interaction states, B5/R1); the reconciled flow now fills the real "Min" input (B5/R1 capture
  fix); registered `gate-b-w2-b05-match-details` and the two B06 nav pages that had never been
  registered at all (found in this same pass — see `docs/ui-lab/gate-b-w3-candidates/BLOCKERS.md`).
- `docs/ui-lab/gate-b-w2-candidates/{BLOCKERS,SOURCE_RECONCILIATION,DATA_TRUTH_AND_FIXTURES,
  candidate_manifest}.{md,json}` — B5/Rx remediation sections added.

No production code is touched by this second pass (contrast the first pass's one B2-R1
production fix, above).
