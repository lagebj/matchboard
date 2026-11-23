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

**Disclosed data-truth limitation**: the register's acceptance question for D01 (XR-P01/XR-P04)
describes a "14-role profile vocabulary" that must never be conflated with the 24-sided tactical
vocabulary. No such second vocabulary exists in production — `playerPositionValues` (declared
positions) and `TouchlinePositionMapEntry.positionCode` (evidence-derived positions) are both
drawn from the same `CANONICAL_TACTICAL_POSITIONS` 24-code set (ADR-0154, Accepted, which
explicitly unified five previously-incompatible position vocabularies into one, specifically
including declaration and evidence). The fixtures therefore demonstrate the real distinction
that exists in this codebase — provenance (declared vs. evidence-derived) and support-band/
confidence, never a second code system — rather than fabricating a vocabulary split that isn't
there. See `VISUAL_VS_CURRENT.md` for the full disclosure.

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
  counting, every exact code individually named in the legend (never merged into an anonymous
  bucket).
- The sparse fixture's `MATCH_CONTEXT` group has zero stories — `EvidenceGroups` (this wave's
  thin wrapper around the production rendering block) then omits that group entirely, matching
  the real Evidence tab's own `if (stories.length === 0) return null` — not a fabricated empty
  state.

**No disclosed data-truth limitation for D02** — the register's acceptance question matches what
the real `buildPlayerEvidenceViewModel`/`EvidenceStory`/`StackedDistribution` stack already does.

## D04 — `d04-matches-coverage/{full,partial}-coverage/fixtures.ts`

- `matches`: `PlayerMatchRow[]`, the real type `PlayerMatchTimeline` consumes. The partial fixture
  includes three distinct real shapes: full coverage (`minutes: 90`, one actual position), no
  minutes recorded at all (`minutes: null`, `actualPositions: []`), and minutes recorded but no
  actual position (`minutes: 23`, `actualPositions: []`) — `PlayerMatchTimeline`'s own contract
  rule ("never infers a position from a planned lineup when actual data exists") means all three
  render their real, un-backfilled state.

**No disclosed data-truth limitation for D04.**

## D07 — `d07-attribute-evolution-review/{automatic-non-material,pending-material-approval}/fixtures.ts`

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
- `pending-material-approval`: `MaterialApprovalProposal`, a new type — **disclosed**: no
  production schema or component for a pending attribute-approval review exists today
  (`AssessmentChange` always represents an already-applied change; its `decidedAt`/`decidedBy`
  fields are only ever set by `recordManualRebase()`, never used to distinguish "pending" from
  "automatically applied"). The fixture encodes a genuine cumulative-drift example (three prior
  automatic +1 changes totalling +3 from baseline) using ADR-0160 §4's actual decided thresholds,
  not placeholder numbers.

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

## D09 — `d09-evidence-lineage/superseded-lineage/fixtures.ts`

- `EvidenceLineageEntry[]` — **disclosed**: no existing production component surfaces qualitative-
  evidence supersession lineage to a coach; every real read helper in
  `qualitative-evidence-service.ts` (`ACTIVE_RUN_FILTER`) returns only non-superseded
  observations. The fixture is built directly from the real field shapes
  (`QualitativeEvidenceObservation`'s `statement`/`explicitness`/`createdAt`) and the real
  `supersededAt` semantics (`recordDeterministicExtraction()` marks a prior run superseded on
  resubmission, never deletes or rewrites it) — per the owner's decision #6, this exposes existing
  lineage rather than inventing a new supersession model.

## Running all Gate D tests

Gate D's 56 tests live under two different vitest configs and both must be run to exercise all of
them: `npm run test:components -- --run gate-d` (the default components config, `src/**/*.test.tsx`
only) runs the 11 `page.test.tsx` render-verification suites (38 tests), but **not** the 11
`fixtures.test.ts` hash-integrity suites (11 tests) — those are `.test.ts`, not `.test.tsx`, and
only match the project's default `vitest.config.ts`. Run `npx vitest run gate-d` (default config)
to exercise the hash tests, or `npm test` if it already covers both configs. Running only
`test:components` silently skips the fixture-hash verification — it will not fail, it just won't
execute those 11 tests.

## Fixture-identity convention

Every scenario's `fixtures.ts` exports a `FixtureIdentity` (type reused from
`@/app/dev/ui-lab/gate-a/shared/fixture-identity`, matching the Gate C W3 precedent of
cross-gate type-only reuse without a hidden coupling) plus `rawRecordsForHash`. No shared mutable
fixture-data module is introduced across scenarios (the issue #827 lesson: a shared-fixture-file
edit can silently invalidate a prior wave's Visual Authority approval via content-hash
fingerprinting) — Gate D is a new gate with no prior approvals to protect, but the same discipline
is kept regardless.
