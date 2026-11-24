# Gate D W1 — Data Truth and Fixtures

Every fixture is `sourceClass: "SYNTHETIC_LABELED"` — synthetic, labelled, deterministic — and
instantiates a real production type, never a fixture-only shape. Every `fixtureSha256` is
independently recomputed from that fixture's own `rawRecordsForHash` in a sibling
`__tests__/fixtures.test.ts`, never hand-copied (same discipline as every prior Gate A–C wave).

## D01 — `d01-overview-position-evidence/{agreeing,diverging}-positions/fixtures.ts`

- `player`: a `{ id, primaryPosition, secondaryPosition, tertiaryPosition }` shape matching what
  `PlayerPositionProfile` actually receives from the real Manage tab.
- `positionOptions`/`optionalPositionOptions`: **not fixture-only data** — these are the real
  production `playerPositionOptions`/`optionalPlayerPositionOptions` from
  `@/lib/player-form-options`, themselves built from `CANONICAL_TACTICAL_POSITIONS` (ADR-0154).
- `effectivePositions`: a `TouchlinePositionMapEntry[]` — the real type
  `PlayerPositionMapWidget`/`TouchlinePositionMap` consume. Support bands and confidence use only
  real enum values (`LIMITED/ESTABLISHED/STRONG/STRONGEST`, `LOW/MEDIUM/HIGH`).
- `currentStory`: a `PlayerCurrentStory` — the real type `selectPlayerCurrentStory()` returns.
  The fixture supplies an already-selected result directly (matching the view model's own
  documented "already-resolved, never re-run the selector" convention for this field), rather
  than re-implementing the selector's priority logic for a UI Lab fixture.

**Remediation (2026-11-24)**: an owner review correctly found that disclosing the (now-resolved,
see `SOURCE_RECONCILIATION.md` §4b) 14-role-vocabulary mismatch was not sufficient — D01 must
*demonstrate* the approved profile experience, not only disclose that production lacks it. Added
`ProfileRoleSummary` (`shared/profile-role-summary.tsx`, directional, both states): declared
profile role and evidence-derived profile role are each computed via
`collapseTacticalToProfile()` (reused from Gate A's `a12-profile-editor` directional study, the
one real mapping authority in this repo — not reimplemented) over `player.primaryPosition` and
the top-ranked `effectivePositions` entry, with the full exact-tactical breakdown kept accessible
via a `<details>` drill-down. No fixture *data* changed (same `player`/`effectivePositions`
values); only the rendering layer gained this component, so `fixtureVersion` bumped to 2 while
`fixtureSha256` (a hash of the data, not the rendering) is unchanged.

## D02 — `d02-evidence-dot-consolidation/{populated,sparse}-evidence/fixtures.ts`

- `stories`: `PlayerEvidenceStoryData[]`, the real input type to `buildPlayerEvidenceViewModel()`
  (`src/lib/touchline/presentation/player-evidence-view-model.ts`), passed through that real, pure
  function unmodified — no DB-backed loader is called (correctly so: a UI Lab fixture supplies the
  story content directly, matching every prior gate's fixture pattern of calling a real pure
  builder over fixture input rather than a DB-querying wrapper).
- `confidence` is always one of the real union values (`"Emerging" | "Established" | null`); the
  sparse fixture uses `null` throughout, never a fabricated label.
- The `POSITION`/`MATCH_CONTEXT` stories' `positionShares` use real position/context codes
  (`CB`/`RCB`/`CDM`, `CORE`/`SUPPORT`/`DEVELOPMENT`) with shares summing to 100 — no double-
  counting.
- The sparse fixture's `MATCH_CONTEXT` group has zero stories — `EvidenceGroups` (this wave's
  thin wrapper around the production rendering block) then omits that group entirely, matching
  the real Evidence tab's own `if (stories.length === 0) return null` — not a fabricated empty
  state.

**Remediation (2026-11-24) — corrected data-truth disclosure**: an owner review correctly found
the POSITION story's exact-sided breakdown (CB 58% / RCB 25% / CDM 17%) was not profile-level
consolidation, which is D02's actual acceptance question. Investigating further (not merely
fixing the symptom) found the deeper truth: production's real `buildEvidenceStories()`
(`src/lib/touchline/presentation/player-detail-production-adapter.ts`) **never populates
`positionShares` at all** — grep confirms zero occurrences in that file. Its real POSITION story
shows only a single top-position headline (e.g. "Centre Back leads recorded position support"),
no percentage breakdown of any kind. `positionShares` is a real, type-level field already wired
to the real `StackedDistribution` component (via the real page's rendering block), but no live
production data source currently feeds it — the original "already in production" framing of this
section was too strong; it was real-rendering-path-but-unpopulated, not real-and-populated.

Added `consolidateExactSharesByProfile()` (`shared/position-profile-consolidation.ts`) — a real,
deterministic 24-to-14 aggregation reusing `collapseTacticalToProfile()` (Gate A, no second
mapping table) — and `ConsolidatedPositionEvidence`, which renders the profile-level result
(CB 83% / DM 17%) as the primary `StackedDistribution`, with the exact breakdown (CB 58% / RCB
25% / CDM 17%) kept in a `<details>` drill-down, not dropped. A new
`__tests__/profile-consolidation.test.tsx` independently asserts: every exact code maps to its
correct profile role; profile-level and exact-level totals each sum to 100; no exact code
contributes to more than one profile bucket; the single-code sparse case still consolidates
correctly; a profile with zero contributing exact codes is absent from the result (never
fabricated as an observed zero, distinct from a genuinely-recorded zero-percent exact code, which
still contributes). `fixtureVersion` bumped to 2 on both states; `fixtureSha256` unchanged (no
fixture data changed, only the rendering).

**Revised classification**: not `ALREADY_IMPLEMENTED_AND_VERIFIED` as previously recorded for
this section — see `VISUAL_VS_CURRENT.md`.

## D04 — `d04-matches-coverage/{full,partial}-coverage/fixtures.ts`

- `matches`: `PlayerMatchRow[]`, the real type `PlayerMatchTimeline` consumes. The partial fixture
  includes three distinct real shapes: full coverage (`minutes: 90`, one actual position), no
  minutes recorded at all (`minutes: null`, `actualPositions: []`), and minutes recorded but no
  actual position (`minutes: 23`, `actualPositions: []`) — `PlayerMatchTimeline`'s own contract
  rule ("never infers a position from a planned lineup when actual data exists") means all three
  render their real, un-backfilled state.

**No disclosed data-truth limitation for D04.**

## D07 — `d07-attribute-evolution-review/{automatic-non-material,pending-material-approval,manual-edit-rebase}/fixtures.ts`

- `automatic-non-material`: `AssessmentChangeEntry[]`, the same shape
  `src/components/players/player-assessment-history-panel.tsx` (`AssessmentHistoryPanel`) already
  receives from its internal fetch. **Disclosed data-truth limitation**: that component owns its
  own `fetch("/api/players/[playerId]/assessment-history")` call, so a deterministic UI Lab
  fixture cannot pass it data as props without either monkey-patching the network layer or
  diverging from its real behavior. `AssessmentHistoryDisplay` reproduces its exact rendering
  logic (same labels, same layout) over fixture input instead — the same "reproduce the real
  rendering block over fixture input" strategy D02's `EvidenceGroups` already uses, not a new
  pattern. The one-point change, 4-match, 0.82-confidence fixture satisfies every ADR-0160 §4
  automatic condition.
- `pending-material-approval`: `MaterialApprovalProposal` — **corrected 2026-11-24**. The prior
  fixture showed baseline 6 with three automatic one-point increases (6→7→8→9) reaching a pending
  proposal of 9, which contradicted ADR-0160 §4's own math: cumulative movement crosses the
  2-point approval trigger at the *second* step, so a third automatic step to 9 could never
  legitimately occur. Corrected fixture: baseline 6 (coach-established), current applied value 7
  (one legitimately-automatic step), proposed value 8 (pending — NOT applied), cumulative-if-
  accepted +2. The type now separates `currentAppliedValue` from `proposedValue` explicitly,
  rather than one `baselineValue`/`proposedValue` pair that could be misread as already applied.
  **Disclosed**: no production schema or component for a pending attribute-approval review
  exists today (`AssessmentChange` always represents an already-applied change; it has no
  pending/decided distinction). The threshold math itself (`materiality-policy.ts`) is a new,
  shared, independently-unit-tested pure module with no production equivalent — it exists only so
  this directional candidate's own numbers are internally consistent and verifiably correct
  against ADR-0160 §4, not because a production module of this name exists.
- `manual-edit-rebase` (new, 2026-11-24, previously deferred): `AttributeRebaseRow[]` — **fully
  disclosed as directional**: today's `Player.evidenceCutoverAt` (confirmed directly in
  `src/lib/evidence/player-evidence-service.ts` and ADR-0092) is a single player-wide timestamp;
  there is no per-attribute cutover column, no lock field, and no production UI for any of this.
  The fixture models four attribute rows (manually-edited-pending-reaccumulation, manually-edited-
  eligible-to-resume, unaffected-independent-progression, and locked) as an explicit synthetic
  state machine — it does not imply or invent a specific database schema for the undecided
  persistence shape; that remains a production-implementation gap, recorded in `BLOCKERS.md`, not
  resolved by this candidate.

## D08 — `d08-primary-position-proposal/{strong-evidence,conflicting-note}/fixtures.ts`

- `PositionProposal`, a new type — **disclosed**: no production proposal/review persistence exists
  (ADR-0139's `evolvePlayerPositionProfile()` still writes automatically). Both fixtures use real
  `CanonicalTacticalPosition` codes (`CDM`/`RCM`, `RWB`/`RB`) and the real `exactPositionLabel()`
  function for the underlying exact-evidence label. The proposed primary is derived via
  `collapseTacticalToProfile()`, reused directly from Gate A's `a12-profile-editor` directional
  study (`src/app/dev/ui-lab/gate-a/shared/profile-position-model.ts`) — the one place in this
  repo that already implements the 14-role mapping table from
  `15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md`, reused here rather than reimplemented a
  third time. The strong-evidence fixture deliberately uses a sided exact code (`RCM`) as the
  underlying evidence to prove the proposal still targets the unsided profile role (`CM`), per
  that contract's own mandatory verification example #6.

**Correction, 2026-11-24**: `conflicting-note`'s prior fixture content did not actually conflict
with its own proposal (the note's wording supported the proposed role rather than contradicting
it). Replaced with a genuinely contrary observation (`fixtureVersion: 2`, `fixtureSha256`
independently recomputed, verified by its sibling test) — see `VISUAL_VS_CURRENT.md` for the full
before/after.

## D09 — `d09-evidence-lineage/{superseded-lineage,ambiguous-reference-rejected}/fixtures.ts`

- `EvidenceLineageEntry[]` (`superseded-lineage`) — **disclosed**: no existing production
  component surfaces qualitative-evidence supersession lineage to a coach; every real read helper
  in `qualitative-evidence-service.ts` (`ACTIVE_RUN_FILTER`) returns only non-superseded
  observations. The fixture is built directly from the real field shapes
  (`QualitativeEvidenceObservation`'s `statement`/`explicitness`/`createdAt`) and the real
  `supersededAt` semantics (`recordDeterministicExtraction()` marks a prior run superseded on
  resubmission, never deletes or rewrites it) — per the owner's decision #6, this exposes existing
  lineage rather than inventing a new supersession model. **Expanded 2026-11-24**: the display is
  now interactive (`EvidenceLineageDisplay`'s `interactive` prop) — simulated Edit and Retract
  locally reproduce the real resubmission/retraction mechanism (edit supersedes the active entry
  and adds a new active one; retract supersedes it with nothing replacing it, matching the
  service's own doc comment: "safe to call with zero observations (e.g. a coach retracted a claim
  on resubmit)... it just leaves nothing active to replace it with"). No real resubmission call,
  no database write.
- `RejectedExtractionSubmission` (`ambiguous-reference-rejected`, new 2026-11-24) — **disclosed**:
  models the real `extractionResponseSchema`/`validateExtractionSemantics` rule
  (`qualitative-evidence-extraction-contract.ts`) that a PLAYER/PAIR-scoped claim with no
  resolvable `playerRef` rejects the **entire** extraction response, producing zero observations.
  This is a different kind of fixture than a lineage entry — it represents a submission that never
  became an observation at all, which is the real, honest behavior, not an invented
  "ambiguous-but-kept" tier that doesn't exist in the actual contract.

**Disclosed gap carried across both D09 fixtures**: `QualitativeEvidenceExtractionRun` (the real
Prisma model) persists only a `sourceFingerprint` and `inputChars`/`outputChars` counts — never
the raw originally-submitted free text. The closest the real schema gets to "original wording" is
each `QualitativeEvidenceObservation.statement` (the structured claim derived from that text).
Neither fixture claims to show a byte-identical copy of the coach's original submission as a
separate persisted field, because no such field exists in the real persistence model today — a
true original-source view would require the specific `sourceType`'s own storage (e.g. a match
debrief record), which this module does not read.

## Running all Gate D tests

Gate D's 91 tests (as of the 2026-11-24 remediation) live under two different vitest configs and
both must be run to exercise all of them: `npm run test:components -- --run gate-d` (the default
components config, `src/**/*.test.tsx` only) runs 64 render-verification tests, but **not** the
hash-integrity `fixtures.test.ts` suites (27 tests) — those are `.test.ts`, not `.test.tsx`, and
only match the project's default `vitest.config.ts`. (One exception: D02's new
`profile-consolidation.test.tsx` mixes pure-function and render assertions in one file and is
itself `.test.tsx`, so it runs under the components config, not the default one — counted among
the 64.) Run `npx vitest run gate-d` (default config) to exercise the hash tests, or `npm test` if
it already covers both configs. Running only `test:components` silently skips the fixture-hash
verification — it will not fail, it just won't execute those tests.

## Fixture-identity convention

Every scenario's `fixtures.ts` exports a `FixtureIdentity` (type reused from
`@/app/dev/ui-lab/gate-a/shared/fixture-identity`, matching the Gate C W3 precedent of
cross-gate type-only reuse without a hidden coupling) plus `rawRecordsForHash`. No shared mutable
fixture-data module is introduced across scenarios (the issue #827 lesson: a shared-fixture-file
edit can silently invalidate a prior wave's Visual Authority approval via content-hash
fingerprinting) — Gate D is a new gate with no prior approvals to protect, but the same discipline
is kept regardless.
