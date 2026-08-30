# ADR-0108: Weekly Coaching Context is a derived, non-persisted read model shared by Today and the Round Board

## Status

Accepted

## Date

2026-08-30

## Context

Coaches currently have three separate mental models for "what happened / is happening / matters
next" at the weekly grain, with no single surface answering all three:

1. **During the current week**: Today (`/o/{orgSlug}/today`) already shows *today's* matches
   (`AssistantCommandCentre.todayMatches`, strictly calendar-day-scoped) and round-level plan
   integrity, but nothing spans the whole ISO week a coach is actually operating in.
2. **After the week's football is complete**: the coach has to open the Round Board, individual
   match reports, and player profiles separately to reconstruct "who played, who didn't, who
   moved" for a week that just finished. Insights pages (`Opportunity Gap`, `Opportunity Quality`,
   `Player Combinations`, etc.) answer season-long questions, not "what happened this specific
   week."
3. **When planning the next round**: the Round Board (`/rounds/{matchRoundId}`) has no
   at-a-glance view of what happened the week before, even though that context (who had no
   appearance, who supported another team) is directly useful input to the coach's own judgement
   for this week's plan.

Matchboard already has two directly relevant, already-accepted architectures this feature must
sit on top of, not duplicate:

- **ADR-0107 (situational decision support)**: one derived projection
  (`SituationContext`/`CoachSituationProjection`) over existing domain state, inferring
  `MATCHDAY`/`NEXT`/`LONG_TERM` and producing ordered `CoachDecision`s from
  `DecisionCandidateProvider`s. `docs/domain/situational-decision-support.md`'s own Phase 8
  status explicitly lists "further candidate providers" as legitimate optional future work, and
  states the existing five providers already satisfy Phase 3's own requirement — this ADR does
  **not** add a sixth provider for the weekly feature's core content (see Decision §3).
- **Canonical plan-integrity and planned-vs-actual semantics**
  (`src/lib/selection/compute-plan-integrity.ts`, `src/lib/insights/planned-vs-actual-delta.ts`)
  already own "available player without a planned opportunity" and "planned vs. actual
  deviation" as facts. AGENTS.md's "Canonical data truth" section is explicit that every
  important fact must have one documented canonical source, and this ADR must not create a
  second one.
- **The League/Event boundary** (AGENTS.md "Event squad planning" §"Integration boundaries",
  "GuestPlayer and the shared match participant model"): Event participation must never silently
  become league fairness/planning evidence, and `GuestPlayer`s must never receive longitudinal
  Player statistics.

The decision this ADR records: **how a new cross-cutting weekly view is built without violating
any of the above** — specifically, that it is a *derived read model*, not a new persisted entity,
not a new situational mode, and not a new source of truth for facts that already have one.

## Decision

**Weekly Coaching Context is one derived, recomputed-on-every-call read model
(`getWeeklyCoachingContext()`, `src/lib/weekly/`), consumed by both Today and the Round Board,
with no new Prisma model, no stored snapshot, and no scheduled generation.**

1. **Derived only, keyed by ISO week.** `getWeeklyCoachingContext({ organisationId,
   leagueSeasonId, weekKey })` recomputes its result from canonical tables on every call.
   `weekKey` (e.g. `"2026-W35"`) uses the *existing* ISO-week helpers in `src/lib/date-utils.ts`
   (`formatIsoWeekKey`, `getWeekRangeFromIsoWeekKey`) — no second week definition is introduced.
   No migration is required: every fact the read model exposes is derived from `Match`,
   `EventMatch`, `Selection`, `EventSquadPlayer`, `Availability`, `PostMatchReport`/
   `PostMatchPlayerActual`, `EventPostMatchReport`/`EventPostMatchPlayer`, and `MovementLedger`,
   all of which already exist.

2. **Reuses canonical facts; does not reimplement them.**
   - "Available without a planned league opportunity" is read directly from
     `computeRoundPlanIntegrity()`'s `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` signals for
     the `MatchRound` whose `name` equals the week's ISO week label (rounds are already named by
     ISO week label per `resolveOrCreateMatchRoundForDate()` — see AGENTS.md "Match schedule
     editing") — never a second "does this player have an opportunity" calculation.
   - "Planned but absent" / "unplanned appearance" reuse the exact classification meaning of
     `src/lib/insights/planned-vs-actual-delta.ts` (a `FINALIZED` selection with no `PRESENT`
     actual = planned-but-absent; a `PRESENT` actual with no matching finalized selection =
     unplanned), but the weekly loader batches these queries by `matchId IN (...)` across the
     whole week instead of calling that file's existing per-match-loop implementation — the
     *query shape* differs (an intentional, documented performance divergence, matching the
     precedent already set when `compute-plan-integrity.ts` was itself de-N+1'd), the *meaning*
     does not.
   - "Support appearances" reads `MovementLedger` directly (AGENTS.md: "the movement ledger is
     the authoritative record of player movement, not the Selection table alone") — never
     inferred from a player merely appearing for a team different from their core team.
   - Report completeness (`PROVISIONAL` vs. `COMPLETE`) reuses the same rule already established
     by `src/lib/rounds/round-progress.ts`'s `deriveRoundProgress()`: a `CANCELLED` match is
     excluded from the denominator entirely (never reporting debt); complete means `REPORTED` or
     `LOCKED`. Applied identically to the Event side (no separate Event report-completeness
     definition).

3. **Not pushed through the situational candidate pipeline by default.** The full weekly context
   is objective coaching context (`"23 players played this week"`), not a `CoachDecisionCandidate`.
   Facts that are *already* actionable (missing reports, available-without-opportunity) are
   *already* represented by the existing `plan-integrity`/`assistant-work-items` candidate
   providers — the weekly context consumes/displays the same underlying signals, it does not
   register a duplicate provider. No new provider is added in this initial implementation; if a
   genuinely new actionable decision is found later that no existing provider covers, that is a
   separate, additive change (a new `DecisionCandidateProvider`), not a reason to reopen this
   decision.

4. **Presentation, not policy.** The same read model is presented three ways
   (current-week pulse / completed-week review / next-round carry-forward) purely by branching
   the *UI component* on the already-computed `CoachSituationProjection.situation.primarySituation`
   (`MATCHDAY`/`NEXT`/`LONG_TERM`) passed down from `today/page.tsx`. This is a pure function of
   already-existing state — no new persisted mode flag, no second Rego entrypoint, no OPA
   involvement at all. During `MATCHDAY`, the detailed weekly panel does not render (or renders
   minimally) so it never outranks `MatchdayContextBanner`/immediate match work, matching
   ADR-0107's "protect attention" precedent for `suppress_nonessential_context`.

5. **League/Event activity shown together, fairness kept apart.** The read model's `activity`
   section lists League and Event matches for the week side by side (both use `getWeekRange`-
   compatible `startsAt` fields). Every other section is source-tagged: a player's Event
   appearance satisfies "had a recorded match appearance" but never substitutes for "had a
   planned league opportunity" — the two facts are computed independently and never merged into
   one boolean. `GuestPlayer`s are excluded from all player-identity statistics (`no recorded
   appearance`, opportunity, movement) by construction: every query filters on a non-null
   `playerId`, never falling back to `guestPlayerId` rows, matching the pattern already
   established in `src/lib/stats/player-category-stats.ts`.

6. **Identity is player ID; names are resolved once, for display only.** The domain-facing
   `WeeklyCoachingContext` type carries only IDs (`playerIds`, `matchId`s). A sibling
   `playerDisplayById`/`matchDisplayById` map, built once per call from the same already-loaded
   rows, is what UI components read to render names/links — matching the pattern ADR-0107's own
   candidate providers established (never persist or pass a player's name through domain-shaped
   data).

## Rationale

Every alternative that would create a second source of truth, a second week definition, a second
situational engine, or a persisted snapshot was rejected specifically because Matchboard already
has an accepted, working answer for each of those concerns (plan integrity, planned-vs-actual,
ISO week helpers, the situational projection) — introducing a parallel one would immediately
create the exact "several competing domain truths" problem AGENTS.md's "Canonical data truth"
section exists to prevent, and would need its own ARR the moment it shipped.

## Alternatives considered

### A fourth `CoachingSituation` value (e.g. `"WEEKLY"`)

- Benefits: would let the weekly view participate in situational ordering directly.
- Costs: changes `SituationContext`/the Rego `situation` entrypoint's contract — per ADR-0107's
  own Consequences section, "if a phase reveals the contract needs to change materially, that is
  a new ADR amendment, not a silent drift." A fourth situation is also conceptually wrong: weekly
  context is a *view* available during `NEXT`/`LONG_TERM`, not a mutually-exclusive fourth
  operating mode a coach is ever purely "in."
- Reason not selected: unnecessary contract change for a presentation-only need; `MATCHDAY`/
  `NEXT`/`LONG_TERM` already fully describe the coach's situation, and weekly context is how one
  page chooses to *present* the `NEXT`/`LONG_TERM` cases.

### A `WeeklySummary` Prisma model with scheduled (cron) generation

- Benefits: pre-computed, cheap to read; supports historical browsing trivially.
- Costs: a second, eventually-stale copy of facts that already live in canonical tables; requires
  a migration; requires background job infrastructure Matchboard does not otherwise have for
  coach-facing content; risks becoming exactly the kind of "second evidence system" AGENTS.md's
  "Canonical post-match learning pipeline" section was written to prevent for post-match facts.
- Reason not selected: explicitly excluded by the feature's own scope; the underlying tables are
  small enough per-organisation that a derived, batched read is fast without persistence (see
  Consequences).

### Route the whole weekly context through a new `DecisionCandidateProvider`

- Benefits: reuses the existing ordering/visibility machinery for every fact, including the
  purely informational ones.
- Costs: `CoachDecisionCandidate` is shaped for one actionable, situationally-ordered decision at
  a time — forcing "23 players played this week" through it would either produce a meaningless
  candidate or require weakening the type. It would also duplicate the existing
  `plan-integrity`/`assistant-work-items` providers' coverage of the genuinely actionable subset
  of weekly facts.
- Reason not selected: Decision §3 above; informational context and actionable decisions are
  different shapes with different existing owners.

## Consequences

### Positive

- One place (`src/lib/weekly/`) owns "what does a week mean," reusable by Today, the Round Board,
  and any future historical-browsing surface without redesign (the `weekKey` parameter already
  supports past weeks).
- No migration, no background jobs, no new operational surface to monitor.
- Every fact stays traceable to its one existing canonical source — a future auditor asking "where
  does this number come from" always finds exactly one answer.

### Negative

- Recomputing on every call means the weekly loader issues its own batched query set (bounded,
  not zero — this is new fact derivation, not a reuse of already-loaded Today data). This is an
  intentional, accepted cost, scoped by keeping queries batched by `matchId`/`playerId IN (...)`
  rather than per-match/per-player loops (see Migration and compatibility).
- Two UI surfaces (Today, Round Board) now depend on one shared loader; a bug in the loader
  affects both. Mitigated by the loader's own pure-derivation/DB-loading split (§Migration) being
  independently unit-testable without a database.

### Risks and mitigations

- **Risk**: a future contributor adds a new actionable fact directly into the weekly context
  instead of via a candidate provider, quietly reintroducing a second decision-priority path.
  **Mitigation**: documented explicitly in `docs/domain/weekly-coaching-context.md` and AGENTS.md,
  with the same "prefer no new provider; only add one when a fact is genuinely new, not
  represented elsewhere, and benefits from situational prioritization" test this ADR itself
  applied.
- **Risk**: "no recorded appearance" becomes noisy if computed against every active player
  org-wide rather than the players actually relevant to the week's football. **Mitigation**: the
  candidate pool for that fact is scoped to players belonging to a team/squad that had a match
  that week (see `docs/domain/weekly-coaching-context.md`), not the organisation's entire roster.

## Migration and compatibility

No schema migration. Implementation is split into a DB-bound loader (`get-weekly-coaching-context.ts`)
and a pure deriver (`derive-weekly-coaching-context.ts`) so the derivation logic is testable
without a database, per the existing repository convention (`compute-plan-integrity.ts`,
`round-progress.ts`). Rollback is a plain revert — nothing is persisted that would need cleanup.

## Related decisions

- Builds on: ADR-0107 (situational decision support) — consumes `SituationContext`/
  `CoachSituationProjection` unchanged; does not amend it.
- Builds on: ADR-0106 (GuestPlayer and the shared match participant model) — reuses its
  `playerId`-only statistics exclusion pattern and `resolveParticipantRef()` display convention.
- Builds on: ADR-0104 (canonical post-match learning pipeline) — reuses its `FootballMatchRef`-
  style discriminated-union thinking for iterating League/Event matches without merging their
  domain meaning.
- Does not amend: ADR-0107. No `SituationContext`/`CoachDecisionCandidate`/entrypoint change.
