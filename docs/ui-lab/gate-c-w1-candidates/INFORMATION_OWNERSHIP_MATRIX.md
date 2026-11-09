# Gate C W1 — Information Ownership Matrix

Per the brief's §4. Today owns priority and context; it must not duplicate a destination
workspace's complete detail, and (P1-03 remediation, independent review of PR #826) it must not
duplicate itself either — every repeated element below now has exactly one real owner, enforced
in `today-surface.tsx`, not asserted as a matter of policy.

| Information element | Canonical source | Owner when a same-day Matchday anchor exists | Owner when it doesn't (quiet) | Owner when it doesn't (decision) | Changes a coach decision? |
|---|---|---|---|---|---|
| The single top decision/situation | `CoachSituationProjection.decisions[0]` | `TodayNextAction` (decision composition only) | — (none exists) | `TodayNextAction` | Yes |
| Why the primary decision is valid | Closed Rego reason-code set / signal's own fields | `TodayDecisionWhy` (decision composition only) | — | `TodayDecisionWhy` | Yes |
| Player-specific/round-level/other secondary decisions | `PlanIntegritySignal` / `AssistantWorkItem` | `TodaySelectionDecisions`/`TodayPlanningAttention`/`TodayOtherAttention` (decision composition only), capped at 2 combined | — | same | Yes, bounded to 2 |
| Same-day match identity, kickoff, readiness, one primary action | `TodayMatchdayContext` | **`TodayMatchday`'s own card** — the one and only place squad readiness renders when a Matchday anchor exists (P1-03: the context rail's squad-readiness widget is explicitly suppressed here, since `TodayMatchday` already shows equivalent readiness via `formatSquadPlannedLine()`/`formatSelectedAvailabilityLine()`) | n/a | n/a | Yes |
| Other same-day football ("Today in order") | `AssistantCommandCentre.todayMatches` | `TodayOperationalTimeline` (P1-02: now renders whenever a Matchday anchor exists, not only on decision days), excluding whichever match Matchday/Live Now already owns | `TodayOperationalTimeline` only if a decision also exists | `TodayOperationalTimeline` | Informational |
| Live match in progress | `TodayLiveNowResult` | `TodayLiveNow` (mutually exclusive with Matchday for the same anchor) | same | same | Yes |
| Calm "nothing needs your attention" hero | n/a (a fact about the absence of other facts) | **Never shown** — P1-01: a Matchday anchor already answers "is there something to do," so the hero would contradict it | `TodayQuietState`'s own hero | n/a (decision composition never shows this hero) | Informational |
| Compact squad readiness (no Matchday anchor) | `TodaySquadStatus` | n/a | `TodayQuietState`'s own inline readiness (P1-03: suppressed from the context rail) | **`TodayContextRail`** — the sole owner on a decision day with no Matchday anchor | No |
| Bounded "This week" chronology (quiet day only) | Upcoming `MatchPresentation[]` + due reviews | `TodayQuietState`'s chronology, still shown (not a duplicate of "Today in order," which is same-day only) | same | n/a | Informational only |
| Carry-forward item(s) | `TodayCarryForwardItem[]` | n/a (orthogonal to Matchday) | `TodayQuietState`'s own at-most-one inline item (P1-03: suppressed from the context rail whenever quiet) | **`TodayContextRail`** — the sole owner on a decision day, which never shows carry-forward inline | No |
| Recent football / since-last-visit | `MatchPresentation[]` / `TodayVisitCurrentFacts` | `TodayContextRail` — always the sole owner; neither the quiet nor the decision composition shows these at all | same | same | No |
| Due peer/development reviews | `DueDecisionReviewCard[]` | `DueDecisionReviewSection` (decision composition only — forces DECISION when present) | n/a | same | Yes |

## What Today does **not** own (per the brief's §4), and this wave does not duplicate

- **Match Details**, **Round Board**, **Player Detail**, **Post-Match Report** — unchanged from
  the original wave's own statement; this remediation touches only Today's own internal
  composition, never another workspace's ownership.

## Why the first pass's claim of "intentional" duplication was wrong

The original version of this document asserted the context rail's repetition of squad readiness
and carry-forward was deliberate (citing `today-quiet-state.tsx`'s own doc comment). The
independent review correctly rejected that as insufficient justification: a component's own doc
comment describing its *current* behavior is not evidence that the behavior is *correct*. The
table above is the corrected, single-owner model, enforced in code and regression-tested
(`today-surface.matchday-quiet-composition.test.tsx`), not merely documented as a rule to trust.
