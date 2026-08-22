# ARR-0022: Dead player-assignment drag board, and a missing audit trail on its live replacement

## State

Resolved (2026-08-22)

## Resolution

Maintainer decided `DecisionRecord` (matching AGENTS.md's stated scope for player-development
actions, and what the dead code already assumed before removal — see `## Evidence` below).

`updatePlayerCoreTeamAction` (`src/app/(app)/players/actions.ts`) now fetches the player's
previous `coreTeamId` before calling the domain update, then calls `recordDecision({
decisionType: "PLAYER_ASSIGNMENT", entityType: "PLAYER", action: "MOVE_PLAYER_TO_TEAM",
beforeSnapshot: { coreTeamId: previous }, afterSnapshot: { coreTeamId: next }, organisationId
})` — the same decision type/action the removed dead code used, so this isn't a new
audit-mechanism precedent, just restoring the one that already existed before the dead UI was
deleted. `removePlayerAction`/`restorePlayerAction`'s separate `logSecurityEvent`-style
precedent in the same file was deliberately left as-is (not reconciled) — the maintainer's
decision was specifically "use DecisionRecord for this one," not "unify all player-action
auditing onto one mechanism," which remains a distinct, unresolved question if it matters later.

Tests: `src/app/(app)/players/__tests__/update-core-team-audit.test.ts` (3 cases — records the
decision on a real move, records a null afterSnapshot on unassignment, and does not record
anything when the domain update fails).

Programme: `platform-integrity-programme` Phase 15.

## Identified

2026-08-21

## Residue

Two separate, previously-undiscovered issues surfaced together while evaluating whether the
app's only drag-and-drop component conforms to the UI/UX programme's intent
(`.matchboard-work/ux-branding-language-ui/PROGRAMME.md`, gitignored working bundle):

**1. `PlayerAssignmentBoard` is fully dead code.** `src/components/players/player-assignment-board.tsx`
(240 lines) plus its dedicated domain module `src/domain/player-assignment/` (`service.ts`,
`actions.ts`, `types.ts`, 179 lines) plus both their test files (256 lines) — 727 lines total —
implement a drag-and-drop "move player between team columns" board for reassigning a player's
core team. It is not imported by any route or page component anywhere under `src/app/`. Confirmed
by exhaustive grep: the only files referencing `PlayerAssignmentBoard` or the
`src/domain/player-assignment/` module are its own test files.

**2. A second, live implementation of the same operation exists and is the one actually
shipped**, but it is missing the audit trail the dead code had. The real "Manage base groups"
mode's player-editor form (`src/components/players/player-editor-form.tsx`) uses a plain
`<select name="coreTeamId">` field, saved via `updatePlayerCoreTeamAction` →
`updatePlayerCoreTeamDomain` (`src/app/(app)/players/actions.ts` →
`updatePlayerCoreTeam` in `src/lib/players/player-domain.ts`). This live path does a plain
`db.player.update({ data: { coreTeamId } })` with no audit call of any kind — neither
`recordDecision()`/`DecisionRecord` nor `logSecurityEvent()`/its named helpers.

The dead code's `movePlayerToTeam` (`src/domain/player-assignment/service.ts`) DID call
`recordDecision({ decisionType: "PLAYER_ASSIGNMENT", entityType: "PLAYER", action:
"MOVE_PLAYER_TO_TEAM", ... })` on every move. Because that code path is unreachable, no core-team
reassignment made through the app today produces any audit record at all, even though
`AGENTS.md`'s own "Assistant Manager Workflow Rules" section states: *"Player-development and
assistant-manager actions must create an auditable `DecisionRecord`."* Core-team reassignment is
squarely player-development/roster-administration territory, not a selection-engine action (the
`AGENTS.md` carve-out for `logSecurityEvent()` is explicitly scoped to "finalize, un-finalize,
manual override, draft clear/regenerate").

Complicating a simple fix: player-related actions in this same file don't consistently use
`DecisionRecord` either. `removePlayerAction`/`restorePlayerAction` call `logPlayerRemove`/
`logPlayerRestore` from `@/lib/security/audit-log` (the *other* audit mechanism) instead of
`recordDecision()`. So there are two active precedents in the same file pointing at two different
audit mechanisms for "a player-related action," and neither one is currently attached to
core-team reassignment specifically.

## Intended architecture

Per `AGENTS.md`: `DecisionRecord` (via `recordDecision()`) is for player-development and
assistant-manager actions; `logSecurityEvent()`/named helpers are for selection-engine actions
(finalize/un-finalize/override/clear/regenerate). Core-team reassignment should get one of these
— most plausibly `DecisionRecord`, matching what the dead code already assumed and matching
`AGENTS.md`'s own stated scope for that mechanism — applied consistently, with `removePlayerAction`/
`restorePlayerAction`'s existing `logSecurityEvent`-style calls either left as an intentional,
documented exception (destructive-data-operation security logging, distinct from a "development
decision") or reconciled onto the same mechanism, whichever the maintainer decides is correct.

This ARR does not decide which; it isn't a coding-agent call to make unilaterally without
confirming intent, and guessing wrong would bolt a second inconsistent audit call onto the
codebase rather than fixing the real gap.

## Evidence

- `src/components/players/player-assignment-board.tsx` — the dead component, confirmed via
  `grep -rln "PlayerAssignmentBoard" src/app/` returning zero matches.
- `src/domain/player-assignment/service.ts:88-97` — `recordDecision({ decisionType:
  "PLAYER_ASSIGNMENT", ... })`, the only place this specific audit call exists.
- `src/lib/players/player-domain.ts:106-135` — live `updatePlayerCoreTeam`, no audit call at all.
- `src/app/(app)/players/actions.ts:432-444` — live `updatePlayerCoreTeamAction`, confirms
  `ctx.organisationId` is available at the call site (so wiring `recordDecision()` in later is
  straightforward once the mechanism decision is made) but nothing is currently called.
- `src/app/(app)/players/actions.ts:384-405` — `removePlayerAction`/`restorePlayerAction` calling
  `logPlayerRemove`/`logPlayerRestore` (`@/lib/security/audit-log`), the competing precedent.
- `AGENTS.md` § "Assistant Manager Workflow Rules": the `DecisionRecord`/`logSecurityEvent`
  scoping rule this residue sits against.

## Impact

- Every core-team reassignment made through the shipped UI today is unaudited — no record of
  who moved a player between teams, when, or why. This is a real, live gap, not a theoretical one.
- The dead 727-line component + domain module cost real maintenance/review attention (it has its
  own test suite that runs on every `npm test`) for zero product value.
- Evaluated the dead component's drag/drop UX itself against `PROGRAMME.md` §20/§21/§50 while
  investigating: its non-drag alternative (double-click to reveal a `<select>`) is real but
  poorly discoverable (no visible affordance, relies on a hidden gesture), has no keyboard path,
  no command-palette integration, and no phone-specific experience — it would not have conformed
  to programme intent even if it were wired up. This is why it is being removed rather than
  reconnected.

## Containment

- The dead code is being removed in the same change that files this ARR (branch/PR to follow)
  — see the commit for exact file list. No product surface depended on it, so removal carries no
  functional risk (verified: zero importers outside its own tests).
- The missing audit trail on `updatePlayerCoreTeam` is **not** fixed in the same change — it
  needs the maintainer's call on which mechanism (`DecisionRecord` vs. reconciling toward
  `logSecurityEvent`-style, or something else) before implementing, not a guessed fix. Tracked
  here until that decision is made and implemented.
