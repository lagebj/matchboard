# ADR-0080: Unrated-player neutral fallback (§63), Best Lineup meaning reconciled (§67)

## Status

Accepted

## Date

2026-08-20

## Context

The consolidation programme's Phase 9 audit (`PROGRAMME.md` §63-67, rating and team architecture)
found two real issues, recorded in local execution memory
(`.matchboard-work/consolidation-programme/PHASES.md`'s Phase 9 section) before any code change:

**§63 "unknown != zero"**: AGENTS.md already stated "Missing ratings are treated as uncertainty,
not low ability or high ability," and the type layer represented this correctly
(`CompositionPlayer.overallStrengthRated: boolean`, `RoleStrengthProfile` fields typed
`number | null`, `CompositeRatings` fields typed `number | null`). But the code paths that
actually decide player sort/scoring order did not honor it — they used `rating ?? 0` directly,
making an unrated player sort identically to a genuine 0/10, i.e. worse than every rated player
including a real 1/10. Confirmed at every real occurrence across the codebase, not just the
audit's illustrative examples:
- `src/domain/team-composition/league-team-adapter.ts`: `overallStrength: ratings.overallLevel
  ?? 0` at player-normalization time, contaminating every downstream consumer in
  `deterministic-team-composer.ts`/`position-suitability.ts` (`sortByOverallStrength`,
  `computeRoleStrength`'s fallback, imbalance/swap-scoring sums — dozens of read sites, all
  fixed by correcting this one normalization point). The same file's `buildRoleStrength` also
  coerced an unrated goalkeeper-capable player's `goalkeeper` role-strength to `0` instead of
  `null`, unlike its three sibling fields (`defence`/`midfield`/`attack`), actively dragging down
  goalkeeper-coverage averaging rather than being correctly excluded from it.
- `src/lib/events/event-squad-generation.ts`: 11 separate `player.ratings.overallLevel ?? 0`
  call sites across `getRoleRelevantRating` and several sort/balance functions — no single
  normalization point exists here (`ratings.overallLevel` stays `number | null` throughout, read
  inline at each use), so each site needed fixing individually.
- `src/lib/events/event-match-support.ts` and `src/lib/best-lineup/best-lineup.ts`: one
  occurrence each, same pattern, in candidate-ranking and slot-assignment tie-breaking
  respectively.

**§67 "Best Lineup"**: `AGENTS.md` had zero mentions of "Best Lineup" despite it being a real,
shipped, coherent feature (`src/lib/best-lineup/best-lineup.ts`, `TeamBestLineup`/
`TeamBestLineupAssignment` Prisma models, a dedicated UI tab). §67 explicitly asks for this
meaning to be reconciled and written down rather than left implicit.

## Decision

**§63**: Add `NEUTRAL_UNRATED_RATING = 5` to `src/lib/ratings/player-rating.ts` (the existing
canonical rating-scale module — `RATING_MIN`/`RATING_MAX`/`RATING_SCALE_LABELS` already live
there), documented as the required fallback whenever a possibly-null rating must become a plain
number for sorting/scoring and cannot instead be excluded from an average (excluding it from an
average remains preferred where the code already does that correctly, e.g.
`computeRoleStrength`'s weighted average, `getPlayerOverallRating`/`getAverageRating`).

Fix each real occurrence:
- `league-team-adapter.ts`: `overallStrength` now falls back to `NEUTRAL_UNRATED_RATING` (fixes
  every downstream `team-composition` consumer at the single point of contamination);
  `buildRoleStrength`'s `goalkeeper` field now falls back to `null` like its siblings, exported
  for direct unit testing.
- `event-squad-generation.ts`: new local `effectiveOverallLevel(player)` helper (mirroring the
  file's existing `getRoleRelevantRating` centralization pattern), used at all 11 former `?? 0`
  sites.
- `event-match-support.ts`, `best-lineup.ts`: inline fallback changed to the shared constant.

No behavior change to the correctly-implemented paths (`computeCompositeRatings`,
`computeRoleStrength`'s null-excluding average, `computeTeamMetrics`'s `overallStrengthRated`
filtering) — only the sort/scoring consumers that were bypassing them.

**§67**: New "Best Lineup" section in AGENTS.md, positioned after "Selection architecture" (the
consolidation programme's own local audit is cited as the reason this is being written down now,
not a redesign). States the reconciled meaning: a *generated sensible starting point* that
becomes a *coach-preferred lineup* once locked/edited, scoped per team (not per match), distinct
from `team-composition`'s cross-team distribution scenarios. This documents existing, unchanged
behavior — no code change accompanies this half of the ADR.

## Consequences

- Real player-facing outcome change: an unrated player no longer sorts/scores as the worst
  possible candidate in team composition, event squad generation, event match support
  candidates, or Best Lineup slot assignment. A coach reviewing a newly-added, not-yet-rated
  player will now see them treated as average, not automatically passed over — matching the
  domain rule that was already written down but not enforced in code.
- `NEUTRAL_UNRATED_RATING` is a fixed constant (5, "Steady"), not a per-context dynamic average
  of the current candidate pool — simpler, more predictable, and consistent with the existing
  `RATING_SCALE_LABELS` midpoint. Revisit only if a real case emerges where a fixed neutral value
  produces a worse outcome than a pool-relative one.
- Regression tests added: `src/domain/team-composition/__tests__/deterministic-team-composer.test.ts`
  (`sortByOverallStrength`), `src/domain/team-composition/__tests__/league-team-adapter.test.ts`
  (new file, `buildRoleStrength`), `src/lib/events/__tests__/event-squad-generation.test.ts`
  (`getRoleRelevantRating`), `src/lib/events/__tests__/event-match-support.test.ts`
  (`getSupportCandidatesForEventMatch` ordering). `best-lineup.ts`'s tie-break fix has no
  dedicated new test — it requires DB-backed integration fixtures disproportionate to a one-line,
  narrow-blast-radius (already position-filtered) tie-break using the same proven-correct
  pattern as the other fixes.
- §64/§65/§66 (team composition semantics, capability balancing, team-level ability profiles)
  needed no code change — the Phase 9 audit found them already satisfied by architecture
  predating the programme.
