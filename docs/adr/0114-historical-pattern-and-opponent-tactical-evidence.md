# ADR-0114: Historical Pattern and Opponent Tactical Evidence

## Status

Accepted

## Context

The Evidence-Informed Match Planning programme's Bundle 2
(`.matchboard-work/evidence-informed-match-planning/`, a temporary, gitignored implementation
work bundle) asks Matchboard to describe historical patterns — match-phase tendencies, opponent
tactical tendencies, and our factual response to them — with explicit scope, exposure, recency
and confidence, and never invent an opponent tactical tendency beyond what has actually been
captured.

Repository audit before this bundle found:

- **Match phases**: ADR-0113 (Bundle 1) already produces named phase windows (opening 5/10,
  immediately after restart, late period, final 10/5) per `MatchStateInterval`, but nothing
  aggregates them across a team's matches into a pattern.
- **Opponent tactical capture**: `OpponentEncounterObservation.playingStyleTags`
  (`src/lib/opponents/playing-style-tags.ts`) already exists as a per-match, coach-selected,
  structured tactical fact (`OpponentPlayingStyleTag` enum) — the "smallest existing owner that
  can capture observable tactical facts" PROGRAMME.md asks to extend, per D-017. It is
  **League-only**: `OpponentEncounterObservation.matchId` is a required, unique field with no
  Event-match equivalent (AGENTS.md's Canonical post-match learning section already documents
  this as a known, deliberate scope boundary — Event keeps only a free-text
  `opponentObservation` string). No aggregation across observations existed.
- **Opponent strength** (`sporting-level-aggregation.ts`) is a separate, already-generalized
  (League + Event), already-aggregated evidence type with its own `unknown`/`low`/`medium`/`high`
  confidence scale and 12-month recency window (D-016: opponent strength and tactical tendency
  are different evidence and must not be conflated).
- **Historical catch-up**: `opponent-replay.ts` (ARR-0031, "Populate opponent levels") already
  reprocesses history, but only for opponent sporting-level evidence
  (`recordOpponentSportingEvidenceForRef`) — not the full canonical `runPostMatchLearning()`
  pipeline (actual timeline, player evidence, combination evidence, opponent evidence). Bundle 1
  fixed two real bugs in `rebuildActualTimeline`/`rebuildEventActualTimeline` (period-crossing
  ordering, two-half Event truncation) whose fix only reaches *existing* data on the next rebuild
  of that match — nothing reprocessed historical matches yet.
- **A real, separate bug** was found and fixed while building this: `opponent-replay.ts`'s
  `from`/`to` date-range options were each applied as a *separate* conditional object spread
  keyed `startsAt`/`occurredAt` — `{ ...(from ? {startsAt:{gte}} : {}), ...(to ? {startsAt:{lte}}
  : {}) }` — so the second spread silently clobbered the first instead of merging both bounds
  into one range object. Supplying both `from` and `to` (the admin "Populate opponent levels"
  page's own normal use) silently dropped the `from` bound.

## Decision

1. **Match-phase pattern evidence is derived, not persisted**, extending Bundle 1's
   `MatchStateInterval`/`getMatchPhaseWindows` rather than a new canonical fact model
   (`src/lib/evidence/match-phase-pattern-evidence.ts`). Team-season scoped
   (`getTeamSeasonMatchPhasePatterns(leagueSeasonId, teamId, orgFilter)` — D-003: a League team is
   primarily a team-season instance). Aggregated by `(period, phase)` pair, not phase alone —
   "opening 5 of the first half" and "opening 5 of the second half" are kept distinct rather than
   merged into one generic "match opening" bucket, since a coach's actual question differs for
   each. A goal may legitimately count in more than one overlapping window (a 3rd-minute goal is
   inside both "opening 5" and "opening 10"). Confidence reuses the shared `ConfidenceLevel`
   (`combination-topology.ts`): `INSUFFICIENT` &lt;3 matches, `EMERGING` 3-5, `ESTABLISHED` 6+ —
   explicit, tested thresholds sized for a youth-league season (typically 10-20 matches). A
   group-longitudinal variant is deliberately deferred (not required by this bundle's completion
   condition); see CURRENT-STATE.md.

2. **Opponent tactical tendency aggregates `OpponentEncounterObservation.playingStyleTags`**
   (`src/lib/opponents/playing-style-aggregation.ts` + `playing-style-query.ts`), League-only for
   now — generalizing `OpponentEncounterObservation` to Event matches is a separate, larger
   schema decision this bundle does not make speculatively. Confidence reuses the same shared
   `ConfidenceLevel` (`INSUFFICIENT` &lt;2 occurrences, `EMERGING` 2-3, `ESTABLISHED` 4+) —
   **not** sporting-level's unknown/low/medium/high scale, per D-016. A 12-month recency window
   (mirroring `sporting-level-aggregation.ts`'s own `WINDOW_MONTHS`) excludes stale observations
   from ever presenting as current certainty (TEST-MATRIX.md §17). Nothing is persisted — the
   same on-the-fly-aggregation pattern `aggregateSportingLevel()` already established for
   opponent evidence, not a new "aggregate" table.

3. **"Our response to opponent tendencies"** (`deriveOpponentTendencyOutcomes()`) is a small,
   purely descriptive join: for each non-`INSUFFICIENT` tendency, sum the factual
   `OpponentSportingEvidence.goalsFor`/`goalsAgainst` already recorded (by the existing canonical
   pipeline) for the matches that produced that tendency. No causal language, no new evidence
   source — reuses `OpponentSportingEvidence` exactly as already recorded.

4. **A new historical post-match-learning replay tool**
   (`src/lib/evidence/post-match-learning-replay.ts`,
   `replayPostMatchLearningHistory(organisationId, options)`) reprocesses every eligible
   completed League/Event match through the shared `runPostMatchLearning()` orchestrator
   (ADR-0104) — not a second, parallel historical-learning algorithm. This is a distinct tool
   from `opponent-replay.ts`'s narrower "Populate opponent levels" (which computes opponent
   sporting-level estimates specifically, including matches that predate `ActualPositionInterval`
   entirely); the new tool's job is running the *whole* pipeline (actual timeline rebuild +
   opponent evidence + player evidence + combination evidence) so existing data benefits from
   Bundle 1's bug fixes and from any future pipeline improvement, without a human needing to know
   which specific step changed. Per-match outcome is `APPLIED`/`SKIPPED`/`FAILED` (`FAILED` if
   any step failed, `APPLIED` if any step applied, `SKIPPED` otherwise) — idempotent and safe to
   rerun, since every step inside `runPostMatchLearning()` already is.

5. **Fixed a real, separate bug**: `startsAtRangeFilter()` (new,
   `src/lib/evidence/date-range-filter.ts`) merges `from`/`to` into one range object on one key,
   used by both the new replay tool and `opponent-replay.ts` (which had the identical bug, now
   fixed with a regression test).

## Consequences

- No schema changes. Everything new in this bundle is either fully derived (match-phase
  patterns) or aggregates an existing, already-persisted evidence source (playing-style tags,
  `OpponentSportingEvidence`) on read, matching D-002 ("derive first, persist selectively") and
  the precedent `aggregateSportingLevel()` already set.
- `opponent-replay.ts`'s `from`/`to` date-range filtering now actually narrows results when both
  bounds are supplied — a real, user-facing correctness fix to the "Populate opponent levels"
  admin tool, independent of anything else in this bundle.
- Bundle 3 (long-term observability surfaces) is expected to be the first UI consumer of
  `getTeamSeasonMatchPhasePatterns`/`getOpponentTacticalTendencies`/`getOpponentTendencyOutcomes`
  — this bundle deliberately ships the domain/aggregation layer only, per the programme's own
  Bundle 2/Bundle 3 split.
- Generalizing `OpponentEncounterObservation` (and thus playing-style tag capture) to Event
  matches remains open, undecided scope for a future bundle/ADR if Event opponent tactical
  evidence is ever needed — not assumed or partially built here.

## Migration

None (additive; no schema change). Existing organisations gain corrected historical
`ActualPositionInterval` data (Bundle 1's fixes) and any newly-computable opponent/player/
combination evidence only once `replayPostMatchLearningHistory()` is actually run for them —
this bundle ships the tool; wiring it into an admin-triggered action/route is deferred the same
way `opponent-replay.ts`'s own UI wiring (`opponent-population-actions.ts`) was a separate,
later step from its underlying domain function.

## Supersedes

None (extends ADR-0104's shared learning pipeline and ADR-0113's canonical match-state timeline;
does not change either).
