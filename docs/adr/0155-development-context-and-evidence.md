# ADR-0155: Development-Context-and-Evidence Layer

## Status

Accepted (programme — delivered incrementally, following ADR-0152/ADR-0154's precedent; see
"Delivery" below)

## Context

A product-owner-authored specification
(`.matchboard-work/matchboard-development-context-programme/`, gitignored working bundle —
decisions normatively sourced from there, matching ADR-0152/ADR-0154's own sourcing precedent)
asks for a deterministic layer that can answer questions coaches already ask but Matchboard
cannot currently answer consistently:

- Which roles did a player actually play, and for how long?
- Where did recorded events occur on the pitch?
- Which teammates shared the pitch with the player?
- Did role exposure or events occur while leading, drawing, or trailing?
- Is a recent measurement materially different from the player's recent history?
- Which source records support an insight?
- Is a statement an observation, calculation, coach assessment, or AI hypothesis?

### What already exists and must not be re-derived

Repository inspection (not the bundle's own file list, which predates this programme and is not
treated as authoritative) confirms most of the hard derivation work already exists, under a
differently-named prior programme (Evidence-Informed Match Planning, ADR-0113):

- `src/lib/evidence/match-state-timeline.ts` — `buildMatchStateTimeline()`/
  `deriveMatchStateIntervals()` reconstruct, per completed match, maximal on-pitch-composition
  segments from `ActualPositionInterval` (`buildSegmentsFromIntervals`), each carrying
  `players: MatchStatePlayer[]` (position/line/lane), `period`, `matchPhases`, `durationMs`,
  and — critically — `scoreAtStart`/`scoreAtEnd`/`goalsFor`/`goalsAgainst`
  (`MatchStateInterval`, `MatchStateScore`). Game-state (leading/drawing/trailing) is a direct
  read of `scoreAtStart`, not a new score-chronology reconstruction.
- `src/lib/evidence/combination-topology.ts` re-exports `buildSegmentsFromIntervals` and uses it
  to compute named-combination shared minutes (`CombinationEvidence`, persisted) — a close
  cousin of, but not identical to, this programme's all-pairs co-presence (every pair, not just
  football-meaningful combinations). The new metric reuses the segment primitive and must not
  duplicate interval-intersection logic or touch `CombinationEvidence` itself.
- `OpponentEncounterObservation` (one row per match, `matchId @unique`) already has
  `playingStyleTags: OpponentPlayingStyleTag[]` (a 15-value enum covering the bundle's own
  suggested tag set — high press, low block, direct play, counter-attacking, and so on),
  `factualSummary` (free text), and `recordedBy`/`createdAt`/`updatedAt`. This already satisfies
  the bundle's "structured human-entered opponent context" requirement; it is a separate,
  qualitative-evidence concept (ADR-0152) consumed here as a read-only `EvidenceRef` source, not
  a model to add to.
- Canonical actual-role evidence is `ActualPositionInterval` (ADR-0129/ADR-0154) and the
  deterministic post-match evidence engine (ADR-0139/ADR-0116) — unchanged, extended only by
  reference.
- No coordinate field exists anywhere in the schema or in any event payload today
  (`LiveMatchEvent.payload` is opaque `Json?`; confirmed no `x`/`y`/coordinate key is ever
  written to it by any producer). Spatial event evidence has zero real data to operate on.
- No versioned derived-measurement, trend, or metric-registry model exists on `main` today.

Part A (ADR-0154) landed first, deliberately: this programme's role-exposure and
game-state-by-role measurements are dimensioned by tactical position, so building them on the
pre-ADR-0154 vocabulary would have been immediately stale.

## Decision

### 1. Three knowledge layers, kept structurally distinct

- **A. Direct facts and observations** — match events, score events, `ActualPositionInterval`,
  qualitative coach observations, `OpponentEncounterObservation`. Unchanged, canonical, never
  duplicated.
- **B. Deterministic measurements** — role seconds, zone event count/share, event rate over
  exposure, teammate co-presence seconds, role seconds by game state, trend signals. New in this
  programme; always derivable from A by one reusable domain/service implementation; never
  invents a fact A doesn't already contain.
- **C. Human assessments and AI hypotheses** — a coach-confirmed assessment is
  history-preserving evidence; an AI hypothesis is a cited, ephemeral interpretation that never
  becomes evidence on its own. A coach's explicit promotion action creates a new, separate,
  history-preserving assessment — promotion never rewrites or deletes the hypothesis it came
  from, and the AI never writes assessment rows directly.

### 2. New versioned derived-measurement store and trend store

Two new Prisma models (field lists per the bundle's §02, summarised): a derived-measurement
table keyed by `(playerId, scopeType, scopeKey, metricKey, metricVersion, inputRevision)`,
carrying `value`/`unit`/`numerator`/`denominator`/`presentationScale`/`exposureSeconds`,
`coverage` (`COMPLETE`/`PARTIAL`/`UNKNOWN`)/`eligible`/`missingInputs`/`warnings`, `dimensions`
(role/zone/teammate/game-state/event-type), `sourceRefs` (`EvidenceRef[]`), `inputRevision`
(canonical-JSON hash of the inputs that produced this row, excluding `computedAt`), and
`computedAt`; and a trend table carrying the same identity plus
`previousValue`/`latestValue`/`delta`/`direction` (`UP`/`DOWN`/`STABLE`)/materiality
threshold/quality. Confirmed via schema inspection that no existing model has equivalent
semantics — this is additive, not a replacement for anything.

### 3. Spatial event evidence ships as deterministic plumbing only, disclosed as inert

The 5×6 zone function, zone-count/zone-share metrics, and coordinate-coverage reporting are
built now because the bundle specifies them and because building the shape without the data is
cheap and reversible — but every surface that renders them must show "No recorded
coordinates" (or equivalent) rather than a misleadingly-empty chart, because no event carries a
coordinate today. This is a disclosed limitation, not a hidden gap: `MeasurementCoverage.
coverage = "UNKNOWN"` and `missingInputs` make it inspectable, not just visually absent. No
inferred or interpolated coordinate is ever synthesized to fill the gap.

### 4. Game-state and co-presence reuse `match-state-timeline.ts`, not a new reconstruction

`game-state.ts` derives `TRAILING`/`DRAWING`/`LEADING`/`UNKNOWN` per segment from
`MatchStateInterval.scoreAtStart` (a two-line comparison, not a new score chronology).
`co-presence.ts` computes all-pairs shared seconds over `buildSegmentsFromIntervals`'s own
output (the all-pairs aggregation is new; the segment reconstruction is not). Neither module
re-implements interval intersection, and neither touches `CombinationEvidence`.

### 5. Structured opponent context reuses `OpponentEncounterObservation`

No new opponent-context model is added. `EvidenceRef { kind: "MATCH_CONTEXT" }` points at the
existing row. If a future need exceeds what `playingStyleTags`/`factualSummary` already express,
that is a schema extension to the existing ADR-0152 model, proposed there — not a second,
parallel opponent-context table.

### 6. Provenance and quality are first-class, structural, and separate from AI uncertainty

Every derived-measurement and trend row carries `sourceRefs: EvidenceRef[]` (referencing, never
copying, source records) and `inputRevision` (so identical inputs at the same algorithm version
always reproduce the same row). `MeasurementCoverage`/`MeasurementQuality` describe *data*
completeness; AI confidence/uncertainty is a separate, unrelated concept living only in the
Assistant Coach evidence pack (§8). A metric has an integer `metricVersion`, incremented only
when its semantic output changes for the same inputs — never for a cosmetic or performance-only
change.

### 7. Recompute is wired at existing chokepoints, not a new trigger system

Position/event/score/timing corrections rebuild exactly the derived rows that depend on the
changed input (per the bundle's §05 mutation table), triggered from the same places
`post-match-learning.ts` and `actual-timeline.ts`'s existing rebuild functions already run from —
not a new generic invalidation framework. Recompute is idempotent: rerunning it against
unchanged inputs produces byte-identical rows (same `inputRevision`, same `computedAt`
notwithstanding).

### 8. Assistant Coach gets a new capability, not a rewritten existing contract

A 7th `AiAdvisorCapability` (alongside `post-match-review`/`round-review`/`lineup-review`/
`match-prep`/`weekly-team-review`/`development-cycle-review`, registered the same way in
`register-capabilities.ts`), gated by its own new boolean on `OrganisationAiSettings` (disabled
by default for every organisation, matching ADR-0152 §6's precedent for
`developmentCycleReviewEnabled`). It reuses the existing `ai/jobs` enqueue/runner,
provider-adapter/provider-adapter-registry (this repo's own structured-output layer — no Vercel
AI SDK usage in `src/lib/ai`), and job fingerprinting unchanged. Its evidence-pack/hypothesis
schema is new and separately versioned (per the bundle's `schemas/*.json`) — it is not a v2 of
the existing `AiAdvisorInsight` contract, because that contract's shape does not carry
evidence-pack provenance or hypothesis/evidence citation, and widening it in place would affect
every existing capability's consumers for a change only this one needs. A hypothesis is never
asked to recalculate a canonical metric — it only cites and interprets metrics layer B already
computed. Coach promotion of a hypothesis creates a new, separate, history-preserving assessment
row (distinct from both the ephemeral `AiAdvisorInsight` and the Q&A-shaped
`AiInsightClarification`) — never an automatic write, and never a mutation of the hypothesis it
came from.

### 9. Binding product rules (apply to every surface this programme touches)

- History is evidence — contradictory observations at different times are allowed and useful,
  never reconciled away.
- Exposure is not performance — role time and co-presence must never become a hidden quality
  score.
- Missing is not zero — absence of data renders as absence, never as a zero value.
- Rates must expose their denominator wherever displayed.
- Sparse event coordinates must never be presented as continuous movement tracking.
- Coach judgement remains explicit — no deterministic or AI output is ever silently treated as a
  coach's own assessment.

### Explicitly out of scope

GPS/computer-vision tracking; inferred continuous movement; AI-inferred opponent style stored as
fact; graph/network scoring; personality/psychological profiling; medical inference; global
player ratings/rankings; match outcome prediction; causal claims from correlation; automatic
persistence of AI conclusions; replacement of the current evidence engine or actual-position
timeline; broad Matchboard redesign outside the affected surfaces.

## Alternatives considered

- **Extend the existing `AiAdvisorInsight` contract to v2** instead of a new capability —
  rejected. The existing contract has six live consumers; widening its shape to carry
  evidence-pack provenance and hypothesis/evidence citation for one new capability risks every
  existing capability, for no benefit to them. A new, additively-registered capability isolates
  the blast radius to itself.
- **A new `MatchDevelopmentContext` model for opponent style**, as the bundle's own §02
  describes as a fallback — rejected once `OpponentEncounterObservation` was confirmed to
  already carry equivalent structured, human-entered, provenance-stamped opponent context.
  Adding a second model for the same concept would recreate exactly the "dispersed vocabulary"
  problem ADR-0154 just finished consolidating, one layer up.
- **Build real spatial tracking (or infer coordinates from existing data) instead of shipping
  inert plumbing** — rejected; out of scope per the bundle itself, and inferring coordinates
  from sparse non-spatial data would violate the "sparse event coordinates must never be
  presented as continuous movement tracking" rule by construction.
- **A new generic invalidation/recompute framework** — rejected; the bundle's own mutation table
  is small and closed (position/event/score/timing), and both existing chokepoints
  (`post-match-learning.ts`, `actual-timeline.ts`) already run on every mutation this programme
  needs to react to.

## Consequences

- Two new Prisma models (derived measurement, trend) and one new enum value
  (`AiAdvisorCapability`) plus one new `OrganisationAiSettings` boolean — additive, no existing
  column or table changes.
- A new, small `src/lib/development-context/` module becomes the one owner of role-exposure,
  spatial-zone, co-presence, game-state, and trend derivation — UI and reporting must read
  through it, never recompute a formula independently (mirrors ADR-0129/ADR-0154's domain-owner
  pattern for positions).
- Coach-facing surfaces (Player Detail, post-match report) grow a provenance inspector and
  several new, honestly-labelled "no data yet" states (coordinate coverage chief among them)
  rather than a complete picture — this is a deliberate, disclosed trade-off, not a defect.
- The Assistant Coach capability count grows from six to seven; each is independently gated and
  independently fingerprinted, so this adds operational surface area but no coupling between
  capabilities.
- Metric-registry maintenance (stable keys, versions, materiality thresholds) becomes an ongoing
  discipline: changing a metric's semantics requires a version bump, not a silent behavior
  change under an existing key.

## Migration

Schema changes are additive only (two new tables, one new enum value, one new boolean column
with a default). Backfill of historical matches is idempotent — rerunning it produces the same
rows for the same `inputRevision`. Historical matches with incomplete timing/position data
produce `PARTIAL`/`UNKNOWN`-coverage rows, never a fabricated complete one. No historical
`ActualPositionInterval`, event, or qualitative-evidence row is rewritten; derived rows are
rebuilt freely, raw evidence never is. Locked, coach-authored historical report text is never
silently rewritten by a recompute.

## Security and operations

New tables carry `organisationId` and follow the repository's existing tenant-isolation
convention (deny-by-default, server-side authorization unchanged by this ADR). AI job failures
are isolated to the Assistant Coach capability's own job/evidence-pack path and never block or
corrupt deterministic layer B — a failed or degraded AI run still leaves role-exposure,
co-presence, and game-state measurements fully available. No AI output is ever auto-persisted as
truth; every assessment-producing write requires an explicit coach action.

## Related records

- ADR-0113 — Evidence-Informed Match Planning; source of `match-state-timeline.ts`,
  `combination-topology.ts`, and `ActualPositionInterval`'s evidence role, reused here rather
  than re-derived.
- ADR-0116 — Outfield Role Suitability and Tactical-Function Evidence; source of this
  programme's "one business operation, one owning implementation" precedent, applied again to
  the new `src/lib/development-context/` module.
- ADR-0129/ADR-0154 — canonical tactical-position vocabulary; role-exposure and game-state-by-
  role measurements are dimensioned by this vocabulary and depend on it being settled first.
- ADR-0139 — effective-position/evidence engine; unchanged, read from by reference.
- ADR-0152 — coach learning loop and qualitative evidence, including
  `OpponentEncounterObservation` (reused directly, §5 above) and the
  `developmentCycleReviewEnabled`-style per-capability gating precedent this ADR's new
  capability follows.
- ARR-0040 — duplicated declared-position fit-tier implementation; unrelated to this programme's
  own scope, noted only because any future broad-role bucket this programme might need must not
  become a third independent copy.

## Delivery

Per this repository's sequential-PR policy, each numbered step ships as its own branch/PR,
merged and CI-green before the next starts:

- **B0** — this ADR.
- **B1** — deterministic primitives (`src/lib/development-context/`: types, metric registry,
  quality, versioning/input-revision hashing, spatial-grid function, game-state wrapper,
  co-presence aggregation).
- **B2** — match derivation service (`context-pack.ts`: role seconds, event rate, zone
  count/share + coordinate coverage, co-presence, game-state-by-role).
- **B3** — persistence (derived-measurement and trend Prisma models) and recompute
  orchestration wired at the existing chokepoints.
- **B4** — backfill/verify scripts, following the existing `backfill-*.ts`/`verify-*.ts`
  convention.
- **B5** — coach-facing reporting (Player Detail, post-match report, provenance inspector).
- **B6** — trend signals (six-eligible-match 3-vs-3 windowed comparison, materiality gates).
- **B7** — Assistant Coach capability (evidence pack, hypothesis schema, promotion flow).
- **B8** — hardening: full test matrix, documentation, rollout note, version bump.

## History

- 2026-10-05: Accepted. Sequenced after ADR-0154 (Part A) by explicit decision — role-exposure
  and game-state-by-role measurements are dimensioned by tactical position, so building them
  before the canonical vocabulary landed would have been immediately stale. Repository
  inspection performed before writing this decision down (not assumed from the bundle's own file
  list alone) confirmed `match-state-timeline.ts`, `combination-topology.ts`, and
  `OpponentEncounterObservation` already cover more of the bundle's own "current state" section
  than the bundle itself credits — reflected in "What already exists and must not be re-derived"
  above.
