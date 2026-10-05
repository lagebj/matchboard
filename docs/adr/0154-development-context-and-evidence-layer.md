# ADR-0154: Development context and evidence layer — canonical sources, measurement storage, and Assistant Coach integration

## Status

Accepted (programme — delivered incrementally, following ADR-0146/ADR-0152's precedent; see "Delivery" below)

## Context

Matchboard already captures match activity (live events, goals/assists), actual on-field role
history (`ActualPositionInterval`, ADR-0096/ADR-0104/ADR-0113), qualitative coach evidence with
provenance (`QualitativeEvidenceObservation`, ADR-0152), and AI Advisor insights (ADR-0148,
ADR-0152). There is no deterministic layer that connects role exposure, spatial event evidence,
teammate co-presence, and game-state context into normalized, provenance-tracked measurements
that both coach-facing reporting and Assistant Coach can consume consistently.

An external implementation bundle
(`.matchboard-work/matchboard-development-context-programme/`, gitignored working documents —
decisions normatively sourced from there, not linked further since the directory is not part of
the durable repository, matching ADR-0152's own sourcing precedent) specifies this
"development-context-and-evidence" programme: role exposure from the existing interval model, a
5x6 spatial event grid, teammate co-presence, game-state splits, normalized metrics with explicit
denominators, deterministic recent-window trends, provenance/data-quality metadata, recompute on
canonical mutation, and Assistant Coach evidence packs with explicit AI-hypothesis promotion.

The bundle's own mandatory Stage 0 ("attachment points") requires locating existing canonical
producers/readers before any code is written. That review surfaced two findings that change how
this programme must be implemented, and one scope-reality gap:

1. **ARR-0052 (open, unresolved)**: "which position(s) did a player actually play in a match" is
   already computed three different ways in production — direct `ActualPositionInterval` reads,
   a stale, League-only `PostMatchPlayerActual.actualPositions` JSON snapshot
   (`position-exposure.ts`, `sporting-level-recording.ts`), and a third, independently-derived
   array in `get-player-match-history.ts`. The same underlying fact can legitimately look
   different depending which Matchboard surface a coach is looking at. This programme's
   `role_seconds` metric is defined on exactly the source ARR-0052 already names as canonical —
   building it without also closing the ARR would create a *fourth* divergent representation.
2. **ADR-0152 overlap**: the bundle's Stage 7 specifies a new, standalone schema-versioned
   "evidence pack" and "hypothesis" JSON contract for Assistant Coach (uncertainty
   LOW/MEDIUM/HIGH, supporting/contradicting evidence refs, explicit promotion into a
   coach-confirmed assessment). ADR-0152 already shipped materially the same capability —
   `AiAdvisorInsight.analysisRole` (`SUPPORTED`/`CONTRADICTED`/`UNRESOLVED`/`SURPRISING`/
   `RECURRING_PATTERN`/`NEXT_FOCUS`/`EVIDENCE_GAP`), `AiInsightClarification` for evidence-gap
   question/answer round trips, and evidence-ref-labelled, provenance-tracked context builders
   feeding `post_match_review`. Implementing the bundle's schemas literally, running alongside
   ADR-0152's framework, would create two competing AI-evidence systems for the same underlying
   need.
3. **Spatial-evidence data gap**: no event-coordinate field exists anywhere in the schema for a
   recorded match action. The only `x`/`y` pair in the whole schema is
   `EventMatchLineupAssignment.x`/`y`, a formation-board lineup-slot coordinate, unrelated to
   where an action actually happened. The 5x6 grid has no real data source yet.

## Decision

### 1. Canonical sources are unchanged and reconfirmed

`ActualPositionInterval` (and its producer, `rebuildActualTimeline()` /
`src/lib/evidence/actual-timeline.ts`) remains the sole role-exposure timeline. Existing match
events, goals/assists, and match timing resolution (`src/lib/live-match/period-config.ts`) remain
the sole sources for event counts, score chronology, and interval boundaries. No second
timeline, event store, or score store is created.

### 2. New deterministic domain module

A new module, `src/lib/development-context/` (types, spatial grid, interval intersection,
game-state intervals, metrics, trends, quality model, metric registry, context-pack assembly,
recompute orchestration, versioning), implements the bundle's deterministic primitives as pure,
unit-tested functions. This part of the bundle introduces no conflict with existing architecture
and is implemented as specified.

### 3. New schema (additive only, ADR-0105)

A versioned derived-measurement table, a trend table (or equivalent typed representation), and
structured match/opponent-context storage are added, matching the bundle's field-level
requirements (metric key/version, scope, numerator/denominator, coverage, source refs, input
revision). No existing raw-evidence table changes meaning.

### 4. ARR-0052 is resolved inside this programme, not deferred

Building `role_seconds` on `ActualPositionInterval` is used as the occasion to migrate
`position-exposure.ts` and `sporting-level-recording.ts` off `PostMatchPlayerActual
.actualPositions` onto the same interval-derived helper the rest of the codebase already uses
(`position-usage-history.ts` / `getPlayerActualPositionHistory()`), and to fold
`get-player-match-history.ts`'s independent third derivation onto that same shared helper. This
closes ARR-0052's identified dispersion as a direct consequence of building the new metric on the
correct source, rather than as separate, unscheduled follow-up work. Whether
`PostMatchPlayerActual.actualPositions` itself is removed outright or merely left write-only
pending a dedicated cleanup is decided at Stage 2 implementation time, based on how many
call sites remain once the above migrates.

ARR-0040 (duplicated *declared*-position fit-tier logic between team-composition and the Event
pipeline) is a related but distinct concern — planning-side position fit, not actual-match role
exposure — and stays out of this programme's scope.

### 5. Assistant Coach integration extends ADR-0152, not a parallel schema

The bundle's "evidence pack" concept is realised as a new, deterministic `measurements` section
(role seconds, zone metrics, co-presence, game-state splits, trend signals — each carrying
`metricKey`/`version`/`sourceRefs`/`quality` as the bundle specifies) fed into the existing
Assistant Coach context builders (starting with `post_match_review`,
`src/lib/ai/context/post-match-review.ts`), using the same `evidenceRefs`/fact-provenance
convention those builders already use. The bundle's "hypothesis" semantics (uncertainty,
supporting/contradicting evidence, missing evidence, explicit promotion) map onto ADR-0152's
existing vocabulary instead of a new parallel schema:

- a hypothesis's `uncertainty` and cited evidence are expressed through the existing
  `analysisRole` classification (e.g. `SUPPORTED`/`CONTRADICTED`/`UNRESOLVED`/`SURPRISING`) plus
  the review's existing evidence-ref labelling;
- an unresolved/missing-evidence case uses the existing `EVIDENCE_GAP` role and
  `AiInsightClarification` round trip rather than a new clarification mechanism;
- explicit coach promotion of an AI-originated insight into durable, human-confirmed evidence
  reuses the qualitative-evidence provenance convention already established by ADR-0152 §4
  (`QualitativeEvidenceObservation`, origin always coach-confirmed, AI inference never silently
  becomes coach evidence), extended with an AI-advisor-origin provenance tag rather than a new
  promotion pipeline.

No new "evidence pack" JSON Schema, hypothesis contract, or promotion flow is built standalone.
Numerical authority stays with application services; AI is never asked to (re)calculate role
seconds, zone shares, co-presence, game-state splits, or trend direction.

### 6. Spatial grid ships ahead of its data source

The 5x6 zone grid, zone metrics, and coordinate-coverage quality model are built exactly to spec,
including schema support for a future event coordinate. Because no event-coordinate capture
exists yet, every match will report "no recorded coordinates" (`coverage: UNKNOWN`,
`eligible: false`) until a separately-scoped coordinate-capture feature exists. This is a known,
accepted limitation — consistent with the programme's own "missing is not zero" principle — not a
defect of this programme.

### 7. Recompute/backfill follow existing repository conventions

Batch commands (`development-context recompute --match/--player/--all-completed`, `verify`) are
implemented as `scripts/*.ts`, run via `npx tsx`, support `--dry-run`, loop per-organisation with
tenant scoping, and are idempotent — matching every existing backfill script in `scripts/`. No
feature-flag framework is introduced; none exists today and the bundle does not require one.

## Alternatives considered

- **Build the bundle's standalone evidence-pack/hypothesis JSON schemas exactly as specified,
  alongside ADR-0152.** Rejected: produces two competing AI-evidence frameworks (cited evidence +
  uncertainty + explicit promotion) for the same underlying coach need, violating this
  repository's "one business operation, one owning implementation" rule and the bundle's own
  instruction not to create a parallel analytics product path.
- **Scope this programme strictly to new code and leave ARR-0052 as separate future work.**
  Rejected: the new `role_seconds` metric would otherwise become a fourth independent
  representation of "actual position played" unless it explicitly adopts and enforces the
  already-identified canonical source; resolving it now, as a direct consequence of the new
  metric's own construction, is cheaper than carrying a fourth divergent reader indefinitely.
- **Add a parallel "approximate event location" manual-entry feature to give the spatial grid
  real data immediately.** Rejected: out of the bundle's scope and this ADR's scope; recorded as
  a known limitation (§6) rather than scope creep.

## Consequences

### Positive

- One coherent, provenance-tracked deterministic context layer across post-match reporting,
  Player Detail, and Assistant Coach.
- Closes a real, previously-identified position-data dispersion risk (ARR-0052) as part of
  building the feature that would otherwise have made it worse.
- Assistant Coach evidence stays in one framework (ADR-0152) instead of splitting into two.

### Negative

- Stage 7 requires an explicit translation layer from the bundle's literal vocabulary onto
  ADR-0152's existing `analysisRole`/`AiInsightClarification` vocabulary, rather than a direct
  implementation of the bundle's schemas — more design work upfront than a literal build would
  have been.
- ARR-0052's resolution pulls two additional existing files
  (`src/lib/insights/position-exposure.ts`, `src/lib/opponents/sporting-level-recording.ts`) and
  `get-player-match-history.ts` into this programme's blast radius.
- The spatial-evidence deliverable ships functionally inert (no real coordinates to show) until a
  separate, unscheduled capture feature exists.

## Migration

Additive only (ADR-0105 expand/contract satisfied without a split): new derived-measurement,
trend, and match/opponent-context tables; no existing raw-evidence table changes meaning.
`PostMatchPlayerActual.actualPositions` read paths are migrated away as part of Stage 2; the field
itself is either removed or left write-only pending a dedicated cleanup, decided at Stage 2
implementation time. No locked, coach-authored historical report text is rewritten. No unbounded
historical AI backfill runs at deployment.

## Supersedes

None. Extends ADR-0096/ADR-0104/ADR-0113 (`ActualPositionInterval` as the canonical actual-role
timeline), ADR-0105 (migration safety), ADR-0146 (match timing/live-reporting authority), and
ADR-0148/ADR-0152 (AI Advisor provider architecture, evidence provenance, and the
`analysisRole`/`AiInsightClarification` framework this programme's Assistant Coach integration
extends rather than duplicates).

## Related records

- ARR-0052 (realised match positions have two persisted representations, with inconsistent
  consumers) — resolved by this programme's Stage 2, see §4 above.
- ARR-0040 (duplicated declared-position-fit implementation) — related but out of scope; not
  touched by this programme.

## Delivery

Delivered incrementally, one branch/PR per slice (sequential-PR policy, matching
ADR-0146/ADR-0152's own precedent):

0. This ADR (schema/architecture decisions, no code).
1. Deterministic primitives: spatial grid, interval intersection, game-state interval builder,
   quality model, stable canonical hashing, metric registry. Pure functions, unit-tested.
2. Match derivation: role exposure, co-presence, game-state role exposure, event counts/rates,
   zone counts/shares, coordinate coverage — plus ARR-0052 resolution (§4).
3. Persistence/recompute: schema migration, persistence mapper, input revision, match/player
   recompute orchestration, mutation invalidation hooks.
4. Backfill/verify: idempotent batch commands (`scripts/development-context-*.ts`), verification
   command.
5. Coach-facing UI: actual-role timeline, contextual measurements, event-location grid,
   coverage, co-presence, game-state split, provenance inspector — extending existing post-match
   report and Player Detail surfaces.
6. Trends: six-eligible-match 3-vs-3 series, exposure-weighted aggregation, materiality
   thresholds.
7. Assistant Coach integration: `measurements` context section, `analysisRole`/
   `AiInsightClarification` mapping (§5), explicit promotion onto existing qualitative-evidence
   provenance conventions.
8. Hardening: full test suite, migration/backfill verification, lint/typecheck/build, rollout
   documentation, metric-registry documentation.

## History

### 2026-10-05

Record created. Supersedes nothing; establishes the governing decisions (canonical sources,
Assistant Coach integration direction, ARR-0052 resolution, spatial-evidence scope limitation)
for the development-context-and-evidence programme before any implementation stage begins.
