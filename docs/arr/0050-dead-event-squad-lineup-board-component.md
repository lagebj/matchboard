# ARR-0050: Dead `EventSquadLineupBoard` read-only pitch component

## State

Resolved

## Identified

2026-09-13

## Residue

Investigating the Event squad planning surfaces in scope for the Atlas Follow-up bundle's Phase
F7 (production pitch rendering migration, `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`) —
specifically its recommended migration order's "event/match planning pitch surfaces" item —
found that `EventSquadLineupBoard` (`src/components/events/event-squad-lineup-board.tsx`, 140
lines) and its sole domain dependency, `src/lib/events/event-lineup-assignment.ts`'s
`computeLineupAssignment()` (343 lines), are **entirely unreachable from any real route**,
confirmed by a repository-wide search: zero imports of `EventSquadLineupBoard` anywhere outside
its own definition file, and zero imports of `event-lineup-assignment.ts`'s exports (`LineupSlot`,
`LineupAssignment`, `computeLineupAssignment`, `formatFitTier`, `getPlayerFitTier`,
`resolveSlots`) outside `event-squad-lineup-board.tsx` itself. Neither module has a test file.

Git history confirms this is genuine residue, not an oversight in the search:

- Introduced in `43ed66d4` (2026-07-08, "feat(events): position-first generation with lineup
  board, remove tactic suggestion") — the commit message itself states "Add EventSquadLineupBoard
  component for read-only pitch formation display," and the same commit wired it into
  `event-detail.tsx`/`page.tsx` (59 and 158 changed lines respectively) — it was genuinely live at
  introduction.
- Superseded the very next day by `aec8a3da` (2026-07-09, "feat(events): event match lineup with
  formation, slot assignment, and auto-fill (#86)"), which added the richer, editable, per-match
  `EventMatchLineupPanel`/`event-match-lineup-panel.tsx` and modified `event-detail.tsx` again
  (37 changed lines) — removing the `EventSquadLineupBoard` reference without deleting the
  component or its domain module.
- **Already independently, accidentally re-engaged with once**: `c8551531` (2026-09-11, "feat
  (events): activate Touchline on event squad planning (ADR-0134 Phase 6) (#497)") touched
  `event-squad-lineup-board.tsx` again — token-aligning/styling it as part of a broad Touchline
  visual migration pass — without anyone noticing it renders nowhere. This is concrete, not
  hypothetical, evidence of the exact accidental-extension risk this record exists to prevent.

## Intended architecture

`EventMatchLineupPanel` (`event-match-lineup-panel.tsx`) is the current, actually-reachable,
per-match lineup planning surface on the Event detail page's Matches tab — editable, formation-
aware, backed by `EventMatchLineup`/`EventMatchLineupAssignment` (the real Prisma models), and (as
of this same Phase F7 work) migrated to the canonical `TouchlinePlanningPitch`. It supersedes
`EventSquadLineupBoard`'s narrower, read-only, squad-level (not match-level) formation display —
the domain question `EventSquadLineupBoard` answered ("what does this squad's assigned lineup look
like") is now more completely answered per-match by the panel, which additionally supports editing
and auto-fill.

There is no current architectural intent for a separate, read-only, squad-level (as opposed to
match-level) lineup preview to exist alongside the editable per-match panel — none is referenced
by any route, page, or navigation entry, and no design document in this repository names one as
planned future work.

## Impact

- No functional impact today — neither `EventSquadLineupBoard` nor `computeLineupAssignment()`
  executes in any live coach workflow, so there is no behavior to regress by leaving them in
  place, and no user-facing gap from their absence (the Event squad/lineup workflow already works
  fully through `EventMatchLineupPanel`).
- Confirmed, repeated risk for a future agent (not merely theoretical, per PR #497 above):
  encountering a complete, well-formed, styled component and its supporting 343-line domain
  module can reasonably (and wrongly) suggest it is active code worth preserving/extending/fixing,
  costing real review and styling effort for something zero users can ever see.
- This is exactly the item Atlas Follow-up Phase F7's "event/match planning pitch surfaces"
  migration step would otherwise have silently spent effort migrating to `TouchlinePlanningPitch`
  for no user-facing benefit — this ARR is why that migration step was skipped for this component
  instead.

## Containment

- Do not migrate `EventSquadLineupBoard`'s `TacticsBoard` usage to `TouchlinePlanningPitch` as
  part of Phase F7 or any later pitch-rendering migration — there is no reachable route to migrate
  for, and doing so would be wasted, unverifiable effort matching the same pattern PR #497 already
  fell into once.
- Do not delete `EventSquadLineupBoard`/`event-lineup-assignment.ts` as part of unrelated work
  without first checking this ARR's resolution criteria below.
- If a future coding-agent session is asked to "restyle," "fix," or "improve" the Event squad
  lineup board, or finds `event-lineup-assignment.ts` while working on Event squad generation,
  check this ARR first rather than assuming the component is reachable.

## Resolution criteria

- [x] A maintainer decision on whether to delete `EventSquadLineupBoard` and
      `event-lineup-assignment.ts` outright (the squad-level read-only preview concept is fully
      superseded by the per-match editable panel and not worth reviving), or to genuinely wire a
      read-only squad-level lineup preview back into `event-detail.tsx`'s Squads tab (e.g.,
      showing each squad's overall formation placement at a glance, distinct from per-match
      editing) as a deliberate, separate product decision.
- [x] Once decided: either both files are deleted with a regression check confirming no remaining
      reference exists, or the component is genuinely wired into a real route/page and migrated to
      `TouchlinePlanningPitch` (`readOnly` mode, no `editableGrid`) at that time, with its own
      test coverage added (neither file has any today).

## Disposition

Resolved (2026-09-14): `EventSquadLineupBoard` (`src/components/events/event-squad-lineup-board.tsx`)
and `event-lineup-assignment.ts` (`src/lib/events/event-lineup-assignment.ts`) were deleted
outright, as fully superseded by the reachable per-match `EventMatchLineupPanel` implementation.
No replacement squad-level preview was created; no helpers were preserved. The corresponding
`describe('computeLineupAssignment', ...)` test block in
`src/lib/events/__tests__/event-squad-generation.test.ts` (which tested the removed module) was
deleted alongside it. A repository-wide search after deletion confirms no remaining import of
`EventSquadLineupBoard`, `computeLineupAssignment`, or either removed module path.

## Related decisions

- ADR-0136 (Touchline Design Atlas & Composition Convergence) — PR #497's Phase 6 pass, which
  touched this dead component without discovering it was unreachable; unrelated to this record's
  root cause, but the concrete evidence that accidental re-engagement already happened once.
- Atlas Follow-up bundle, `06_CANONICAL_PITCH_RENDERING_CONTRACT.md` §12 ("Migrate all planning
  views to `TouchlinePlanningPitch`") — the work that surfaced this finding while auditing Event
  planning pitch surfaces for Phase F7's migration order.

## Related implementation

- `src/components/events/event-squad-lineup-board.tsx`
- `src/lib/events/event-lineup-assignment.ts`
