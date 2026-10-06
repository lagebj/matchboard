# ADR-0156: Team Season Profile — deterministic season pattern layer

## Status

Accepted (programme — delivered incrementally, following ADR-0152/ADR-0155's precedent; see
"Delivery" below).

## Context

A product-owner-authored specification
(`.matchboard-work/matchboard_team_season_patterns_followup_2026-09-27/`, gitignored working
bundle — decisions normatively sourced from there, matching ADR-0152/ADR-0155's own sourcing
precedent) asks for a season-long Team Profile that surfaces evidence-backed football patterns
on Team Detail and the Teams overview: when a team tends to score/concede, which tactical themes
recur, which player contributions recur with real exposure, and which partnerships/corridors
repeat — without becoming another AI review cadence.

This is an additive follow-up to the ADR-0152 Coach Learning Loop programme. It is not a
replacement for weekly review, post-match review, opponent memory, qualitative evidence, or
five-week development-cycle review (ADR-0152), nor for the development-context layer (ADR-0154,
ADR-0155).

### What already exists and must not be re-derived

Repository inspection (not the bundle's own file list alone) confirms the hard derivation work
for this layer already exists:

- `src/lib/evidence/match-phase-pattern-evidence.ts` — `getTeamSeasonMatchPhasePatterns()`
  already aggregates goals for/against by `(period, phase)` for one Team/League Season, with
  exposure minutes, match count, and `INSUFFICIENT | EMERGING | ESTABLISHED` confidence
  (`classifyMatchPhaseConfidence()`). This is the direct foundation for match-rhythm patterns
  ("scores early" / "concedes late"). No second phase-window implementation is created.
- `src/lib/evidence/combination-topology.ts` / `combination-aggregation.ts` — per-match
  structural combination evidence (partnership, triangle, line, corridor, functional unit, full
  configuration) with minutes together, goals for/against while present, direct goal/assist
  contributions, approximate-timing marker, and `deriveConfidence(minutesTogether, matchCount,
  opponentDiversity)`; `aggregateSeasonCombinations()` already produces season summaries with
  opponent diversity. This is reused, not reimplemented, for the combination pattern family.
- `src/lib/evidence/qualitative-evidence-service.ts` (ADR-0152) already produces structured
  qualitative evidence from debriefs, reflections, report notes, opponent observations and
  clarifications, with active/superseded status and dedupe-by-statement. The season profile
  adds a season-wide aggregate on top of this; it does not reread raw report prose.
- `src/lib/ai/context/weekly-team-review.ts` and `development-cycle-review.ts` (ADR-0152) already
  own the `WEEKLY_TEAM_REVIEW` and `DEVELOPMENT_CYCLE_REVIEW` capabilities, their normalized
  context shape, fingerprinting, and player-evidence safety gates. The season profile is
  consumed as additional bounded context inside these existing calls; no new capability, cron
  cadence, or invocation path is introduced.
- `src/lib/ai/context/evidence-ref.ts`, `src/lib/ai/contracts.ts` (`EVIDENCE_REF_PATTERN`,
  `toRefSegment()`) and `src/lib/ai/fingerprints.ts` (`computeSourceFingerprint()`,
  `stableSerialize()`) already provide the evidence-reference and fingerprint conventions this
  layer reuses rather than duplicates.

## Decision

### 1. One deterministic, season-scoped profile — not another AI capability

Add a derived `TeamSeasonProfile` for `(organisationId, teamId, leagueSeasonId)`. It is computed
deterministically from existing canonical evidence (match-phase, combination, qualitative,
player actual minutes/goals/assists). It is never computed or ranked by an AI provider call.

Do not add `SEASON_TEAM_REVIEW` or any other entry to `AiAdvisorCapability`. Normal AI
invocation count is unchanged: opening Team Detail/Patterns or Teams overview never calls an AI
provider.

### 2. Derived state, not canonical evidence

The profile is a rebuildable snapshot, fingerprinted from canonical source state
(`computeSourceFingerprint()`), persisted as one JSON-payload row per team/season (`prisma`
model `TeamSeasonProfile`, see "Schema" below) — not one row per pattern. It can be rebuilt at
any time and must never become the only copy of a fact. Canonical sources (reports, live
events/timing, actual position intervals, combination evidence, qualitative evidence,
development observations, opponent context) are unchanged and remain authoritative.

### 3. Hard season boundary; League-Team scope only in V1

A profile belongs to exactly one League Season; previous-season evidence is never blended into
current-season pattern strength, trajectory, or top-pattern selection. V1 only considers League
matches for the selected Team + League Season. Event-match evidence keeps contributing to its
existing flows but is never silently attributed to a League Team — there is no Event-squad-to-
League-Team inference in this programme.

### 4. Confidence and trajectory are reused/separate, not a new score

Evidence sufficiency reuses the existing `INSUFFICIENT | EMERGING | ESTABLISHED` vocabulary
(no 0–100 score, no stars). A new, separate `trajectory` dimension (`NEW | PERSISTENT |
STRENGTHENING | WEAKENING | MIXED | DORMANT`) compares a bounded recent window (last 4 completed
matches within the same season) against season-to-date evidence, gated by transparent
effect-size thresholds rather than statistical significance testing. `ESTABLISHED +
WEAKENING` is a valid, intentional combination.

### 5. Pattern catalogue V1 is closed

Four families only: match rhythm (reusing `match-phase-pattern-evidence.ts`), tactical qualitative
themes (reusing qualitative evidence), player goal/assist contribution (exposure-gated, no
ranking), and combination patterns (reusing `combination-aggregation.ts`). No chemistry/influence
scores, no player rankings, no predictive claims, no causal language — only descriptive,
sample-size-visible, youth-safe language. `INSUFFICIENT` candidates are retained internally for
diagnostics but never surfaced as top patterns.

### 6. Existing AI reviews consume the profile; no new call

`WEEKLY_TEAM_REVIEW` and `DEVELOPMENT_CYCLE_REVIEW` each receive a bounded `seasonProfile`
section (max 12 / max 8 surfaced patterns respectively, family-capped, `ESTABLISHED` preferred
over `EMERGING`) inside their existing normalized context, with evidence refs that validate
against the existing `EVIDENCE_REF_PATTERN` and player refs resolved through the existing
ephemeral-ref-map mechanism. Development-cycle's existing player-evidence threshold cannot be
bypassed by a combination pattern. Trigger cadence for both capabilities is unchanged.

### 7. Team Detail becomes the primary season-pattern surface; Teams overview stays compact

Team Detail gains an explicit, URL-backed selected League Season (`?periodId=`), a compact
`Season patterns` summary (max 3) between the header and the tab rail, and a first-class
`Patterns` tab (deep family sections, max 5 strongest). No existing operational tab is removed or
merged into Patterns; `/review` remains the home for weekly/five-week Assistant Coach
interpretation. Teams overview gains at most one `Patterns` column/row with at most 2 compact,
deterministic chips per team (desktop column, mobile wrapped row) — no AI prose, no cross-team
ranking, loaded via a single batched, concurrency-capped profile lookup for the selected period.

### 8. Works fully with AI disabled

All deterministic surfaces (profile, summary, Patterns tab, Teams overview chips) function
identically whether or not the organisation has an AI connection. Assistant Coach sections are
simply absent when unavailable — no "AI required" placeholder.

## Schema

```prisma
model TeamSeasonProfile {
  id             String @id @default(cuid())
  organisationId String
  teamId         String
  leagueSeasonId String

  profileVersion    Int      @default(1)
  sourceFingerprint String
  payload           Json
  computedAt        DateTime

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organisation Organisation @relation(fields: [organisationId], references: [id], onDelete: Cascade)
  team         Team         @relation(fields: [teamId], references: [id], onDelete: Cascade)
  leagueSeason LeagueSeason @relation(fields: [leagueSeasonId], references: [id], onDelete: Cascade)

  @@unique([organisationId, teamId, leagueSeasonId])
  @@index([organisationId, leagueSeasonId])
  @@index([organisationId, teamId])
}
```

One row per team/season; the payload is the versioned, Zod-validated `TeamSeasonProfileV1` JSON
contract (`src/lib/team-season-profile/contracts.ts`). Not a relational analytics store.

## Explicit non-goals (deferred, not gaps)

Player personality/mentality inference, chemistry/influence scores, expected-goals-style
metrics without underlying event data, formation-superiority claims, opponent-strength-
conditioned identity, win-rate-by-player, plus/minus ranking, causal substitution impact,
league-wide comparison, predictive "likely to score/concede" output, automated selection
recommendations from these patterns, and Match Insights/post-match integration. These require
separate deliberation.

## Consequences

- Adds one new Prisma model and a bounded set of pure domain modules under
  `src/lib/team-season-profile/`; no new AI capability, cron schedule, or job trigger.
- Team Detail and Teams overview take on a new, deterministic read path that must stay fast
  (batched, concurrency-capped) at Teams-overview scale.
- Weekly/five-week Assistant Coach context grows (bounded) but its invocation frequency,
  trigger conditions, and existing safety gates are unchanged.
- A historic season's profile can still be rebuilt if canonical historic evidence is corrected —
  "historic" means season-scoped, not immutable storage.

## Delivery

Delivered incrementally, one branch/PR per slice, sequentially:

- **Slice 0** — this ADR, Zod contracts/enums, `TeamSeasonProfile` Prisma model + migration. No
  UI, no behaviour change.
- **Slice 1** — deterministic profile builder (source loader, fingerprint, match-rhythm/
  tactical-theme/player-contribution/combination candidate builders, evidence-strength filters,
  trajectory, top-pattern ranking). Pure, tested; no UI, no AI change.
- **Slice 2** — profile service (`getTeamSeasonProfile`/`getTeamSeasonProfiles`/
  `rebuildTeamSeasonProfile`), cache/staleness, bounded parallel rebuild, best-effort eager
  refresh hooks, tenancy tests.
- **Slice 3** — Team Detail season context + Patterns UX (URL-backed `periodId`, summary, tab,
  family sections).
- **Slice 4** — Teams overview compact patterns column/row.
- **Slice 5** — Weekly Team Review enrichment with bounded `seasonProfile` context.
- **Slice 6** — Development Cycle Review enrichment with bounded season context.
- **Slice 7** — presentation convergence, final light/dark/mobile review, full validation,
  version bump.

### History

- 2026-10-06: Accepted. Repository inspection performed before writing this decision down
  confirmed `match-phase-pattern-evidence.ts`, `combination-topology.ts`/
  `combination-aggregation.ts`, and the ADR-0152 qualitative-evidence service already cover the
  hard derivation work the bundle describes — reflected in "What already exists and must not be
  re-derived" above. Slice 0 (this ADR + contracts + schema) delivered in the same change.
