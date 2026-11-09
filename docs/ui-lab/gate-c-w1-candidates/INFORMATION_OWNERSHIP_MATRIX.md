# Gate C W1 — Information Ownership Matrix

Per the brief's §4. Today owns priority and context; it must not duplicate a destination
workspace's complete detail.

| Information element | Canonical source | Today component | Region | Duplicated elsewhere? | Changes a coach decision? |
|---|---|---|---|---|---|
| The single top decision/situation | `CoachSituationProjection.decisions[0]` (situation policy, Rego) | `TodayNextAction` | Primary | No — excluded from every secondary section once promoted | Yes — this is the decision |
| Why the primary decision is valid | Closed Rego reason-code set, or the signal's own `classificationReason` | `TodayDecisionWhy` | Primary (inline) | No | Yes — justifies the action |
| Player-specific selection problems (not primary) | `PlanIntegritySignal` via the selection recommendation planner | `TodaySelectionDecisions` | Secondary (capped) | No — signal key excluded from Planning attention and from the primary if promoted | Yes, bounded to 2 total |
| Round-level plan-integrity signals (not primary, not selection) | `AssistantCommandCentre.roundPlanIntegrities` | `TodayPlanningAttention` | Secondary (capped) | No | Yes, bounded to 2 total |
| Other concrete work items (setup, event prep, review, report) | `AssistantCommandCentre.items` (allowlisted categories only) | `TodayOtherAttention` | Secondary (capped) | No | Yes, bounded to 2 total |
| Same-day match identity, kickoff, readiness, one primary action | `TodayMatchdayContext` (League `TodayMatch` or Event facts, unified) | `TodayMatchday` | Primary anchor (pre-live) | No — Matchday's consumed signal is excluded from the secondary sections and from the lower chronology | Yes — the one correct next action for that match |
| Live match in progress | `TodayLiveNowResult` | `TodayLiveNow` | Primary anchor (live) | No — mutually exclusive with Matchday for the same anchor | Yes |
| Bounded "This week" chronology (quiet day only) | Upcoming `MatchPresentation[]` + due reviews | `TodayQuietState`'s chronology | Primary (quiet only) | No | Informational only |
| Today's own operational timeline (decision day only) | `AssistantCommandCentre.todayMatches` | `TodayOperationalTimeline` | Primary (decision only) | No — excludes whichever match Live Now/Matchday already shows | Informational only |
| Squad readiness snapshot | `TodaySquadStatus` | `TodayQuietState` (conditional) / `TodayContextRail` | Context rail, or inline on quiet day only when no Matchday object already shows its own | Possible inline-vs-rail overlap is deliberate and documented in `today-surface.tsx`'s own `showSquadReadiness` guard, not accidental duplication | No |
| Recent football / carry-forward items | `TodayCarryForwardItem[]` / recent `MatchPresentation[]` | `TodayContextRail`, and at most one item inline on quiet day | Context rail (always) + at most one inline on quiet day | Deliberate — documented in `today-quiet-state.tsx`'s own doc comment | No |
| Due peer/development reviews | `DueDecisionReviewCard[]` | `DueDecisionReviewSection` (decision day only) | Primary (decision day), trailing | No | Yes — forces DECISION composition when present |

## What Today does **not** own (per the brief's §4), and this wave does not duplicate

- **Match Details** — detailed match preparation, recorded events, historical match information.
  Matchday's action always deep-links to the match/event's own canonical detail page; no second
  lineup/availability/live-start route is introduced by this wave.
- **Round Board** — multi-match allocation and squad movement decisions. Today's Selection
  decisions/Planning attention rows link into Round Board for the full workspace; they never
  reproduce its allocation UI.
- **Player Detail** — player development and evidence history. Not surfaced by C01-C03 at all.
- **Post-Match Report** — report reconciliation and mutation. Not surfaced by C01-C03's scope
  (PREPARE/VERIFY/IMMINENT is pre-live only).
