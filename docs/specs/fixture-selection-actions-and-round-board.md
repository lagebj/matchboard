# Spec: Fixture Selection Actions and Round Board Improvements

## Objective

Add selection action capabilities at every planning level (period, round, match) on the Fixtures page, and enhance the existing Round Board to be a human-friendly squad planning workspace with persisted drag-and-drop manual overrides.

### Problems solved

1. **Fixtures page lacks selection actions** — Coaches cannot create, recreate, clear, or finalize selections from the Fixtures page at period, round, or match scope.
2. **Round review warnings dominate the view** — The round detail page shows warnings prominently but lacks a practical board-first workflow for coaches to act on them.
3. **Manual overrides need better audit trail** — Drag-and-drop movements must persist override data (category, detail, rules bypassed) and be clearly visible in the UI.

### User stories

- As a coach, I can open Fixtures and see per-period, per-round, and per-match selection state (not generated, draft, blocked, ready, finalized) with available actions.
- As a coach, I can create draft selections for an entire planning period, a single round, or a single match from the Fixtures page.
- As a coach, I can recreate (regenerate) draft selections at any scope, with clear behavior about manual override preservation.
- As a coach, I can clear draft selections at any scope with confirmation.
- As a coach, I can finalize round selections or individual match selections from Fixtures.
- As a coach, the Round Board is the primary working surface for reviewing and adjusting squads, with warnings as supporting signals.
- As a coach, drag-and-drop player movements are persisted immediately and visible as manual overrides.

## Tech Stack

- Next.js 16 App Router (Turbopack), TypeScript, Tailwind, Prisma, PostgreSQL
- Drag-and-drop: existing native HTML5 drag API in round-board.tsx (no library dependency)
- Server actions: existing pattern in `actions.ts` files
- Selection engine: existing `src/lib/selection/*`

## Commands

- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Dev: `npm run dev`

## Project Structure

```
src/
  app/(app)/
    fixtures/page.tsx              → Fixtures route (server component)
    rounds/[matchRoundId]/
      page.tsx                     → Round board (server component, data loading)
      actions.ts                   → Round-level server actions
      draft-selection-actions.ts   → Draft edit server actions
  components/
    fixtures/
      fixtures-page.tsx            → Fixtures page client component
    round/
      round-board.tsx              → Round board client component
      confirm-finalize-dialog.tsx  → Finalize confirmation dialog
      round-status-strip.tsx        → Status summary strip
      fairness-summary.tsx         → Fairness metrics display
  domain/
    fixtures/
      types.ts                     → Fixtures type definitions
      service.ts                   → Fixtures data fetching
      actions.ts                   → Fixtures server actions (thin wrapper)
  lib/
    selection/
      manual-draft-edit.ts         → Manual add/remove/change role (existing)
      clear-draft-selection.ts     → Clear at all/match/round scope (existing)
      finalize-match-round.ts      → Finalize round (existing)
      finalize-single-match.ts     → Finalize single match (existing)
      refresh-draft-selection.ts   → Regenerate drafts (existing)
      generate-round.ts           → Generate round (existing)
      populate-all-drafts.ts      → Populate all (existing)
```

## Selection Lifecycle

### States

| State | Meaning | Available actions |
|-------|---------|-------------------|
| NOT_GENERATED | No selections exist | Create draft |
| DRAFT | Draft exists, not finalized | Recreate draft, Clear draft, Finalize |
| BLOCKED | Draft with hard-block warnings | Recreate draft, Clear draft, Finalize (with override) |
| READY | Draft with no blockers | Recreate draft, Clear draft, Finalize |
| FINALIZED | Locked history | Un-finalize |

### Scopes

| Scope | Create draft | Recreate draft | Clear draft | Finalize |
|-------|-------------|---------------|-------------|----------|
| Period (populate all) | ✓ | ✓ (regenerate all) | ✓ (clear all) | ✗ (finalize per round) |
| Round | ✓ | ✓ | ✓ | ✓ |
| Match | ✓ | ✓ | ✓ | ✓ |

### Action semantics

**Create draft** — Generate selections where no draft exists. At period scope, call `populateAllDrafts`. At round scope, call `generateMatchRound`. At match scope, call `generateSelection` + persist.

**Recreate draft** — Regenerate draft, replacing the existing draft. Must document behavior regarding manual overrides:
- Default: preserve manual overrides (selections with `manuallyAdded` or `manuallyRemoved` in explanation)
- If user wants full regeneration: they must clear first, then create
- UI shows: "Regenerating will preserve manual edits. Clear all manual edits first to fully regenerate."

**Clear draft** — Remove draft selections and warnings for the scope. Never deletes finalized data. Requires confirmation dialog.

**Finalize** — Lock selections. At round scope, uses `finalizeMatchRound`. At match scope, uses `finalizeSingleMatch`. Requires override reason if blockers exist.

## Fixtures Page Actions Design

### UI pattern

Each level (period, round, match) shows:
1. **Status badge** — current selection state (NOT_GENERATED, DRAFT, BLOCKED, READY, FINALIZED)
2. **Action buttons** — contextually available based on state

Period-level actions (top bar):
- "Populate all" (when any round is NOT_GENERATED)
- "Regenerate all" (when any round is DRAFT/BLOCKED/READY)
- "Clear all drafts" (when any draft exists)

Round-level actions (per round card):
- "Generate squads" (when NOT_GENERATED)
- "Regenerate" (when DRAFT/BLOCKED/READY)
- "Clear" (when DRAFT/BLOCKED/READY)
- "Finalize round" (when DRAFT/BLOCKED/READY)
- "Un-finalize" (when FINALIZED)

Match-level actions (per match row):
- "Generate" (when NOT_GENERATED, within an ungenerated round)
- "Regenerate" (when DRAFT, within a draft round)
- "Clear" (when DRAFT, within a draft round)
- "Finalize" (when DRAFT/BLOCKED/READY, within a draft round)
- No actions at match level within a finalized round (use round-level un-finalize first)

### Data flow

The fixtures page fetches data via `getFixturesOverview()` from `src/domain/fixtures/service.ts`. We need to extend the types and service to include:
- Per-round `derivedStatus` (using `deriveRoundStatus`)
- Per-match `selectionState` (NOT_GENERATED / DRAFT / FINALIZED)
- Per-match `hasDraftSelections` boolean
- Action availability computed from state

The service already queries warnings and draft selection counts. We add `derivedRoundStatus` inference and expose action availability.

### New actions needed

Most actions already exist at round level. New additions:

1. **`fixturesActions.ts`** — new server actions file for fixture-level actions:
   - `populateAllAction` — already exists in `rounds/actions.ts`, needs fixture-level exposure
   - `regenerateAllDraftsAction` — already exists
   - `clearAllDraftsAction` — already exists as `clearAllDraftsAction`
   - `generateRoundAction` — already exists
   - `regenerateRoundAction` — new (wraps `refreshDraftRound` for fixture page use)
   - `clearRoundDraftAction` — new (wraps `clearRoundDraftSelection` for fixture page use)
   - `finalizeRoundAction` — new (wraps `finalizeMatchRound` for fixture page use)
   - `generateMatchAction` — new (generate + persist for single match)
   - `regenerateMatchAction` — new (wraps `refreshDraftSelection` for single match)
   - `clearMatchDraftAction` — new (wraps `clearMatchDraftSelection` for fixture page use)
   - `finalizeMatchAction` — new (wraps `finalizeSingleMatch` for fixture page use)

Rather than creating duplicate actions, the fixture page should import and call the same actions used on the rounds page. Some actions exist in `rounds/actions.ts` and `rounds/[matchRoundId]/actions.ts`. The fixture page needs its own thin wrappers that follow the same pattern (requireCoachAccess, FormData, revalidatePath).

## Round Board Improvements

### Current state

The round board already has:
- Column layout per match + Available column
- Drag-and-drop (desktop + touch)
- Role grouping within columns (CORE, SUPPORT, BACKFILL, DEVELOPMENT)
- Player chips with override badges
- Finalize/un-finalize per match and round
- Regenerate/clear round actions
- Warning summary with actionable/informational toggle

### Improvements needed

1. **Warning visibility reduction** — Move from "wall of warnings" to compact badges + expandable details. Already partially done. Ensure informational warnings default to hidden.
2. **Better action discoverability** — Ensure round-level actions (Generate, Regenerate, Clear, Finalize) are clearly visible in the round board header, matching the Fixtures page pattern.
3. **Match-level actions** — Add Generate/Regenerate/Clear/Finalize buttons per match column header in the round board (visible when match is in appropriate state).
4. **Manual override visibility** — Already partially implemented (override badge on player chip). Ensure every manual override shows:
   - Visual badge on the player chip ("ovr" label, already exists)
   - Override reason visible in a detail panel or tooltip
   - Category badge (squad_too_small, coach_judgement, etc.)
5. **Confirmation dialogs** — All destructive actions (clear, finalize with blockers) already have confirmation dialogs. Ensure match-level clear and finalize also use dialogs.
6. **Error feedback** — Show clear, actionable error messages from backend responses. Currently errors are shown in URL params; consider inline toast/banner feedback.

### No structural rewrite needed

The existing round board (`src/components/round/round-board.tsx`, ~969 lines) is already a functional drag-and-drop board. The improvements are incremental:
- Add match-level action buttons in column headers
- Verify/enhance override reason display
- Ensure error handling is visible and actionable

## Manual Override Behavior

### Persist model

Manual overrides are already persisted via `Selection.explanation.manuallyAdded: true` and `Selection.overrideReason` / `overrideReasonCategory` / `overrideReasonDetail`.

### Recreate draft behavior

When regenerating:
- Selections with `explanation.manuallyAdded: true` are preserved
- Selections with `explanation.manuallyRemoved: true` are kept removed
- Only auto-generated selections are replaced
- This matches existing `refreshDraftRound` behavior

### Drag-and-drop validation

When a player is dropped on a match column:
1. Determine role automatically (CORE if player's core team matches, else per rotation path, else CORE with override required)
2. Call `addPlayerToDraftMatch` with the determined role
3. If adding to a different match, also call `removePlayerFromDraftMatch` from the source match
4. If the move violates a soft rule, persist with `overrideReasonCategory` and mark as manual override
5. If the move violates a hard constraint (finalized match, nonexistent player), reject with clear error

This is already implemented in the existing round board. No fundamental changes needed.

### Audit trail

Each manual move creates:
- `Selection` row with `overrideReason`, `overrideReasonCategory`, `overrideReasonDetail`, `explanation.manuallyAdded: true`
- `MovementLedger` row for cross-team movement (or same-team double-load)
- The `changeDraftPlayerRole` function updates the existing role and records the change

## Success Criteria

1. Fixtures page shows selection state per period, round, and match
2. Fixtures page shows available actions per level based on state
3. Create draft generates selections and shows updated state
4. Recreate draft regenerates, preserving manual edits by default
5. Clear draft removes draft data with confirmation, preserves finalized data
6. Finalize marks as approved/final at round and match level
7. Invalid actions are disabled or rejected
8. Round board is the primary working surface with drag-and-drop
9. Dragging player between columns persists via backend
10. Manual overrides are visually marked and audit-trailed
11. Hard-rule violations are rejected with explanation
12. Soft-rule violations produce warnings but are allowed with override reason
13. Errors are visible and actionable in the UI
14. No sensitive player data in external/public payloads

## Open Questions

1. Should match-level "Generate" action create a full round generation (even if only one match is targeted) or run the per-match generator only? — Per AGENTS.md, the round-level pipeline must run in full. Match-level regenerate uses `refreshDraftSelection` which is per-match but preserves round consistency. Match-level create (from NOT_GENERATED) should trigger the full round generation for that round.
2. Should un-finalize be available from the Fixtures page? — Yes, as per the existing rounds page pattern.
3. What confirmation copy should clear actions use? — "Remove all draft selections for [scope]. Finalized data will not be affected."