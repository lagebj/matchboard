# Spec: Assistant Live Command Centre

## Objective

Rebuild the `/assistant` page as a live coaching command centre that derives all work items from current database state — not from persisted `AssistantIssue` rows. The assistant must answer one question: **"What must I do next?"**

The current implementation reads stale `AssistantIssue` rows created by `generate-round-issues.ts` (which maps from the old `Warning` model). These rows accumulate, go stale, and don't reflect current plan integrity. The rebuild replaces this with live computation from canonical sources.

**User:** A youth football coach managing match-round squad planning.
**Success looks like:** Coach opens `/assistant`, sees exact next action, no stale items, no noise from planning notes or scoring preferences.

## Commands

```
Build: npm run build
Test: npm test
Lint: npm run lint
Typecheck: npm run typecheck
Dev: npm run dev
```

## Project Structure

```
src/lib/assistant/              → New live assistant service layer
  get-assistant-command-centre.ts   → Main query: aggregates all work from live state
  types.ts                           → AssistantWorkItem, AssistantCommandCentre types
src/app/(app)/assistant/        → Server component page
  page.tsx                           → Loads command centre data, renders client
src/components/assistant/       → Client components
  assistant-command-centre-page.tsx  → Main client page
  assistant-work-item-card.tsx       → Single work item card
  assistant-empty-state.tsx          → No work state
src/domain/assistant-manager/   → Existing domain (service, actions, types) — phased retirement
src/lib/selection/              → Selection engine (unchanged)
  compute-plan-integrity.ts          → Canonical RoundPlanIntegrity (unchanged)
  reconcile-assistant-work.ts        → Retired from live path (kept for backward compat)
  generate-round-issues.ts          → Retired from live path (kept for backward compat)
docs/specs/                     → This spec
  assistant-live-command-centre.md
```

## Work Item Model

The assistant shows work items, not issues. Each work item represents one actionable task the coach must address.

### AssistantWorkItem

```typescript
type AssistantWorkCategory =
  | "setup_missing"         // No teams/players/matches exist
  | "availability_missing"  // Rounds exist but no availability marked
  | "populate_needed"       // Ungenerated rounds exist
  | "blocked_round"         // Draft round with Blocked conditions
  | "decision_required"     // Draft round with Decision required conditions
  | "ready_to_finalize"     // Draft round with no blockers, no decision-required
  | "post_match_report"     // Finalized match missing post-match report
  | "upcoming_round"        // Future round info only (lowest priority, no action needed)

type AssistantWorkItem = {
  id: string                          // Deterministic: `${category}|${roundId}` or `${category}|${matchId}`
  category: AssistantWorkCategory
  priority: number                     // Sort order: lower = more urgent
  title: string                        // e.g. "Round 2 — 1 blocked condition"
  summary: string                       // e.g. "Team A is below minimum squad size"
  matchRoundId: string
  matchId?: string                      // For per-match items (post-match report)
  blockedCount?: number                // For blocked_round / decision_required
  decisionRequiredCount?: number       // For blocked_round / decision_required
  affectedTeamIds: string[]
  affectedPlayerIds: string[]
  primaryActionLabel: string
  primaryActionHref: string
}

type AssistantCommandCentre = {
  planningPeriodId: string | null
  planningPeriodName: string | null
  items: AssistantWorkItem[]
  computedAt: Date
}
```

### Priority ordering

| Priority | Category | Rationale |
|----------|----------|-----------|
| 0 | setup_missing | Nothing works without setup |
| 1 | availability_missing | Can't generate without availability |
| 2 | populate_needed | Must generate before review |
| 3 | blocked_round | Blocked rounds need resolution first |
| 4 | decision_required | Decisions needed before finalization |
| 5 | ready_to_finalize | Clear to lock — lowest-urgency action |
| 6 | post_match_report | Historical recording, not blocking |
| 7 | upcoming_round | Informational only |

Within same priority, sort by round date (earliest first).

### Aggregation rules

- **One item per round per category.** If a round has both blocked conditions AND decision-required conditions, it produces TWO items (one per category). If it has multiple blocked conditions, it produces ONE `blocked_round` item with `blockedCount` and combined summary.
- **Post-match report: one item per finalized match** missing a report.
- **Setup/availability/populate: one item per planning period** (not per round).
- **Upcoming round: one item per NOT_GENERATED round without immediate action** (informational).

## Service: getAssistantCommandCentre

```typescript
async function getAssistantCommandCentre(): Promise<AssistantCommandCentre>
```

This single function replaces the entire `fetchAssistantIssues` → `groupIssues` pipeline.

### Data sources (all live, no AssistantIssue table)

1. **Planning period** → `db.planningPeriod.findFirst` (latest active)
2. **Teams count** → `db.team.count`
3. **Players count** → `db.player.count({ where: { removedAt: null } })`
4. **Matches** → by planning period
5. **Rounds** → by planning period, with status
6. **Plan integrity** → `computeRoundPlanIntegrity` per DRAFT/BLOCKED round
7. **Post-match reports** → `db.postMatchReport` for finalized matches

### Algorithm (pseudocode)

```
1. Load latest planning period. No period → return setup_missing.
2. Count teams, players. Zero → setup_missing.
3. Count matches. Zero → setup_missing.
4. For each round in the planning period (chronological):
   a. NOT_GENERATED → populate_needed (if first ungenerated) or upcoming_round
   b. DRAFT or BLOCKED → computeRoundPlanIntegrity(roundId):
      - blockedCount > 0 → blocked_round item
      - decisionRequiredCount > 0 → decision_required item
      - Both zero → ready_to_finalize item
   c. READY → ready_to_finalize item
   d. FINALIZED → check post-match reports for each match:
      - No report exists → post_match_report item per match
5. Return sorted by priority, then round date.
```

### Key constraints

- **Planning notes never appear as work items.** They are not Blocked, not Decision required, not actionable from the assistant. They belong on the Round Board behind a toggle.
- **Selection explanations/scoring preferences never appear as work items.** They are info-only.
- **Opponent observations never appear as work items.** They are informational.
- **Season stats never appear as work items.** Fairness warnings belong on `/season`.
- **`computeRoundPlanIntegrity` is the canonical source.** The service calls it; it does not reconstruct plan integrity rules.

## UI

### Page layout

```
┌──────────────────────────────────────────────┐
│  Assistant                                    │
│  What needs attention before the next matches. │
│                                              │
│  [Planning period badge if set]               │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │ [Priority 0-2 items]                    ││
│  │   Setup / Availability / Populate        ││
│  │   → Primary action button (CTA)          ││
│  ├──────────────────────────────────────────┤│
│  │ [Priority 3-5 items]                    ││
│  │   Blocked / Decision required / Ready    ││
│  │   → One card per round-category           ││
│  ├──────────────────────────────────────────┤│
│  │ [Priority 6-7 items]                    ││
│  │   Post-match reports / Upcoming           ││
│  └──────────────────────────────────────────┘│
│                                              │
│  (Empty state: "No coaching decisions         │
│   require action right now."                  │
│   → View Fixtures link)                       │
└──────────────────────────────────────────────┘
```

### Work item card

Each card shows:
- Category icon/badge (color-coded: red for blocked, amber for decision-required, green for ready, blue for upcoming)
- Title (round name + condition summary)
- Summary (1-2 lines)
- Primary action button → navigates to the correct destination

### Categories removed from the live Assistant

These existed in the old `AssistantIssue` model and must NOT appear in the new live command centre:
- `TEAM_NEEDS_SUPPORT` — this is a planning note or selection explanation, not an active work item
- `PLAYER_LOW_MATCH_EXPOSURE` — seasonal context, not assistant work
- `PLAYER_HIGH_MATCH_LOAD` — seasonal context, not assistant work
- `POSITION_GAP` — selection explanation, not assistant work
- `UNKNOWN_RSVP_INCLUDED` — planning note, not assistant work
- `SUPPORT_MOVE_WEAKENS_SOURCE_TEAM` — selection explanation, not assistant work
- `PLAYER_BLOCKED_FLOATING_GAP` — selection explanation, not assistant work
- `ROUND_READY_FOR_REVIEW` — replaced by `ready_to_finalize`
- `BLOCKED_CONDITION_PREVENTS_FINALIZE` — replaced by `blocked_round` (per-round, not generic)

### CoachingIntentSelector removal

The `CoachingIntentSelector` is currently rendered permanently at the top of `/assistant`. This is wrong — coaching intent belongs on the Fixtures page and Round Board where the coach is actually planning. Removing it from assistant eliminates noise and keeps the assistant focused on "what next".

Intent can still be accessed from:
- Fixtures page (per-planning-period intent)
- Round Board (per-round intent)
- Match detail (per-match intent)

## Testing Strategy

### Unit tests: `src/lib/assistant/__tests__/get-assistant-command-centre.test.ts`

Test against real DB (existing pattern). Scenarios:
1. No planning period → `setup_missing`
2. No teams → `setup_missing`
3. No players → `setup_missing`
4. No matches → `setup_missing`
5. Ungenerated rounds with availability → `populate_needed`
6. Draft round with blocked signals → `blocked_round` item with correct `blockedCount`
7. Draft round with decision-required signals → `decision_required` item with correct `decisionRequiredCount`
8. Draft round with both blocked and decision-required → TWO items
9. Draft round with no signals → `ready_to_finalize`
10. READY round → `ready_to_finalize`
11. FINALIZED round with missing post-match report → `post_match_report` per match
12. FINALIZED round with complete reports → no items
13. Multiple rounds → correct priority ordering
14. Planning notes do NOT produce work items
15. Scoring preferences do NOT produce work items
16. Recalculation clears stale items (new computation replaces old)

### Component tests: existing pattern

Test `assistant-work-item-card` renders correct category badge, title, summary, action link.

## Boundaries

- **Always:** Run lint, typecheck, tests, build before commits. Use `requireCoachAccess()` on server actions. Use player IDs in stored payloads.
- **Ask first:** Schema changes, new dependencies, changes to `computeRoundPlanIntegrity` API
- **Never:** Add planning notes as work items. Add scoring preferences as work items. Read from `AssistantIssue` table for live state. Show `CoachingIntentSelector` on assistant page. Use "Dashboard" asAssistant title. Store player names in work items.

## Success Criteria

1. `/assistant` shows exactly the next action based on current DB state
2. No stale items: resolving a blocked condition removes it from assistant immediately on next load
3. Planning notes never appear as work items
4. One item per round per category (no per-player or per-team multiplication)
5. Post-match report items appear per finalized match missing a report
6. `CoachingIntentSelector` removed from `/assistant`
7. Page title is "Assistant" (never "Dashboard")
8. All existing tests pass + new assistant tests pass
9. Lint, typecheck, build clean

## Open Questions

1. Should we add a "Regenerate all drafts" action to the `populate_needed` card, or just link to Fixtures?
   → **Recommendation:** Link to Fixtures. The Fixtures page owns the populate action.
2. Should `upcoming_round` items be shown at all, or hidden to reduce noise?
   → **Recommendation:** Hide initially. Only show if no other work exists (empty-state context).
3. Should we clean up old `AssistantIssue` rows in this change or defer?
   → **Recommendation:** Defer. Create a cleanup script as a separate task. Mark `generate-round-issues.ts` and `reconcile-assistant-work.ts` as retired in code comments.