# ADR-0139: Evolving Player-Position Model (Automatic, No-Approval Evidence-Driven Evolution)

## Status

Accepted

## Context

The Atlas Follow-up bundle
(`.matchboard-work/matchboard_atlas_followup_roundboard_players_pitch_positions_2026-09-12/07_EVOLVING_PLAYER_POSITION_MODEL.md`,
Phase F3) requires that a player's declared position(s) (`Player.primaryPosition`/
`secondaryPosition`/`tertiaryPosition`) stop being treated as an immutable coach declaration and
instead become one connected model combining coach input with actual completed-football
evidence — with **automatic** evolution (no redundant coach-approval step for normal,
evidence-backed change), full hysteresis/stability so a single match never flips the primary
position, and complete audit/provenance for every automatic change.

This is architecture-affecting per AGENTS.md: it introduces a new automatic-mutation trigger for
a core domain field previously changed only by explicit coach action, a new domain concept
(evidence-driven position evolution), and ties into the canonical post-match learning pipeline
(ADR-0104).

### Audit findings

`docs/implementation/atlas-followup/current-position-model-audit.md` (Phase F0) and a deeper
follow-up audit for this ADR established:

1. **One canonical source of truth, confirmed.** `Player.primaryPosition`/`secondaryPosition`/
   `tertiaryPosition` are plain scalar fields; no `PlayerPosition` relation model exists. No
   dual-truth problem to resolve.
2. **No working automatic-mutation mechanism exists today** — re-confirmed independently.
3. **A substantial but entirely dead subsystem exists**: `PlayerProfileSuggestion` (a
   PENDING→ACCEPT/ADJUST/REJECT approval workflow, including a `targetType: "POSITION"` value
   whose decision path is a literal `"not yet implemented"` stub),
   `src/lib/player-development/{suggestions,position-experience,observations}.ts`, two orphaned
   API routes, and one orphaned UI component — see **ARR-0049** for the full account. Critically,
   this dead subsystem's entire design (approval-gated) would **directly violate** this bundle's
   explicit "no redundant approval" requirement even if completed — it was correctly not chosen
   as the foundation, though one still-correct piece of it
   (`evaluatePositionEvidence()`/`getPositionExperienceForPlayer()`, the POSITION-observation
   confidence/direction evaluator) is salvaged and reused rather than re-implemented.
4. **`AssessmentChange`** (`src/lib/evidence/assessment-change.ts`) is the actually-used successor
   audit mechanism for evidence-driven attribute changes (`player-evidence-service.ts`,
   auto-applies directly, no approval gate) — its own `targetType` union already includes
   `"POSITION"`, but its `beforeValue`/`afterValue` columns are `Decimal`, unsuited to storing a
   position-code string pair. `DecisionRecord` (`beforeSnapshot`/`afterSnapshot: Json?`) is the
   correct fit instead — and is also what AGENTS.md already mandates for player-development
   actions, and what `suggestions.ts`'s own (unreachable, but structurally sound)
   `decideAttributeSuggestion()` already used for its accepted-suggestion writes, independently
   confirming the choice.
5. **`ActualPositionInterval`** (ADR-0096/ADR-0104/ADR-0113) is the correct, sufficient actual-usage
   evidence source (minutes-by-position, per match, League+Event parity via the existing
   `matchId`/`eventMatchId` dual-nullable pattern) — nothing currently reads it for position
   mutation.

## Decision

### One new pure computation module, one new DB-bound orchestrator step

`src/lib/player-development/effective-position-profile.ts` (pure, DB-free):

- `computeEffectivePlayerPositionProfile(declared, matchHistory, observations, now)` — blends
  coach declaration (an immediate, additive support bonus per declared rank), recency-weighted
  windowed actual-usage minutes (from `ActualPositionInterval`, normalized to a share of the
  window), and a small capped bonus from POSITION-kind development-observation evidence (reusing
  the salvaged `evaluatePositionEvidence()`) into one internal raw-support score per position —
  never exposed to any UI as a number (contract §10). Returns the full
  `EffectivePlayerPositionProfile` contract shape: ranked positions (top 3 get
  `rank: 1|2|3`, others `rank: null` but still shown if they have any legitimate support),
  `supportBand` (four green bands, absolute thresholds on the raw score — not ranked relative to
  siblings, so a player with only one supported position still gets a meaningful band), and
  `confidence` (from windowed appearance count).
- `determineAutomaticPositionUpdate(declared, matchHistory, observations, now)` — the hysteresis
  gate. Compares the **natural** rank-1 position (from `computeEffectivePlayerPositionProfile`)
  against the currently-declared primary. Promotion requires **all** of: the candidate has at
  least `minAppearancesForAutomaticPromotion` (3) windowed appearances; its raw-support margin
  over the current primary is at least `promotionSupportMargin` (0.15); and that margin holds
  across **two consecutive evidence snapshots** — the current one, and the one computed with the
  single most recent match dropped (`persistenceUpdates: 2`). No new persisted "pending
  promotion" state is needed for this — the second snapshot is derived by re-slicing the same
  chronological match history, keeping the whole engine "derive on read," matching this
  codebase's established evidence-module convention. A manual coach edit resets the comparison
  baseline for free: it changes `declared` in the database, so the next automatic run's "current
  primary" is already the manually-set value — no separate reset mechanism required.

`src/lib/player-development/position-evolution-config.ts` — the one centralized constants file
(the contract's own §9 fallback values, used because no existing equivalent stability rule was
found — see audit finding 2). `ACTUAL_USAGE_MAX_SUPPORT` (1.0) is deliberately larger than
`DECLARED_POSITION_SUPPORT.primary` (0.5) — an earlier tuning pass set both close together
(0.6/0.55), which made automatic promotion mathematically unreachable (max possible margin 0.05,
below the required 0.15 threshold); caught by `effective-position-profile.test.ts`'s own
"promotes once a clear margin persists" test failing until corrected.

`src/lib/player-development/position-usage-history.ts` — `getPlayerActualPositionHistory()`, the
one new DB query: one player's `ActualPositionInterval` rows across **both** League (`matchId`)
and Event (`eventMatchId`), joined to each match's own date for chronological ordering, aggregated
to minutes-by-position per match. League/Event parity for free via the existing dual-nullable
pattern (ADR-0106). Explicitly excludes `BENCH`/`"unknown"` positions and only ever selects on
`playerId` (never falling back to `guestPlayerId`) — a guest player structurally cannot
contribute evidence through this query.

`src/lib/player-development/sync-effective-position.ts` — the DB-bound orchestrator.
`evolvePlayerPositionProfile(playerId, orgFilter)` loads the player's current declared triple,
match history, and observation evidence; calls `determineAutomaticPositionUpdate()`; if a change
is warranted, writes `Player.primaryPosition`/`secondaryPosition`/`tertiaryPosition` (the same
existing, validated columns every other position write already uses — no new column, no second
source of truth) and one `DecisionRecord` (`decisionType: "POSITION_PROFILE_EVOLUTION"`,
`createdBy: "position-evolution-engine"`, `beforeSnapshot`/`afterSnapshot` carrying the full
declared triple) in one transaction. `evolvePositionProfilesForMatch(ref, orgFilter)` runs this
for every player with a real (`playerId`-attributed, never `guestPlayerId`-only)
`ActualPositionInterval` row in that specific match.

### Wired into `runPostMatchLearning()` (ADR-0104), not a new trigger

`positionEvolution` is a fifth step in `PostMatchLearningResult`/`runPostMatchLearning()`
(`src/lib/evidence/post-match-learning.ts`), following the same try/catch-isolated,
never-blocks-another-step, always-recorded-in-`PostMatchLearningRun` pattern every existing step
uses. This satisfies contract §11 ("Evidence-derived positional mutation should occur only when
canonical match evidence is committed... not from an unsubmitted live plan") for free — the
pipeline only ever runs at report completion (League `completeReport()`, Event
`completeEventReport()`) or replay/reconcile, never from a live/draft state. League and Event
parity, idempotent re-run safety, and `PostMatchLearningRun` observability all come from reusing
the existing orchestrator rather than inventing a second trigger mechanism.

### What still does not create position evidence (contract §6, unchanged)

Planned lineup position, planned rotation position, formation-slot eligibility, exact-position
suitability/transferability, automatic lineup recommendation, and Round Board assignment remain
structurally excluded — `MatchPositionEvidence`'s type shape carries only `matchKey`/`playedAt`/
`minutesByPosition` (an actual-usage fact), with no field for any of those sources to occupy, and
nothing in `sync-effective-position.ts` reads from `MatchLineupAssignment`, `PlannedRotation`, or
any suitability module.

## Rationale

Reuses the exact architecture pattern every other evidence type in this codebase already
established (ADR-0104's orchestrator, `ActualPositionInterval` as the actual-usage source,
`DecisionRecord` for audit) rather than inventing a parallel evidence pipeline. The one piece of
pre-existing, superficially-relevant machinery (`PlayerProfileSuggestion`) was deliberately **not**
chosen as the foundation because its fundamental shape (approval-gated) cannot satisfy the
contract's explicit "no redundant approval" requirement — building on it would have meant either
violating the contract or maintaining two parallel and contradictory workflows.

## Alternatives considered

### Complete the dead `PlayerProfileSuggestion` POSITION decision path

- Benefits: reuses more existing schema/code; "Do not invent a second engine" read literally.
- Costs: fundamentally approval-gated — cannot satisfy "no redundant approval for normal
  evidence-backed evolution" without either weakening that requirement or adding an
  auto-accept-immediately shim that would make the PENDING/ACCEPTED states meaningless theater.
- Reason not selected: the contract's own explicit requirement rules this out; the audit confirms
  this mechanism is unreachable and was already superseded by a different (auto-apply) pattern
  for the adjacent attribute-rating case.

### A new persisted "pending promotion" tracking table for hysteresis

- Benefits: might feel more explicit than re-deriving two chronological snapshots on every run.
- Costs: a new table/columns, a new write path, another piece of state that can drift from the
  evidence it's supposed to summarize.
- Reason not selected: the two-snapshot approach is fully derivable from existing
  `ActualPositionInterval` data with no new persistence, matching this codebase's "derive on
  read, persist selectively" convention used throughout the evidence-informed match planning
  programme (ADR-0113 through ADR-0120).

### `AssessmentChange` instead of `DecisionRecord` for audit

- Benefits: `targetType: "POSITION"` already exists in its type union; would consolidate all
  player-development audit into one table.
- Costs: `beforeValue`/`afterValue` are `Decimal` columns, not suited to a position-code string
  pair (would require overloading `targetDescription` with ad hoc encoding).
- Reason not selected: `DecisionRecord`'s `Json?` snapshot fields are a direct structural fit, and
  it is the mechanism AGENTS.md already mandates for this category of change.

## Consequences

### Positive

- Coaches get genuinely automatic position evolution reflecting real deployment patterns, with no
  new UI friction — the profile a coach and every other system consumer sees simply stays current.
- Full audit trail for every automatic change, reusing an existing, already-queryable table.
- League/Event parity and idempotent re-run safety come for free from reusing
  `runPostMatchLearning()`.

### Negative

- `getPlayerActualPositionHistory()` issues per-player queries during report completion (one
  extra DB round-trip per match participant) — acceptable at this product's youth-league scale,
  matching the same disclosed-limitation pattern several prior evidence-informed-planning ADRs
  already carry (e.g. ADR-0120's position-context-evidence).
- The "explicit position observations" evidence source will, in practice, remain empty for every
  player until ARR-0049's disposition revives its creation UI (or a different UI is built) —
  disclosed, not hidden.

### Risks and mitigations

- **Oscillation.** Mitigated by the two-snapshot persistence gate — a single strong or weak match
  cannot flip the primary position; regression-tested directly
  (`effective-position-profile.test.ts`).
- **Miscalibrated support budget silently making promotion unreachable.** This exact failure mode
  was caught during this ADR's own implementation (see "Decision" above) and is now
  regression-tested, not just manually verified once.
- **A future evidence source accidentally leaking planned/suitability data into this model.**
  Mitigated structurally: `MatchPositionEvidence`'s type has no field for it, and a dedicated test
  in `effective-position-profile.test.ts` names the invariant explicitly.

## Migration and compatibility

- No schema changes. Writes only to `Player.primaryPosition`/`secondaryPosition`/
  `tertiaryPosition` (existing columns, existing validated values) and creates `DecisionRecord`
  rows (existing table).
- `PostMatchLearningResult` gains one additive field (`positionEvolution`) — every existing reader
  destructuring individual named fields is unaffected; the one test asserting a full mock object
  literal was updated for completeness (not required for compilation).
- Existing `Player.primaryPosition` values for every player already satisfy "coach declaration
  counts immediately" — no backfill needed; automatic evolution begins applying from the next
  completed match report onward.

## Security and operations

- All mutation happens inside `runPostMatchLearning()`, which already runs under the report
  completion actor's resolved `orgFilter`/`organisationId` — no new authorization surface, no new
  externally-triggerable endpoint.
- No new external data flow, secret, or write path beyond the existing `Player`/`DecisionRecord`
  tables.
- A position-evolution failure for one player never blocks report completion or another player's
  evolution (try/catch-isolated, matching every other learning step).

## Related records

- ADRs: ADR-0104 (canonical post-match learning pipeline), ADR-0096/ADR-0113
  (`ActualPositionInterval`), ADR-0106 (League/Event dual-nullable participant pattern),
  ADR-0120 (position-context evidence — the closest prior-art precedent for reusing an existing
  confidence classifier rather than inventing a second one).
- ARRs: ARR-0049 (dead player-profile-suggestion and position-observation subsystem) — discovered
  during this ADR's own audit.
- Security findings: None.
- Issues or plans: Atlas Follow-up bundle, Phase F3.

## Implementation evidence

- `src/lib/player-development/effective-position-profile.ts`,
  `src/lib/player-development/position-evolution-config.ts`,
  `src/lib/player-development/position-usage-history.ts`,
  `src/lib/player-development/sync-effective-position.ts`.
- `src/lib/evidence/post-match-learning.ts` (fifth pipeline step).
- Tests: `src/lib/player-development/__tests__/effective-position-profile.test.ts` (12 cases —
  coach declaration, actual-usage evidence, repeated-usage overtaking, hysteresis/persistence,
  demotion-not-deletion, manual-edit baseline reset, evidence-source exclusion, purity).

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-13

Record created alongside the first implementation of the evolving player-position model
(Atlas Follow-up Phase F3).
