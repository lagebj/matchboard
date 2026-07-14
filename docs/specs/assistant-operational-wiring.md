# Spec: Assistant Operational Wiring

## Objective

Wire the assistant page to surface concrete actions for event and league match completion workflows. The assistant must detect missing work for events, lineups, helpers, and post-match reports, and link directly to the correct working screen.

## What already exists

- `getAssistantCommandCentre()` — returns `AssistantCommandCentre` with work items
- Current work item categories: `setup_missing`, `populate_needed`, `blocked_round`, `decision_required`, `ready_to_finalize`, `post_match_report`, `upcoming_round`
- These cover **league match** workflows only
- No event-related work items exist

## What needs to be added

### 1. Event-related assistant work items

Add new categories to the assistant work item types:

```typescript
type EventWorkCategory =
  | 'event_setup_missing'        // event has no matches
  | 'event_matches_missing'     // event has no matches set up
  | 'event_squads_missing'      // event has matches but no squads
  | 'event_lineup_missing'      // event match has no planned lineup
  | 'event_lineup_incomplete'   // event match lineup has gaps
  | 'event_helpers_missing'    // event match needs helpers
  | 'event_report_needed'      // event match has passed but no report
  | 'event_report_incomplete'; // event match has draft report not finalized
```

### 2. `hasMatchPassed` utility

`src/lib/match-date-utils.ts`

```typescript
function hasMatchPassed(match: { startsAt: Date | null; matchDurationMinutes: number | null }, now?: Date): boolean
```

Rules:
- If match has date and time: report available after date+time+duration has passed
- If match has date but no time: report available after that calendar date has passed
- If match has no date: never available for report
- For event matches: use `EventMatch.startsAt` and `Event.matchDurationMinutes`
- For league matches: use `Match.date` and `MatchRound` context
- Server-side date comparison, not client clock

### 3. Extend `getAssistantCommandCentre()`

Add event-related items to the assistant query:

```typescript
async function getEventWorkItems(userId: string): Promise<AssistantWorkItem[]>
```

For each event in the active period:
1. Event has no matches → `event_setup_missing` with "Setup matches" action linking to event detail
2. Event has matches but no squads → `event_squads_missing` with "Setup squads" action
3. Event match has no lineup → `event_lineup_missing` with "Plan lineup" action
4. Event match has lineup but incomplete → `event_lineup_incomplete`
5. Event match needs helpers → `event_helpers_missing` (based on squad size vs available pool)
6. Event match has passed and no report → `event_report_needed` with "Create post-match report" action
7. Event match has draft report → `event_report_incomplete` with "Continue report" action

### 4. Date-aware post-match report rule

Both league and event matches:
- **Never** suggest post-match report if:
  - Match has no date
  - Match date has not passed
  - Match has date+time and kickoff has not passed
  - Match is cancelled
- **Always** suggest if match date has passed (using `hasMatchPassed`)

Update the existing `post_match_report` category to use `hasMatchPassed`.

### 5. Action links

Each work item must have an `action` with:
- `label`: e.g. "Setup matches", "Plan lineup", "Create report"
- `href`: direct link to the relevant screen

Event actions link to:
- `/events/[eventId]` — event detail/overview
- `/events/[eventId]` with tab query param — specific tab
- `/matches/[matchId]` — match detail for reports
- `/rounds/[matchRoundId]` — round board for lineups

### 6. Assistant card style

Cards must be direct and operational:

Good:
```
Blå Cup is missing match setup
[Setup matches] → /events/abc123
```

Bad:
```
Maybe you should consider completing event configuration
```

### 7. Priority ordering

Event items are interleaved with league items by urgency:
1. `setup_missing` (no teams/players) — highest
2. `event_setup_missing` (event with no matches)
3. `blocked_round` (league round blocked)
4. `event_squads_missing`
5. `event_lineup_missing`
6. `populate_needed` (league round not generated)
7. `decision_required` (league round needs decision)
8. `ready_to_finalize` (league round ready)
9. `event_helpers_missing`
10. `event_report_needed` (passed event match, no report)
11. `post_match_report` (league match, no report)
12. `event_report_incomplete`
13. `upcoming_round` (future league round)

### 8. Duplicate/noise prevention

- Do not show `event_report_needed` for future or undated matches
- Do not show `event_lineup_missing` for cancelled matches
- Do not show `event_helpers_missing` if helpers are not applicable (e.g., single-squad event)
- Do not show both `event_lineup_missing` and `event_lineup_incomplete` for the same match — show the more specific one
- Group items by event where possible

## Commands

- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`

## Testing Strategy

- Unit tests for `hasMatchPassed` with various date/time scenarios
- Unit tests for event work item detection (no matches, no squads, no lineup, etc.)
- Unit tests: future match does not produce post-match report item
- Unit tests: undated match does not produce post-match report item
- Unit tests: cancelled event match does not produce lineup/report items
- Unit tests: event with squads but no lineup produces `event_lineup_missing`
- Unit tests: event with draft report produces `event_report_incomplete`

## Boundaries

- Always: Use `requireCoachAccess()` on all assistant data queries
- Always: Use server-side date comparison, never client clock
- Always: Link to actual app routes, not placeholder URLs
- Never: Show all actions at once — show based on missing state only
- Never: Suggest post-match reports before match date has passed
- Never: Add chatbot or AI features — this is operational only

## Success Criteria

- Assistant surfaces missing event setup work
- Assistant can link directly to event setup screens
- Assistant surfaces event matches missing lineups
- Assistant surfaces event matches needing post-match reports only after match date
- Assistant surfaces league matches needing post-match reports only after match date
- Assistant does not request reports for future or undated matches
- Assistant links to existing reports/drafts
- Assistant avoids duplicate/noisy actions
- Action cards are direct and operational, not chatty
- Typecheck, lint, tests, and build pass