# Gate B W2 — Review Record

## fixtureVersion 2 — remediation record (supersedes the approval status below for review purposes)

A retrospective technical review (Gate B W3 session) found six real correctness/safety defects
in fixtureVersion 1's fixtures and interactions (B2-R2 through B2-R7 — goal-attribution-gap math
didn't follow the real `computeGoalAttributionGap()` contract; the completion simulation never
enforced the real timing-submission-blocker gate; the real `PostMatchPage` it rendered could
invoke real production server actions against a synthetic match id; combination evidence used
season-aggregated values on a per-match row and leaked into the draft state; navigation used
fragment hrefs as if they worked; fixture clocks used kickoff for both lifecycle snapshots).
**fixtureVersion 1's historical approval (`/visual-approve b9a95c9dbf4289a2727a15bd73375a4dc6381e2e`,
below) is preserved as fact and was not revoked or rewritten — it covered fixtureVersion 1's own
content, which is exactly what it still means.** fixtureVersion 2 (the corrected candidate now in
this directory) does **not** inherit that approval: `candidate_manifest.json` sets `approval:
null` on both scenarios again, and fresh technical + owner review is required before any new
approval is recorded. See `SOURCE_RECONCILIATION.md`'s remediation section and `BLOCKERS.md` for
the full finding-by-finding detail, fixes, and the two verified production defects (duplicate
banners; no actions-injection seam on `PostMatchPage`) tracked as separate GitHub issues rather
than fixed inside this UI Lab PR.

| Scenario | Status | Notes |
|---|---|---|
| B05 | `CANDIDATE`, `approval: null` (fixtureVersion 6) | fixtureVersion 1 was `APPROVED_GOLDEN` (historical, preserved in `priorVersions`) — superseded by this remediation; requires fresh review. |
| B05-COMPLETED | `CANDIDATE`, `approval: null` (fixtureVersion 6) | Same remediation and supersession as B05. |

## Second remediation pass (B5/R1, B5/R3, B5/R4, B5/R5, B5/R7)

A further independent technical review found five more real defects, this time in the first
pass's own shared shell/hook component code rather than the fixture data (B5/R1 — a completed
report could silently look reconciled when it was not; B5/R3 — most mutations didn't enforce
locked state, and the id counter/completion timestamp were non-deterministic; B5/R4 — attendance
totals, player involvement, and the identity card could go stale after an edit; B5/R5 — remaining
fragment hrefs; B5/R7 — stale capture evidence). `candidate_manifest.json` still correctly
reads `approval: null` for both scenarios — this second pass does not change that, and does not
inherit fixtureVersion 1's approval either. See `SOURCE_RECONCILIATION.md`'s own "second
remediation pass" section for the full record and `BLOCKERS.md` for disclosures.

## Third remediation pass (R8-1, R8-2, R8-3)

A fourth independent technical review found three more real defects: the second pass's own
locked-state disclosure fix reused invalid production wording (R8-1); `addPlayer()`/`reopen()`
accepted inputs the reducer should have rejected (R8-2); the combination-evidence derivation
test's source records lived outside the fixture's own hash (R8-3, which is why fixtureVersion is
now 3 — the only one of these three findings that changed hashed fixture content).
`candidate_manifest.json` still correctly reads `approval: null` for both scenarios; fixtureVersion
1's historical approval remains preserved, unmodified, in `priorVersions`. See
`SOURCE_RECONCILIATION.md`'s own "third remediation pass" section and `BLOCKERS.md`.

## Fourth remediation pass (R9-1)

A fifth independent technical review found that R8-3's own new positional segment contradicted
the fixture's pre-existing `b05MinutesByParticipant` records — a fixture integrity defect
introduced by R8-3 itself, not a production/derivation-engine defect. Corrected without changing
any existing minute value (see `SOURCE_RECONCILIATION.md`'s own "fourth remediation pass"
section); `fixtureVersion` bumped 3 -> 4 for both scenarios. `candidate_manifest.json` still
correctly reads `approval: null` for both; fixtureVersion 1's historical approval remains
preserved, unmodified, in `priorVersions`.

## Fifth remediation pass (R10-1)

A sixth independent technical review found that R9-1's own corrected model introduced new
unsupported assumptions of its own: an unjustified 90-minute duration, a substitution and an
early departure both INFERRED from minute totals rather than backed by any real canonical event,
a permanently vacant CF slot, and canonical event `matchSeconds` values never checked against
production's own real period-relative contract. Corrected by establishing the real NFF Akershus
G11 7v7 format (2x30 minutes, 60 total) as authoritative, removing the inferred substitution and
departure entirely (all 7 present players play the full match, filling all 7 formation slots),
and rebuilding the goal chronology against the real `matchSeconds` contract (moving the final
goal's global minute 61' -> 55', now within regulation) — see `SOURCE_RECONCILIATION.md`'s own
"fifth remediation pass" section; `fixtureVersion` bumped 4 -> 5 for both scenarios.
`candidate_manifest.json` still correctly reads `approval: null` for both; fixtureVersion 1's
historical approval remains preserved, unmodified, in `priorVersions`.

## Sixth remediation pass (R11-1, R11-2, R11-3)

A seventh independent technical review confirmed R10-1's G11 7v7 model is coherent but found
three remaining defects: (R11-1, P1) the R10-1 pass's own negative test for an 8-player segment
asserted it PASSED validation and mischaracterized this as proof of rejection —
`validateSegmentSequence()` never enforced any on-field count ceiling; corrected with new
`validateOnFieldCount()`/`validateExactParticipantCount()` functions and a genuinely-rejecting
test. (R11-2, P2) retained narrative (`b05Reflection`, `b05OpponentObservation`,
`b05DebriefAnswers`) contradicted the canonical score progression (Slemmestad never trails,
neither team leads by two) and the unchanged single-segment positional history (no formation
change occurred); corrected to agree with the record, with `match_changes.option` now the
schema's own `NO_MEANINGFUL_CHANGE`. (R11-3, P2) `B05_MATCH_FORMAT` and `b05RotationEvents` were
both excluded from `rawRecordsForHash` despite being authoritative; both now included under
stable keys, with new hash-sensitivity regression tests. See `SOURCE_RECONCILIATION.md`'s own
"sixth remediation pass" section; `fixtureVersion` bumped 5 -> 6 for both scenarios.
`candidate_manifest.json` still correctly reads `approval: null` for both; fixtureVersion 1's
historical approval remains preserved, unmodified, in `priorVersions`.

## Historical record — fixtureVersion 1 (preserved, not current)

| Scenario | Status | Notes |
|---|---|---|
| B05 | `CANDIDATE` / `APPROVED_GOLDEN` | **Approved.** Real owner review of the live Test-slot deploy (test.matchboard.football), resolved via `/visual-approve b9a95c9dbf4289a2727a15bd73375a4dc6381e2e`, 2026-10-21. PR #805 merged. First pass: confirms the real shipped Post-Match Report composition against the register's "finish/report actions versus read-only knowledge" requirement — no fabricated gap found, no design proposal made. B2-R1: this PR's own first CI capture run found and fixed a real pre-existing bug in `RecoveredTimingCallout` (invalid HTML nesting). |
| B05-COMPLETED | `CANDIDATE` / `APPROVED_GOLDEN` | **Approved** — same approval event as B05 (one PR, one `/visual-approve` comment covers both scenarios). Shares B05's real match identity and debrief. |

## Phase B2-R1 — CI capture finding, fixed

This PR's first CI run of `ui-lab-visual-review.yml` failed: the draft scenario's real,
browser-rendered page produced real React console errors from invalid HTML nesting inside
`src/components/matches/recovered-timing-callout.tsx` (a genuinely pre-existing bug — B01-B04
never exercised this component). Fixed on this branch; full detail in `BLOCKERS.md`. This is the
one real production file this PR touches.

## This wave's own design-audit outcome

Read the real `PostMatchReportPageShell`/`PostMatchReportShell`/`PostMatchDebrief` composition
directly against B05's register language (see `SOURCE_RECONCILIATION.md`'s framing decision).
Outcome: the real, already-shipped composition already satisfies the register row — no invented
duplicate control, no missing disclosure, no proposed refinement. See `VISUAL_VS_CURRENT.md`.

## Approval — recorded

Both scenarios' `candidate_manifest.json` entries now carry a real `approval` block
(`state: "APPROVED"`, `scope: "APPROVED_GOLDEN — design reference only; NOT production
implementation authorization"`, `approvedBy: "lagebj"`, `revisionSha:
"b9a95c9dbf4289a2727a15bd73375a4dc6381e2e"`), written by `scripts/visual-authority/
promote-to-golden.mjs` in a follow-up commit after the real approval, using the exact schema Gate
A and Gate B W1 both established. `approvedCaptures` for both entries are copied from, and match
exactly, the committed `capture-attestation.json`'s own independently-re-verified hashes — no new
hash was invented at promotion time. `releaseStatus` remains `PENDING` (no durable GitHub Release
attempted yet), same as every other un-released Gate A/B wave.

## What was required before approval (all satisfied)

1. Owner review of `SOURCE_RECONCILIATION.md`'s framing question (confirm-via-fixture vs.
   propose-new) — resolved via the real `/visual-approve`.
2. `.github/workflows/ui-lab-visual-review.yml` ran on this PR and produced a real
   `capture-attestation.json` — **done**: committed in this directory, **24 captures** (run
   `39593337123`, branch head `1b91b7cb6`, after the B2-R1 fix), every hash independently
   re-verified (see `BLOCKERS.md`).
3. **ADR-0159's `Visual Authority Gate`** — the first Gate B wave subject to it as a real,
   required, merge-blocking check (Stage B activated earlier in this same session). The first
   `/visual-review deploy` request was itself declined by a real circularity bug, fixed in #806
   (merged first); the second request succeeded and was then independently clobbered by
   `test-db-migrate.yml`'s own (deliberate, documented) baseline-reclaim on an unrelated `main`
   push, requiring a third, uncontested deploy before the owner could actually review it live.
4. Owner reviewed the live Test-slot deploy at test.matchboard.football against
   `VISUAL_VS_CURRENT.md`'s stated identical/differs breakdown and resolved
   `/visual-approve b9a95c9dbf4289a2727a15bd73375a4dc6381e2e`.

## Technical review checklist (self-assessed by the implementer; independent review still needed)

- [x] `npm run lint` clean on all new files.
- [x] `npx tsc --noEmit` clean, project-wide.
- [x] New unit/component tests pass (`npx vitest run` + `npx vitest run --config
      vitest.config.components.ts`, both scoped to
      `src/app/dev/ui-lab/gate-b/b05-post-match-report`, and the full `npm test` suite run
      afterward with no new failures elsewhere).
- [x] No forbidden fabricated metric (possession/xG/shots/cards/rating/Player of the Match)
      anywhere in fixtures or rendered output (enforced by test).
- [x] No fabricated assist pairing — the report-fallback timeline builder's own real rule
      (ADR-0147 §5), not independently re-tested here (already covered by the production
      function's own tests; this wave's fixtures pass a goal list no different in shape from
      B03/B04's).
- [x] `fixtureSha256` independently recomputed from the raw records in both `fixtures.test.ts`
      files (not a copied literal — found and fixed before commit, same B1-R7 discipline Gate B
      W1 established).
- [x] `afterData.playerMinutes` (a `Map`, which `JSON.stringify` silently drops) is explicitly
      spread into `rawRecordsForHash` as entries — checked directly against the B1-R7 lesson
      rather than reproducing the same class of bug.
- [x] No production route, data loader, or schema file modified. One production component
      (`recovered-timing-callout.tsx`) got a narrow markup-only bug fix — B2-R1, see
      `BLOCKERS.md`.
- [x] `npm run build` / `npm test` (full suite) re-run locally after the B2-R1 fix — no
      regressions.
- [x] Real CI visual capture — first run failed on the B2-R1 finding; fixed, re-pushed, re-run
      passed (`39593337123`, 13m22s). `capture-attestation.json` committed with all 24 hashes
      independently re-verified.
- [ ] Independent technical review — not yet performed on fixtureVersion 1 (superseded).

## Technical review checklist — fixtureVersion 2 remediation (self-assessed; independent review still needed)

- [x] B2-R2: goal-attribution-gap now follows the real `computeGoalAttributionGap()` contract —
  `attributedGoals` is a report-row count, never filtered by scorer; the draft genuinely has one
  fewer report row than live-recorded goals, not a row with a null scorer.
- [x] B2-R3: completion genuinely rejects while a timing period needs review (real test coverage:
  reject → confirm timing → succeeds), and the goal-attribution gap is independently resolvable
  via the real "Add goal" control — confirmed NOT itself a completion blocker in real production
  (`completeReport()` only calls `getTimingSubmissionBlockers()`), so the simulation does not
  invent a stricter gate than production actually has.
- [x] B2-R4: combination evidence uses `opponentDiversity: 1` and never `ESTABLISHED` confidence
  (the real per-match derivation ceiling), and is empty in the draft state (never exposed before
  LOCKED, matching `getMatchDetailAfterData()`'s real gate).
- [x] B2-R5: the real `PostMatchPage` is no longer rendered; no file in this scenario imports the
  real production post-match server-action module (enforced by a structural test reading the
  source files directly, not just a behavioural assertion).
- [x] B2-R6: the composed Players tab shows the unresolved-report banner and the
  goal-attribution-gap banner exactly once each (verified by test) — the real production
  duplication is disclosed as a separate, tracked defect, not silently claimed fixed.
- [x] B2-R7: no fragment href is presented as working navigation; both lifecycle snapshots use a
  reference time after kickoff (draft) / after completion (completed), never kickoff itself.
- [x] `npx tsc --noEmit`, `npx eslint`, both Vitest suites (node + components) pass for this
  scenario and project-wide, with no regressions.
- [ ] Independent technical review of the remediation — not yet performed.
- [ ] Fresh owner visual approval of fixtureVersion 2 — not yet requested or recorded.

## Technical review checklist — fixtureVersion 5 remediation (R10-1, self-assessed; independent review still needed)

- [x] Match format established against two official NFF/fotball.no references (NFF Akershus G11,
  7v7, 2x30 minutes) rather than preserved merely because existing fixture values were built
  around a different duration; no tournament rule or special arrangement invented to keep 90
  minutes.
- [x] `matchSeconds`'s real production semantics (period-relative, confirmed directly against
  `src/lib/live-match/period-config.ts`'s own documented contract) verified by dedicated research
  before any event's `period`/`matchSeconds` was changed, not assumed.
- [x] Every canonical event's `period`/`matchSeconds` cross-checked against its own `minuteLabel`
  via `globalMinuteToPeriodRelative()` in a dedicated test — not trusted by construction.
- [x] All 7 present players' minutes, the positional segments, and the combination-evidence row
  now agree exactly (60 minutes each, single segment, `minutesTogether: 60`) — verified by a
  dedicated participation-consistency suite, including negative tests for a contradictory minute
  total, an 8-player overflow, and overlapping segments.
- [x] `npx tsc --noEmit`, `npx eslint`, both Vitest suites (node + components, full `npm test`)
  pass project-wide with no regressions (581 test files / 6398 tests node-only; 142 test files /
  870 tests component).
- [x] `fixtureSha256` independently recomputed from the raw records in both `fixtures.test.ts`
  files for both candidates (not a copied literal).
- [x] No production route, data loader, schema, or derivation-engine file modified.
- [ ] Independent technical review of the R10-1 remediation — not yet performed.
- [ ] Fresh owner visual approval of fixtureVersion 5 — not yet requested or recorded.

## Technical review checklist — fixtureVersion 6 remediation (R11-1/R11-2/R11-3, self-assessed; independent review still needed)

- [x] R11-1: `validateOnFieldCount()` (general 7v7 ceiling, maximum-only) and
  `validateExactParticipantCount()` (B05's own scenario-specific exact-seven rule) are kept as
  two separate functions, never one hardcoded 7-player check inside the generic structural
  validator; the format/count is always passed in explicitly, never hardcoded inside either
  function.
- [x] R11-1: the previous negative test's backwards assertion (`validateSegmentSequence(tooMany)
  .toEqual([])` presented as proof of rejection) is replaced with a test that genuinely asserts
  rejection via `validateOnFieldCount()`; new tests cover duplicate occupancy, duplicate
  position, a six-player segment passing the general ceiling, and that same six-player segment
  failing B05's own exact-count rule.
- [x] R11-1: a dedicated test confirms the validator module still imports only TYPES from
  `combination-topology.ts` (never a value-level import of a database-adjacent module) —
  client-bundle safety preserved.
- [x] R11-2: every corrected narrative field was checked against the canonical chronology
  (`b05CanonicalLiveEvents`) and the positional record (`b05PositionalSegments`) directly, not
  assumed; no new canonical event was fabricated to justify any retained wording — the narrative
  was corrected instead, per the mission's own explicit instruction.
- [x] R11-2: `match_changes.option` uses the real, pre-existing `NO_MEANINGFUL_CHANGE` schema
  value (`src/lib/post-match/debrief/v1.ts`'s own `MATCH_CHANGE_OPTIONS`) — never an invented enum
  value.
- [x] R11-2: genuinely subjective coaching observations not tied to an observable event (effort/
  cohesion ratings, "winning the ball back high," "conceded twice from turnovers") were
  identified and left untouched — the correction targets only statements that contradicted a
  specific fact (score state, formation, event timing).
- [x] R11-2: the submitted debrief still validates against `debriefAnswersSchema`
  (`DebriefAnswersSection` v1); draft and completed confirmed to submit the identical debrief
  object.
- [x] R11-2: the actual rendering components (`debrief-read-only.tsx`, `post-match-summary-tab.tsx`,
  `after-match-overview.tsx`) were read directly to determine which corrected fields are
  genuinely visible on this candidate's own pages (Debrief tab's team note/match-changes/opponent
  memory) versus which are not rendered here at all (`b05Reflection.note`,
  `b05OpponentObservation.factualSummary`) — not assumed either way.
- [x] R11-3: `B05_MATCH_FORMAT`/`b05RotationEvents` now participate in `rawRecordsForHash` under
  stable keys in both lifecycle fixtures; new regression tests prove format/age-group/rotation/
  positional-segment/player-minute changes each independently change the hash, an unchanged copy
  reproduces the identical hash, and draft/completed reference the same source objects while
  retaining separate fixture identities (different hashes).
- [x] `npx tsc --noEmit`, `npx eslint`, `terminology:check`, `docs:check`, `policy:verify`, and
  both Vitest suites (node + components, full `npm test`, run solo — not concurrently with any
  other command) pass project-wide with no regressions (581 test files / 6422 tests node-only;
  142 test files / 870 tests component). One failure observed during an earlier run where
  `npm test` happened to execute concurrently with `policy:verify` — reproduced as the documented
  shared-test-DB contention pattern, not a real regression, and confirmed absent on the clean
  solo re-run.
- [x] `fixtureSha256` independently recomputed from the raw records in both `fixtures.test.ts`
  files for both candidates (not a copied literal).
- [x] No production route, data loader, schema, or derivation-engine file modified — only this
  fixture's own data, validators, and tests.
- [ ] Independent technical review of the R11-1/R11-2/R11-3 remediation — not yet performed.
- [ ] Fresh owner visual approval of fixtureVersion 6 — not yet requested or recorded.
