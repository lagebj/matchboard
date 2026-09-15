# ADR-0144: League operating surface — season rail, focused operational round, compact history

## Status

Accepted

## Context

The League route previously composed a period → round → match hierarchy where the entire scorebook history dominated the page, and a "feature round" shortcut fell back to "first non-finalized round" with a hard-coded `isCurrent: false` on every round. That fallback is not a temporal fact: it conflates "not yet finalized" with "happening now," so a round from weeks ago that a coach never finalized could be presented as if it were the current round, while an actually-current round with a `FINALIZED` selection state would not be recognised as current at all.

Matchboard already owns the facts needed to make "which round is current" a temporal fact rather than a selection-state guess:

- real match kickoff dates, resolvable to Matchboard's canonical Europe/Oslo display ISO week (ADR-0137);
- canonical plan-integrity signals with real match/team ownership (`src/lib/selection/compute-plan-integrity.ts`);
- canonical match lifecycle status, which already distinguishes "finalized the plan" from "played the match" from "completed the report" (`src/lib/selection/planning-boundary.ts`);
- the existing `MatchLineup`/`formationId` fact for tactical preparation;
- the existing configured `Team.kitColor` for team identity.

The Touchline direction also requires operational route compositions to lead with the one thing a coach needs to look at now, and to keep finished history dense and out of the way rather than dominating the page.

## Decision

League becomes a season-rail → focused-operational-round → compact-recent-history composition (`LeagueSurface`).

### Temporal current round

A round is CURRENT only when at least one of its scheduled (non-cancelled) matches falls in the current Europe/Oslo display ISO week (`getDisplayIsoWeekKey()`/`getDisplayIsoWeekLabel()`, added to `src/lib/date-utils.ts`). Rounds spanning multiple weeks that include the current week are also CURRENT. This replaces the previous "first non-finalized round" fallback (defect A), which is removed entirely — a round's selection state (`DRAFT`/`READY`/`FINALIZED`) is never used to infer whether it is happening now.

### Default focus resolution

When the URL does not pin a round, the default focused round resolves in a fixed order: a valid `?round=` for the active league season; else the temporally current round (tie-broken by actionable attention, then earliest kickoff, then round id); else the nearest future round; else the most recent past round still needing closure; else the most recent past round overall; else the first unscheduled real round; else none. This is implemented once in `buildLeagueOperatingViewModel()` (`src/lib/touchline/presentation/league-view-model.ts`) and is not duplicated in any component.

### Season rail

`LeagueSeasonRail` renders one slot per calendar ISO week across the active league season's real `LeagueSeason.startDate`/`endDate` range (`FixturePeriod.startDate`/`endDate`, extended onto `src/domain/fixtures/types.ts` and populated in `src/domain/fixtures/service.ts`), including weeks with no scheduled round (rendered but non-interactive). State (current/attention/needs-closure/final/upcoming/empty) is conveyed by marker glyph and text label together, never colour alone, and the current/selected slot auto-scrolls into view.

### Signal ownership and match issue resolution

A plan-integrity signal is attached to a match row only when it is truthfully owned by that match (`signal.matchId === match.id`) or, absent a match id, by that match's team (`signal.teamId === match.teamId`); otherwise it remains a round-level signal only. This ownership check is computed once in `getFixturesOverview()` (no duplicate `computeRoundPlanIntegrity()` calls) and exposed as `FixtureRound.roundLevelPlanningSignals` / `FixtureMatch.planningSignals`.

Each focused-round match row resolves to exactly one primary operational issue via `resolveMatchIssue()`, in priority order: cancelled > owned BLOCKED signal > owned DECISION_REQUIRED signal > report missing (`played`) > report incomplete > report complete (`done`) > tactics/lineup missing (no `MatchLineup` row with a non-null `formationId`) > live > ready. A match can only show `Ready` when none of the above apply.

### Team identity strip

`TeamIdentityStrip` (`src/components/touchline/identity/team-identity-strip.tsx`) renders a narrow decorative (`aria-hidden`) accent from the team's existing configured `Team.kitColor`, resolved through the canonical `resolveKitColorSwatch()` — never a new colour model, and never inferred from team name text. It carries team identity only: it never changes with warning/decision/result/current-selection state, which are conveyed elsewhere in the row via icon + text.

### Compact recent history

Completed rounds keep the existing dense `ScorebookRoundSection`/`ScorebookMatchRow` grammar unchanged (`LeagueRecentRounds`, capped at 2 rounds) with the remainder behind a local, non-persisted "Show earlier rounds" disclosure (`LeagueEarlierRounds`). Operational focused-row components are never forced onto finished history.

### URL as selection authority

`season`/`round` query params on the League route are the sole selection authority; there is no separate client-only selection state that could drift from the shareable URL.

## Consequences

League leads with the round a coach actually needs to act on, backed by a real temporal fact instead of a selection-state guess.

`getFixturesOverview()` performs one additional batched `MatchLineup` query (`matchId`/`formationId` only, no per-match query) and reuses the existing cached `computeRoundPlanIntegrity()` result per round — no new N+1 query pattern.

No Prisma migration is required; `Team.kitColor`, `MatchLineup.formationId`, and `LeagueSeason.startDate`/`endDate` already exist.

The previous `buildLeagueViewModel()`/`LeaguePeriodInput`/`LeagueRoundInput` view-model API and its "first non-finalized round" fallback are removed; there is exactly one League round-hierarchy view-model builder (`buildLeagueOperatingViewModel()`).

## Alternatives rejected

### Keep "first non-finalized round" as the current-round definition

Rejected because it conflates selection-plan completeness with real-world timing (defect A) and produces the wrong featured round whenever a coach leaves an old round un-finalized or finalizes a round early.

### Infer team kit colour from team name text (e.g. "Rød", "Hvit")

Rejected because it duplicates/guesses at a colour model that already exists as `Team.kitColor`, and would silently diverge from a team's actually configured colour.

### Force the dense scorebook match-row grammar onto the focused operational round, or the operational match-row grammar onto finished history

Rejected because the two grammars answer different questions ("what do I need to do now" vs. "what already happened") and forcing one onto the other's data would either bury the actionable state a coach needs now or turn finished history into a noisy operational surface.

### Persist "earlier rounds expanded" and route-level selection outside the URL

Rejected because the URL is the correct, shareable selection authority (04 "URL as state"); the disclosure toggle is deliberately local, ephemeral UI state with no cross-device meaning.

## Relationship

Builds on ADR-0134 (Touchline sports-scorebook grammar) and ADR-0136 (Touchline Design Atlas current/upcoming-round shortcut pattern), replacing the shortcut's underlying temporal defect rather than its overall "shown twice, once as a shortcut" composition idea.

Reuses ADR-0137's Europe/Oslo display-timezone authority for all week/current-round computation.

Reuses ADR-0101's canonical match lifecycle vocabulary for past-round closure and live-row states.

Supersedes the prior League Atlas/production composition and its `buildLeagueViewModel()` view model where this ADR differs from them.
