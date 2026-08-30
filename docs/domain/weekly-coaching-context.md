# Weekly Coaching Context

See ADR-0108 for the architectural decision. This document is the living contract: current
status, exact facts implemented, and what was deliberately deferred.

## Status

**Implemented (v1 scope).** One derived read model, consumed by Today and the Round Board.

```text
The weekly context is a derived view over existing Matchboard facts.
It is not persisted.
It does not create fairness debt.
It does not make selections.
It does not merge Event participation into league fairness.
It changes presentation according to the existing situational context.
```

## What this is not

- Not a stored report, snapshot, or scheduled job. `getWeeklyCoachingContext()` recomputes on
  every call from canonical tables.
- Not a fourth `CoachingSituation`. It is a presentation choice layered on the existing
  `MATCHDAY`/`NEXT`/`LONG_TERM` projection from `docs/domain/situational-decision-support.md` —
  see "Situational presentation" below.
- Not a second definition of "available without opportunity," "planned vs. actual," "report
  complete," or "ISO week." Every one of those facts has exactly one existing owner, reused
  directly (see "Canonical fact ownership").
- Not a new `CoachDecisionCandidate` provider in this implementation. The weekly context is
  descriptive coaching context; the genuinely actionable facts it surfaces (missing reports,
  available-without-opportunity) are already represented by the existing `plan-integrity`/
  `assistant-work-items` candidate providers. See "Why no new candidate provider" below.

## Week semantics

Reuses `src/lib/date-utils.ts` exactly: `formatIsoWeekKey()`/`formatIsoWeekLabel()` to derive a
week's key/label from a date, `getWeekRangeFromIsoWeekKey()` to get `{ startsAt, endsAt }` (UTC,
Monday 00:00:00.000 through Sunday 23:59:59.999) for querying. No second week definition exists
anywhere in this feature.

A `MatchRound`'s `name` is already the ISO week label it represents (set by
`resolveOrCreateMatchRoundForDate()` — see AGENTS.md "Match schedule editing"). The weekly loader
finds "the round for this week" by `matchRound.findFirst({ leagueSeasonId, name: isoWeekLabel })`
— it does not introduce a second week-to-round mapping.

## Lifecycle status

```ts
type WeeklyContextStatus = "IN_PROGRESS" | "PROVISIONAL" | "COMPLETE";
```

- **`IN_PROGRESS`**: at least one relevant match (League or Event) in the week is still upcoming
  or live.
- **`PROVISIONAL`**: every relevant match has been played (or the week has none that could still
  be upcoming/live), but at least one required post-match report is not yet `REPORTED`/`LOCKED`.
- **`COMPLETE`**: every relevant match's football has happened and every required report is
  `REPORTED` or `LOCKED`.

Reuses the exact completeness rule already established by `src/lib/rounds/round-progress.ts`'s
`deriveRoundProgress()` (a `CANCELLED` match is dropped from the denominator before any
played/reported counting — cancelled matches never create reporting debt) and applies the
identical rule to Event matches inline (no separate Event report-completeness threshold; there is
no exported pure helper for Event on the League side to import, so the same rule is re-expressed,
not reinvented, for the Event branch — see `derive-weekly-coaching-context.ts`'s own comment).
Future matches never create reporting debt (they are simply not yet reportable).

## Canonical fact ownership (do not reimplement these)

| Fact | Canonical owner | How the weekly loader uses it |
|---|---|---|
| Available player without a planned league opportunity | `computeRoundPlanIntegrity()` (`src/lib/selection/compute-plan-integrity.ts`), rule `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` | Calls it once for the round matching this week's ISO label; extracts `playerId`s from that rule's signals. Never recomputes availability/eligibility itself. |
| Planned vs. actual deviation (planned-but-absent / unplanned appearance) | Classification meaning of `src/lib/insights/planned-vs-actual-delta.ts` | Reuses the same meaning (`FINALIZED` selection + no `PRESENT` actual = planned-but-absent; `PRESENT` actual + no matching finalized selection = unplanned), computed with **batched** queries (`matchId IN (...)`) instead of that file's per-match loop — a documented, intentional query-shape divergence, not a meaning divergence. See ADR-0108 Decision §2. |
| Support/movement between teams | `MovementLedger` (AGENTS.md: "the movement ledger is the authoritative record of player movement, not the Selection table alone") | Queried directly for `role: "SUPPORT"` entries on the week's matches. Never inferred from a player appearing for a non-core team. |
| Report completeness | `deriveRoundProgress()`'s rule (`src/lib/rounds/round-progress.ts`) | Same complete-iff-`REPORTED`/`LOCKED`, cancelled-excluded rule, applied to League and Event matches alike. |
| ISO week definition | `src/lib/date-utils.ts` | `formatIsoWeekKey`, `getWeekRangeFromIsoWeekKey` used directly. |
| Guest-player exclusion from statistics | ADR-0106's `playerId`-only pattern (`src/lib/stats/player-category-stats.ts`) | Every player-identity statistic filters on non-null `playerId`; a `guestPlayerId`-only row never counts toward a "registered player" statistic. |
| Player/guest display-name resolution | `src/lib/participants/participant-ref.ts` | Not used directly in v1 (all weekly player-identity statistics are Player-only, per AGENTS.md's GuestPlayer exclusion — there is no mixed Player/GuestPlayer identity to resolve here); player display names are resolved via a simple `playerId → { displayName, href }` map built once per call. |

## League and Event: shown together, kept apart

The `activity` section lists League and Event matches for the week side by side — both use the
same `startsAt`-based ISO week bucketing. Every other section is source-tagged and never merges
the two domains' meaning:

- A player's Event appearance satisfies **"had a recorded match appearance"** (the
  `noRecordedAppearance` fact) but never substitutes for **"had a planned league opportunity"**
  (the `opportunity` fact, which is League-only by construction — `computeRoundPlanIntegrity`
  operates on League `MatchRound`s, and Event has no equivalent planned-opportunity concept).
- `planActual` (planned-but-absent / unplanned appearance) is League-only: "planned" is a
  `Selection` concept, and `Selection` rows do not exist for Event matches (Event uses
  `EventSquadPlayer` instead, which has no "planned vs. actual" distinction the same way — an
  Event squad assignment is closer to a roster membership than a per-match plan). Extending this
  to Event is left as documented future work, not silently approximated.
- `reporting.incompleteEventMatchIds` is tracked separately from
  `reporting.incompleteLeagueMatchIds` — never merged into one "reports pending" count without a
  source label.

## `noRecordedAppearance` candidate-pool scoping (a documented judgment call)

The spec that authorised this feature did not specify exactly which players are candidates for
"no recorded match appearance" — checking literally every active player in the organisation would
be misleading noise for any team that simply had no match this week (every one of its players
would trivially show up). The implementation scopes the candidate pool to **players who belong to
a team (League) or were assigned to a squad (Event) that had at least one match this week** —
i.e., players who were actually part of the football that happened, not the organisation's entire
roster. From that pool, anyone with at least one `PRESENT` actual (League or Event) this week is
removed; the remainder is the fact. `GuestPlayer`s are never candidates (per ADR-0106).

This fact is only computed when `status === "COMPLETE"` — for `IN_PROGRESS`/`PROVISIONAL` weeks it
is `null` (omitted), per the feature's own "prefer omission if incomplete reports could materially
change the result" instruction; a materially-incomplete negative claim is worse than no claim.

## Why no new candidate provider (yet)

Every fact this feature exposes that is *already actionable* is already represented by an
existing `DecisionCandidateProvider`:

- Available-without-opportunity → `createPlanIntegrityCandidateProvider()`.
- Missing/incomplete reports → `assistantWorkItemsToCandidates()`'s `post_match_report`/
  `incomplete_report`/`event_report_incomplete` categories.

Adding a weekly-specific candidate for either would duplicate an existing, already-situationally-
ordered signal. The purely descriptive facts (activity counts, planned-vs-actual deviations,
movement) are objective context, not a decision — pushing them through the candidate pipeline
would either produce a meaningless "decision" or require weakening `CoachDecisionCandidate`'s
shape. If a future need identifies a genuinely new actionable fact this feature surfaces that no
existing provider covers, add a provider then — do not add one preemptively.

## Situational presentation

The read model does not change based on situation — only its UI presentation does, branching on
the already-computed `CoachSituationProjection.situation.primarySituation` passed down from
`today/page.tsx`. No new Rego entrypoint, no second policy evaluation, no persisted mode.

- **`MATCHDAY`**: the detailed weekly panel does not render on Today (or renders minimally) —
  it must never outrank `MatchdayContextBanner` or other immediate match work. Any genuinely
  urgent weekly-related problem is still surfaced through the existing candidate providers
  regardless (they are unaffected by this feature).
- **`NEXT`**: renders as a compact **carry-forward** panel from the most recent `COMPLETE` (or, if
  none, `PROVISIONAL`) week, positioned near `NextRoundReadinessSection`. Language is strictly
  factual ("Noah had no recorded appearance last week"), never a directive ("Noah must play this
  week") — the coach remains responsible for the decision.
- **`LONG_TERM`**: renders as a **review/pulse** of the current week if it has meaningful activity,
  otherwise the most recently completed week.

## Today integration

Added to the existing render hierarchy in `assistant-command-centre-page.tsx`, not replacing
anything: `MatchdayContextBanner` → `NextRoundReadinessSection` → **`WeeklyCoachingContextSection`
(new)** → metric tiles → hero → grouped work. No new primary-navigation item.

## Round Board integration

A compact, read-only `WeeklyCarryForwardPanel` renders near the top of the Round Board
(`/rounds/{matchRoundId}`), showing the previous week's carry-forward facts using the same shared
loader. It never adds a mutation control, never decides selections, and never blocks
finalization — the Round Board remains the authoritative planning workspace.

## Historical access

v1 scope is current week + previous week (carry-forward), per the feature's own fallback
allowance when no natural existing history surface exists. `weekKey` is already an explicit
parameter on the loader, so future historical browsing does not require redesigning the read
model — only a UI entry point.

## Deliberately deferred / omitted (not silently approximated)

- **Planned vs. actual for Event matches**: Event has no `Selection`-equivalent per-match plan
  concept (see "League and Event" above) — extending this fact class to Event is future work, not
  approximated with `EventSquadPlayer` membership (which answers a different question — squad
  membership, not per-match planned/actual).
- **Planned vs. actual minutes**: omitted — Matchboard has no explicit planned-minutes target to
  compare actual minutes against; inferring one from squad membership would be exactly the kind
  of "attractive but misleading statistic" the feature's own governing instructions prohibit.
- **Planned vs. actual position exposure**: omitted for the same reason — a starting position
  alone does not establish an intended full-match exposure.
- **Development evidence changes this week**: omitted — evidence records cannot be unambiguously
  connected to "this week" without risking `updatedAt`-based false positives from unrelated edits;
  revisit if/when evidence records gain a reliable match/report linkage timestamp.
- **Historical week browsing UI**: no new page/section added; `weekKey` support exists for future
  work.
- **A new candidate provider**: see "Why no new candidate provider" above.
- **Dedicated E2E coverage**: v1 relies on unit/component/integration test coverage (see
  "Testing" in the implementation report); a dedicated Playwright spec is future work, consistent
  with this repository's current caution around adding new fixture-dependent E2E specs (see
  `docs/development/browser-acceptance-testing.md`'s "Known incident" section).

## Key files

| File | Purpose |
|------|---------|
| `src/lib/weekly/weekly-coaching-context-types.ts` | Pure type contracts: `WeeklyContextStatus`, `WeeklyCoachingContext`, candidate-pool and display types. No React, no Prisma. |
| `src/lib/weekly/get-weekly-coaching-context.ts` | DB-bound loader: batched queries for League/Event matches, reports, actuals, movement, plan integrity; builds the raw fact bag and display maps. |
| `src/lib/weekly/derive-weekly-coaching-context.ts` | Pure derivation: status computation, classification, candidate-pool scoping — takes the loader's raw fact bag, no DB access, fully unit-testable. |
| `src/components/assistant/weekly-coaching-context-section.tsx` | Today UI: situational presentation (pulse/review/carry-forward variants), player name/link rendering with accessible expand/show-all. |
| `src/components/round/weekly-carry-forward-panel.tsx` | Round Board UI: compact, read-only carry-forward panel. |
