# ADR-0097: Planned Rotation Live Execution — Apply/Delay/Skip/Change

## Status

Accepted

## Context

The `PlannedRotation`/`PlannedRotationChange` schema and domain service (`src/lib/planned-rotation/planned-rotation.ts`) were added without an ADR. The Evidence-Driven Coaching Loop programme's Phase 5 requires live mode to show the next due planned change with `Apply`, `Delay`, `Skip`, `Change` actions, where "Applying/changing writes normal actual live events... Skipping creates no actual event... Never mutate the original planned timeline to match reality" (DECISIONS.md).

Auditing the existing implementation found two real defects, not just missing features:

1. **"Apply" never wrote a real event.** `PlannedRotationPrompt`'s `handleApply` fabricated placeholder ids client-side (`` `live-${Date.now()}-out` ``) and passed them straight to `applyPlannedChange`, which stored them as `liveEventId` with no corresponding `LiveMatchEvent` row ever created via the canonical live-event owner (`recordEventForActor`/`recordEvent`). A planned change marked "Applied" therefore never became actual match truth — it wouldn't appear in `MatchRotation`, the actual position timeline, post-match reports, or combination evidence.
2. **`Delay` didn't exist** (`PlannedChangeStatus` had only `PENDING/APPLIED/SKIPPED/MODIFIED`) and **`Change` had no UI** despite being wired into the action object passed down from `LeagueLiveMatchWithRotation` — a dead path.

## Decision

1. **`Apply` now executes for real, server-side, in one server action.** `applyPlannedChangeAction` (`src/app/(app)/matches/planned-rotation-live-actions.ts`) resolves the match's active `LiveMatchSession`, estimates the current match time (see below), calls the canonical `recordEvent()` owner to create `ROTATION_OUT`/`ROTATION_IN` (or, for a position-only swap, two `POSITIONS_CHANGED` events — see ADR-0096's amendment), and only then calls `applyPlannedChange()` with the real resulting event ids. The client no longer invents ids.

2. **No clock anchor is persisted server-side, so exact current match time cannot be known outside the browser's own live clock.** `estimateCurrentMatchSeconds()` (`live-match-event-store.ts`) extrapolates from the most recent timed `LiveMatchEvent` (its `matchSeconds` + wall-clock time elapsed since it was recorded), or from `LiveMatchSession.startedAt` if no timed event exists yet. This is explicitly an estimate, consistent with "Support exact and approximate timestamps. Preserve uncertainty rather than inventing precision" — it is not a second, competing clock implementation; the client's own `match-clock.ts` remains authoritative for the UI countdown.

3. **`DELAYED` is a re-visitable status, not a terminal one.** Unlike `SKIPPED`/`APPLIED`/`MODIFIED`, a `DELAYED` change remains actionable: `getNextPlannedChange()` still surfaces it (after any still-`PENDING` change earlier in sequence), and it can later be `Apply`'d or `Skip`'d normally. This matches "Delay preserves planned time and actual execution time" — delaying doesn't touch `approximateMatchSeconds` (the plan), and whenever the change is eventually applied, the new `actualMatchSeconds` column records when it actually happened, distinct from the plan.

4. **`Change` is scoped to reversing the named direction, not a free-form player/position picker.** `applyPlannedChangeAction` accepts optional `overrides` (out/in player and position) and executes with those instead of the plan — the original `PlannedRotationChange` row's authored fields are never rewritten (only `status`, `liveEventId`/`secondaryLiveEventId`, `actualMatchSeconds`, and an optional deviation note change). The live prompt currently only exposes one bounded interaction — swap which named player goes out vs. comes in — because a full arbitrary player/position picker needs squad-roster data that isn't currently threaded into `PlannedRotationPrompt` (it lives inside the encapsulated `LiveMatchClient`). The server action's general `overrides` shape means a richer picker UI is a pure frontend follow-up, not a server contract change.

5. **`secondaryLiveEventId` is now persisted.** The bridge's `ApplyPlannedChangeResult` always returned `inEventId`, but the DB row only ever stored `liveEventId` (the out-event). Both are now stored so a completed substitution's full event pair is auditable from the change row itself.

## Consequences

- A planned change applied during live play now reliably produces real `LiveMatchEvent` rows, which flow into `MatchRotation` (via the existing report-seeding pairing logic) and the actual position timeline exactly like any manually-tapped live rotation — closing a gap that would otherwise have silently starved Phase 2/3 evidence of planned-and-executed substitutions.
- `rotation-vs-actual.ts`'s planned-vs-actual review surfaces a `delayed` deviation state and an "applied N min later/earlier than planned" note when `actualMatchSeconds` and `approximateMatchSeconds` diverge by a minute or more.
- **`checkPlannedRotationCoverage` is now wired (follow-up change):** `checkPlannedRotationCoverageAction` (`planned-rotation-actions.ts`) reads starters from the team's current match line-up (Tactics tab) — never fabricated from the full drafted squad — and surfaces goalkeeper/minimum-on-pitch/untimed-change issues on the Rotations tab. When no line-up has been set yet, the UI says so honestly instead of guessing who is actually starting.
- The same action also surfaces season **partnership** evidence (`selectRelevantPartnerships()`) for the current starters, giving the coach factual "these two have played together before" context while planning rotations. This deliberately stops short of the deeper "planned continuity/combination exposure" ambition — deriving a full planned TRIANGLE/LINE/CORRIDOR/FUNCTIONAL_UNIT/FULL_CONFIGURATION topology for a *plan* the way `combination-topology.ts` derives it for the *actual* timeline (which would require resolving `line`/`lane` for planned starters and duplicating a meaningful slice of the actual-topology engine). `projectPlannedLineup`/`projectPlannedMinutes` remain unused by any call site; extending planned-topology derivation beyond PARTNERSHIP is left for a further follow-up.

## Migration

- `PlannedChangeStatus` gains `DELAYED` (additive enum value).
- `PlannedRotationChange` gains `actualMatchSeconds Int?` and `secondaryLiveEventId String?` (additive, nullable columns) — migration `20260830140000_add_planned_change_delay_and_actual_timing`.

## Supersedes

None (fixes and completes the existing, undocumented `PlannedRotation` live-execution behavior).
