# Gate C W1 — Information Ownership Matrix

Per the brief's §4. Today owns priority and context; it must not duplicate a destination
workspace's complete detail, and it must not duplicate itself either. **A second independent
review found that an earlier correction pass (P1-03) over-corrected into real information loss
(P1-04, P1-05) — see "Two defects a prior fix introduced" below.** The table below is the
corrected model: every repeated-looking element is classified as either a genuine duplicate (one
real owner, shown once) or related-but-distinct information with its own, separate scope (both
shown, distinguishable).

## Same data vs. related-but-different-scope data

| Element | Classification | Why |
|---|---|---|
| Quiet-day "Nothing needs your attention" hero vs. Matchday's own action | Same claim, different scopes would contradict — **genuine duplicate/contradiction** | Both answer "is there something to do today," and the hero's unconditional wording can't be true at the same time as a real Matchday action. One owner: Matchday wins (P1-01). |
| Context rail's organisation-wide squad availability vs. Matchday's own match-specific readiness | **Related, not duplicate** | One answers "how many active players does the org have right now" (`getOrgActivePlayerAvailability()`); the other answers "are the players selected for THIS match ready" (`TodayMatchdayContext.readiness`). Both can be true and useful at once (P1-04). |
| Quiet-day hero's featured carry-forward item vs. the context rail's remaining items | **Related, not duplicate** | The featured item and the rest of the collection are different items, not the same fact twice. One is spotlighted; the rest remain reachable, not discarded (P1-05). |
| "Today in order" vs. Matchday's own card, for the SAME match | Same match shown twice would be a **genuine duplicate** | The featured match is excluded from the lower chronology by identity (`timelineExcludedMatchId`), so it never repeats (P1-02). |

## Ownership table

| Information element | Canonical source | Owner when a same-day Matchday anchor exists | Owner when it doesn't (quiet) | Owner when it doesn't (decision) | Changes a coach decision? |
|---|---|---|---|---|---|
| The single top decision/situation | `CoachSituationProjection.decisions[0]` | `TodayNextAction` (decision composition only) | — (none exists) | `TodayNextAction` | Yes |
| Why the primary decision is valid | Closed Rego reason-code set / signal's own fields | `TodayDecisionWhy` (decision composition only) | — | `TodayDecisionWhy` | Yes |
| Player-specific/round-level/other secondary decisions | `PlanIntegritySignal` / `AssistantWorkItem` | `TodaySelectionDecisions`/`TodayPlanningAttention`/`TodayOtherAttention` (decision composition only), capped at 2 combined | — | same | Yes, bounded to 2 |
| Same-day match identity, kickoff, **match-specific** readiness, one primary action | `TodayMatchdayContext` | **`TodayMatchday`'s own card** — the only place match-specific (selected-squad) readiness renders | n/a | n/a | Yes |
| **Organisation-wide** active-player availability | `TodaySquadStatus` (`getOrgActivePlayerAvailability()`) | **Context rail**, with a scope label ("All active players") since Matchday's own card is also on the page (P1-04) | `TodayQuietState`'s own inline widget (no label needed — nothing else on the page could be confused with it) | **Context rail** (no label needed — same reason) | No |
| Other same-day football ("Today in order") | `AssistantCommandCentre.todayMatches` | `TodayOperationalTimeline` (P1-02: renders whenever a Matchday anchor exists, not only on decision days), excluding whichever match Matchday/Live Now already owns | `TodayOperationalTimeline` only if a decision also exists | `TodayOperationalTimeline` | Informational |
| Live match in progress | `TodayLiveNowResult` | `TodayLiveNow` (mutually exclusive with Matchday for the same anchor) | same | same | Yes |
| Calm "nothing needs your attention" hero | n/a (a fact about the absence of other facts) | **Never shown** — P1-01: a Matchday anchor already answers "is there something to do" | `TodayQuietState`'s own hero | n/a (decision composition never shows this hero) | Informational |
| Bounded "This week" chronology (quiet day only) | Upcoming `MatchPresentation[]` + due reviews | `TodayQuietState`'s chronology, still shown | same | n/a | Informational only |
| Carry-forward — **the first item** | `TodayCarryForwardItem[]` | `TodayQuietState`'s own featured inline item (unchanged — `.slice(0, 1)`) | same | n/a (decision composition never features one inline) | No |
| Carry-forward — **the remaining items (2nd, 3rd)** | `TodayCarryForwardItem[]` | **Context rail** (P1-05: `.slice(1)` of the same collection, whenever quiet) | same | **Context rail owns the full collection** (decision composition never features an item inline, so nothing is sliced away from it) | No |
| Recent football / since-last-visit | `MatchPresentation[]` / `TodayVisitCurrentFacts` | `TodayContextRail` — always the sole owner; neither composition shows these at all | same | same | No |
| Due peer/development reviews | `DueDecisionReviewCard[]` | `DueDecisionReviewSection` (decision composition only — forces DECISION when present) | n/a | same | Yes |

## Two defects a prior fix introduced (P1-04, P1-05) — and why the first fix was wrong

The P1-03 correction's own derived condition was:

```ts
const squadStatusShownElsewhere = Boolean(matchdayContext) || compositionState === "QUIET";
const carryForwardShownElsewhere = compositionState === "QUIET";
```

This conflated two different questions. For squad status: "does a Matchday anchor exist" is not
the same question as "is this exact organisation-wide fact already shown elsewhere" — Matchday's
own card never shows the org-wide fact at all, so suppressing the rail's copy whenever Matchday
existed just deleted the only place that fact could appear. For carry-forward: "is the day quiet"
is not the same question as "has this exact item already been featured" — only the FIRST item is
featured inline; blanking the rail's whole collection discarded the 2nd/3rd items outright.

The corrected conditions (`today-surface.tsx`):

```ts
const showSquadReadiness = !matchdayContext;
const squadStatusShownInline = compositionState === "QUIET" && showSquadReadiness;
const contextRailSquadStatus = squadStatusShownInline ? null : squadStatus ?? null;
const contextRailCarryForwardItems = compositionState === "QUIET" ? carryForwardItems.slice(1) : carryForwardItems;
```

Each suppresses the rail's copy only when it is the IDENTICAL fact already shown identically
elsewhere — never a broader "does X exist" proxy for that question.

## What Today does **not** own (per the brief's §4), and this wave does not duplicate

**Match Details**, **Round Board**, **Player Detail**, **Post-Match Report** — unchanged; this
remediation touches only Today's own internal composition, never another workspace's ownership.
