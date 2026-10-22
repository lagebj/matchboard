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

## Third remediation pass (R8-1, R8-2, R8-3)

- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/goal-discrepancy-disclosure.tsx` (new)
  — the lifecycle-aware `GoalDiscrepancyDisclosure` component (R8-1), replacing this candidate's
  own use of the real `GoalAttributionGapBanner` (left unmodified in production).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/__tests__/goal-discrepancy-disclosure.test.tsx`
  (new) — direct component coverage: no-gap cases, editable wording, locked wording, pluralization,
  dynamic counts.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/safe-post-match-report-shell.tsx` —
  renders `GoalDiscrepancyDisclosure` instead of `GoalAttributionGapBanner` (R8-1); threads a new
  `eligiblePlayers` list (derived from `allPlayers`) into the lifecycle hook (R8-2).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/use-safe-report-lifecycle.ts` —
  `addPlayer()` now validates against an `EligiblePlayer[]` source and resolves the real name
  from it; `reopen()` now rejects any target outside `{"DRAFT","REPORTED"}` at the runtime
  validation layer (R8-2).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/__tests__/use-safe-report-lifecycle.test.tsx`
  — extended with R8-2's eligibility and reopen-target test suites (11 new tests).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/combination-source-data.ts` (new) — the
  canonical positional segment and goal-attribution events `b05CombinationEvidence` is computed
  from (R8-3).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/report-data.ts` — `b05CombinationEvidence`
  is now COMPUTED by calling the real `deriveCombinationsFromSegments()` against
  `combination-source-data.ts`'s records, curated to the Noah+Sindre `PARTNERSHIP` row (R8-3).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/__tests__/combination-evidence.test.ts`
  — rewritten to import the SAME source records the fixture itself uses, asserting field-for-field
  equality with the real derivation's own output (R8-3).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/{draft,completed}/fixtures.ts` — added the
  combination source records to `rawRecordsForHash`; `fixtureVersion` bumped 2 -> 3; new
  `fixtureSha256` for both.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/draft/__tests__/page.test.tsx`,
  `completed/__tests__/page.test.tsx` — updated terminology assertions (`/recorded during Live
  Reporting/i` replacing `/missing scorer attribution/i`), added R8-1 locked/editable-wording
  cases and an R8-2 ineligible-player UI-surface check.
- `scripts/ui-lab-visual-review.mjs` — capture-flow wait conditions updated to the new wording;
  the locked-with-gap wait now specifically asserts the LOCKED wording ("Reopen the report to
  add"), not just banner presence.
- `docs/ui-lab/gate-b-w2-candidates/{BLOCKERS,SOURCE_RECONCILIATION,DATA_TRUTH_AND_FIXTURES,
  INTERACTION_AND_STATE_AUDIT,VISUAL_VS_CURRENT,REVIEW_RECORD,candidate_manifest}.{md,json}` —
  R8-1/R8-2/R8-3 remediation sections added.

This pass DOES touch fixture DATA (R8-3) — contrast the second pass, which touched only shared
component code. No production code is touched.

## Fourth remediation pass (R9-1)

- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/combination-source-data.ts` —
  `b05PositionalSegment` (singular, one 0-80' block) replaced with `b05PositionalSegments`
  (plural, three real chronological segments: 0-68'/68-83'/83-90'); added
  `computeMinutesByParticipant()` and `validateSegmentSequence()` pure helpers.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/report-data.ts` —
  `b05CombinationEvidence`'s `minutesTogether` corrected 80 -> 83; added a doc comment on
  `b05MinutesByParticipant` cross-referencing the now-consistent segment model.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/{draft,completed}/fixtures.ts` — renamed
  `combinationPositionalSegment` to `combinationPositionalSegments` in `rawRecordsForHash`;
  `fixtureVersion` bumped 3 -> 4; new `fixtureSha256` for both.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/__tests__/combination-evidence.test.ts`
  — updated for the plural segments export; added a dedicated "participation consistency" suite
  (structural boundary checks, exact minute-total agreement against `b05MinutesByParticipant`,
  scorer/assist on-pitch-at-event-time checks, draft/completed same-source checks) plus a
  negative test using a deliberately contradictory single-segment sequence.
- `docs/ui-lab/gate-b-w2-candidates/{BLOCKERS,SOURCE_RECONCILIATION,DATA_TRUTH_AND_FIXTURES,
  candidate_manifest}.{md,json}` — R9-1 remediation sections added.

B06 is untouched — not the target of R9-1. No production code is touched by this pass.

## Fifth remediation pass (R10-1)

- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/report-data.ts` — added
  `B05_MATCH_FORMAT` (NFF Akershus G11, 7v7, 2x30 minutes) and the pure
  `globalMinuteToPeriodRelative()` helper; rewrote `b05CanonicalLiveEvents` with real
  period-relative `matchSeconds` for all 9 events (period/seconds corrected for the 34', 50', and
  55' — formerly 61' — goals); `b05Goals()`'s report row for the final goal moved 61' -> 55';
  `b05TimingReview()`'s `resolvedDurationMinutes` corrected to match the real 30-minute period
  (28 for the draft in-progress state, 30 for completed); `b05MinutesByParticipant` set uniformly
  to 60 for all 7 players; `b05CombinationEvidence.minutesTogether` corrected 83 -> 60;
  `b05FootballObservations`'s Elias note no longer references a substitution that no longer
  occurred.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/combination-source-data.ts` — rewritten:
  `b05PositionalSegments` is now a single 0-60' segment with all 7 present players filling all 7
  real formation slots (CF, previously vacant, now filled); added the explicit empty
  `b05RotationEvents` declaration documenting no substitutions occurred; added
  `validateMatchFormat()`.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/{draft,completed}/fixtures.ts` —
  `fixtureVersion` bumped 4 -> 5; new `fixtureSha256` for both; doc comments extended with the
  full R10-1 rationale.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/__tests__/combination-evidence.test.ts`
  — rewritten with new "match format", "participation consistency", and "canonical event
  chronology" suites (each with positive and negative cases), replacing the R9-1 suite's
  three-segment/83-minute assumptions.
- `docs/ui-lab/gate-b-w2-candidates/{BLOCKERS,SOURCE_RECONCILIATION,DATA_TRUTH_AND_FIXTURES,
  CHANGED_FILES,VISUAL_VS_CURRENT,INTERACTION_AND_STATE_AUDIT,REVIEW_RECORD,
  candidate_manifest}.{md,json}` — R10-1 remediation sections added.

B06 is untouched — not the target of R10-1. No production code is touched by this pass.

## Sixth remediation pass (R11-1, R11-2, R11-3)

- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/report-data.ts` — `B05_MATCH_FORMAT`
  gains a `maxOnFieldPlayers: 7` field (R11-1); corrected `b05Reflection.note`,
  `b05OpponentObservation.factualSummary`, `b05DebriefAnswers.team_execution.note`,
  `b05DebriefAnswers.match_changes` (now `NO_MEANINGFUL_CHANGE`, never `WE_CHANGED`), and
  `b05DebriefAnswers.opponent_memory.note` to agree with the canonical chronology/positional
  history (R11-2).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/combination-source-data.ts` — added
  `validateOnFieldCount()` (general 7v7 ceiling) and `validateExactParticipantCount()` (B05's own
  scenario-specific exact-seven rule) (R11-1).
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/{draft,completed}/fixtures.ts` — added
  `matchFormat: B05_MATCH_FORMAT` and `rotationEvents: b05RotationEvents` to `rawRecordsForHash`
  (R11-3); `fixtureVersion` bumped 5 -> 6; new `fixtureSha256` for both.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/__tests__/combination-evidence.test.ts`
  — replaced the backwards-asserting 8-player negative test with one that genuinely proves
  rejection via `validateOnFieldCount()`; added duplicate-occupancy/duplicate-position negative
  tests, a general-ceiling six-player positive test, a B05-specific six-player negative test, a
  client-bundle-safety import-boundary test (all R11-1); added a new "R11-2 — match narrative vs.
  canonical history" suite (score progression, never-trails, never-leads-by-two, no
  shape-change-claimed, match_changes-agrees-with-history, no-contradictory-phrases,
  debrief-schema-valid, draft/completed-same-debrief); added an R11-3 draft/completed
  same-matchFormat/rotationEvents test.
- `src/app/dev/ui-lab/gate-b/b05-post-match-report/draft/__tests__/fixtures.test.ts` — added
  determinism, no-self-reference, and hash-sensitivity regression tests (format/age-group/
  rotation-events/positional-segments/player-minutes each independently change the hash; an
  unchanged copy reproduces the same hash; draft and completed retain separate hashes) (R11-3).
- `docs/ui-lab/gate-b-w2-candidates/{BLOCKERS,SOURCE_RECONCILIATION,DATA_TRUTH_AND_FIXTURES,
  CHANGED_FILES,VISUAL_VS_CURRENT,INTERACTION_AND_STATE_AUDIT,REVIEW_RECORD,
  candidate_manifest}.{md,json}` — R11-1/R11-2/R11-3 remediation sections added.

B06 is untouched — not the target of R11-1/R11-2/R11-3. No production code is touched by this
pass (`debrief-read-only.tsx`'s own `MATCH_CHANGE_LABELS` mapping and `DebriefReadOnly` rendering
are real, unmodified, pre-existing production code — only this fixture's own data changed).
