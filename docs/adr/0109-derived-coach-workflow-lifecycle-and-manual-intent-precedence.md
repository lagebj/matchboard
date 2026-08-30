# ADR-0109: Derived Coach Workflow Lifecycle and Manual-Intent Precedence

## Status

Accepted

## Context

Three prior ADRs bound this exact question and explicitly declined to remove finalize/unfinalize
ceremony:

- **ADR-0095** introduced the date-driven planning-boundary *concept* (`planningClosedAt`,
  `deriveMatchPlanningStatus()`) but explicitly kept it coexisting with manual finalize: "The
  existing finalization model is retained as the current mechanism... Finalization remains
  available for coaches who want to lock selections early."
- **ADR-0100** audited removing finalize/lock/confirm ceremony and explicitly refused, calling
  finalize/finalized "a **technical invariant** — plan becomes immutable history — not something
  to remove," and scoped Phase 6 to additive-only changes (round progress, Pin UI).
- **ADR-0101** promoted a derived `deriveMatchLifecycleStatus()` to the *primary displayed label*
  for a single match, but was explicit that this was display-layer only: "The underlying
  finalize/un-finalize mechanism and database enums are unchanged... Selections still transition
  DRAFT→FINALIZED exactly as before."

The maintainer has now commissioned the **coach-workflow-simplification** programme
(`.matchboard-work/coach-workflow-simplification/`), whose `DECISIONS.md` explicitly overrides
this prior direction: "Round finalization is removed" (D6), "Match finalization is removed" (D8),
"Line-up confirmation is removed" (D7), and "This intent... must override and redefine what
AGENTS.md or other supporting documentation states" (the same override authority ADR-0101 already
invoked once for the narrower display-layer change). This is the missing authority ADR-0100
identified as the blocker to a full rework.

Repository audit (2026-08-30, this programme) found:

- `src/lib/selection/planning-boundary.ts`'s boundary-*closing* functions
  (`closeMatchPlanning`/`closeMatchRoundPlanning`) have **zero callers** anywhere in the
  repository — the lazy/idempotent capture ADR-0095 promised was scaffolded but never wired up.
  The boundary-*checking* functions (`isMatchPlanningEditable`/`isMatchRoundPlanningEditable`) ARE
  real mutation gates, called from `manual-draft-edit.ts`, `move-planned-selection.ts`, and
  `clear-draft-selection.ts` — but today a match past scheduled kickoff still returns
  `editable: true` with only a warning, not `false`. Kickoff passing does not yet close planning.
- Three separate adapter surfaces call the same finalize/unfinalize domain functions: the Round
  Board/rounds-list actions, a parallel `src/domain/fixtures/actions.ts` adapter, and a standalone
  `POST /api/finalize-round` route.
- Two additional container-level finalization surfaces exist that are **not** named by
  `DECISIONS.md`/`PROGRAMME.md`'s explicit scope language ("finalize round", "finalize match",
  "Event squad lock"): `Event.status` (DRAFT/FINALIZED, whole-event close-out for exports) and
  `LeagueSeason.status` (OPEN/FINALIZED, season-end archival). These are coarser, season/event-end
  "the books are closed" assertions, not per-round/per-match ceremony — see Scope below.
- Event allocation confirmed the exact bug class `CURRENT-STATE.md` hypothesized:
  `distributeRemainingByBalance()` applies `squads[0]?.maxSize` to every squad's capacity check
  (event-squad-generation.ts), and `generateEventSquadsAction` passes only `squads[0].targetSize`
  into pre-generation pool validation. Event squad-player provenance is a 3-value
  `source` (`MANUAL`/`AUTO`/`LOCKED`) plus a separate `locked` boolean; `togglePlayerLockAction`
  writes `source: 'LOCKED'` when locking, `source: 'MANUAL'` when unlocking — the exact redundant
  "assign then separately lock" ceremony D12 targets. Only the swap optimizer's `.locked` check
  (not manual provenance) protects an assignment from being moved, so a `MANUAL, locked: false`
  assignment is NOT protected in 3 of 4 generation patterns (`PRESERVE_AND_FILL` is the exception).
  There is exactly one generation entry point (`generateEventSquadsAction`); "fill remaining
  places" and "regenerate automatic plan" are not distinct operations today.
- Report lifecycle (`report-domain.ts`, `report-mutations.ts`, `event-report-mutations.ts`)
  already implements most of D9/E1 today: `completeReport()`/`completeEventReport()` already
  transition DRAFT-or-REPORTED straight to LOCKED in one coach-facing action, and
  `reopenReport()` already exists. `submitReport()`/`lockReport()` are lower-level primitives; the
  currently-documented UI path is the single `completeReport()` action. This workstream needs
  audit-and-prune, not a rebuild.

## Decision

**This ADR supersedes ADR-0095's item 1 ("the existing finalization model is retained") and
ADR-0100's refusal to remove finalize/lock/confirm ceremony, on the explicit authority of
`DECISIONS.md` D1–D26.** ADR-0101's derivation logic (`deriveMatchLifecycleStatus()`) is not
superseded — it is extended (round-level projection added, see below) and its match-level
semantics are preserved.

### 1. Planning boundary becomes the sole mutability gate, and it self-closes

`isMatchPlanningEditable()`/`isMatchRoundPlanningEditable()` (`planning-boundary.ts`) remain the
one owner of "can this be edited right now," called by every mutation path
(`manual-draft-edit.ts`, `move-planned-selection.ts`, `clear-draft-selection.ts`, and any new
caller). Two changes:

- Scheduled kickoff passing becomes a real closing condition, not a warning: `now >= startsAt`
  makes editing unavailable, matching D4.
- The check for `matchRound.status === "FINALIZED"` is removed from the gate. Round-level
  "finalized" becomes a downstream side effect of every constituent match's boundary having
  closed (see §2), never an independent gate — Migration Rule #8: "a persisted MatchRound status
  remains for compatibility, it must not be the canonical mutability gate."
- The check performs the boundary capture itself, lazily and idempotently (Migration Rule #6): an
  `Match.updateMany({ where: { id, planningClosedAt: null }, data: { planningClosedAt: now } })`
  atomically claims the capture (a `count: 0` result means another concurrent caller already won
  the race — a safe no-op), then a transaction snapshots the plan.

### 2. Baseline capture reuses the existing snapshot writer; only the trigger changes

`round-finalization-transitions.ts`'s `finalizeSelectionsForScope()`/`finalizeRoundRecord()` (the
existing atomic writers stamping `Selection.status = FINALIZED`, `ruleConfigVersion`,
`MovementLedger.isDraft = false`, and `MatchRound.status = FINALIZED` when it was the round's last
open match) are **reused unchanged**. What changes is who calls them: a new
`ensureMatchPlanningBaselineCaptured()` (`src/lib/selection/capture-planning-baseline.ts`) calls
them automatically from three triggers instead of a coach clicking "Finalize":

1. `isMatchPlanningEditable()` observing kickoff has passed (lazy, per Migration Rule #5/#6).
2. Live match session start (`startLiveSession()`) — closes immediately, even before kickoff,
   per D4 "starting actual live activity must capture or establish the planned baseline
   immediately."
3. A one-time backfill script (`scripts/backfill-match-planning-baseline.ts`) run once against
   existing data, so historical past-but-never-revisited matches don't silently wait on a lazy
   trigger that may never fire (protects fairness/evidence queries that filter on
   `Selection.status === FINALIZED` from a data gap, since `planningClosedAt` is a migration added
   the same day this program starts — every existing row has it `null`).

No coach-facing "finalize" verb remains. `Selection.status`, `MovementLedger.isDraft`,
`MatchRound.status`, and their ~90 existing readers (evidence, exports, fairness, history) are
**unchanged in meaning and are not migrated** — this is the "smallest safe adaptation that
preserves the intent" the coding-agent prompt calls for when full removal would require auditing
and re-verifying ~90 call sites with no product benefit. `MatchRound.status = FINALIZED` continues
to exist and continues to display via the existing round-level `StatusBadge`; it is simply no
longer capable of being set by a coach action, and no longer consulted by the mutability gate.

### 3. Round-level derived projection extends ADR-0101's pattern to rounds

`deriveRoundProgress()` (ADR-0100, `round-progress.ts`) already computes
Planning/Partially played/All matches played/Reporting/Complete as an additive line. This ADR
promotes a round-level analogue of ADR-0101's per-match promotion: the Rounds list and Round Board
header show round *progress* (this five-state model) as the primary round-level fact a coach
acts on; `MatchRound.status`'s Draft/Blocked/Ready/Finalized remains available as secondary/plan-
integrity detail (Blocked/Decision-required counts), exactly mirroring how ADR-0101 kept
Draft/Blocked/Ready/Finalized as a legitimate secondary signal at match level.

### 4. Reschedule-before-start reopens planning; there is no "un-finalize"

A genuine reschedule (moving `startsAt` into the future) on a match whose boundary has closed but
which has **no** live activity and **no** completed report clears `planningClosedAt` and reverts
that match's `Selection`/`MovementLedger`/round-status via the existing (unchanged)
`unfinalizeSelectionsForScope()`/`unfinalizeRoundRecord()` writers from
`round-finalization-transitions.ts`. This is exposed as part of the existing match reschedule
command, not a standalone "un-finalize" action, and is refused outright (not offered as an
override) when live activity or a completed report exists for that match.

### 5. Event squad allocation: fix per-squad targets, collapse to MANUAL/AUTO provenance, add a real fill operation

- Fix the two confirmed `squads[0]` leaks in `event-squad-generation.ts` and
  `generateEventSquadsAction` so every squad's own `targetSize`/`minSize`/`maxSize` governs its
  own allocation (D16/D17).
- Collapse `EventSquadPlayerSource.LOCKED` into `MANUAL` going forward: any `MANUAL` assignment
  (regardless of the separate `locked` boolean) is protected from automatic movement everywhere
  (generation, swap optimizer). `togglePlayerLockAction`'s UI ("Lock"/"Unlock" button whose only
  effect was `source: 'LOCKED'` vs `'MANUAL'`) is removed — D12's exact target ("assign then
  separately lock adds no new intent"). The `EventSquadPlayerSource.LOCKED` enum value and
  `EventSquadPlayer.locked` column are kept as **COMPAT**: no new code writes `LOCKED` or reads
  `.locked` as a protection signal; a data migration maps existing `LOCKED` rows to `MANUAL`.
  Removal condition: drop the enum value and column in a follow-up contract migration once this
  code has been live in production for one deploy cycle (ADR-0105 expand/contract discipline —
  this PR is the "expand" half, since a same-PR drop risks Vercel's deploy-before-migration-
  approval race described there).
- Add `fillEventSquadRemainingPlaces()` (`src/lib/events/event-squad-fill.ts`): a new,
  non-destructive operation computing `residualTarget = max(0, targetSize - currentCount)` per
  squad and adding only currently-unassigned eligible players, never moving an existing
  assignment, per D15/D16/D17 and the mandatory 12/9/9→11/5/5+9→1/4/4 fixture. This is additive —
  `generateEventSquadsAction` remains the "regenerate automatic plan" operation (MANUAL preserved,
  AUTO may move), now correctly per-squad-scoped.

### 6. Line-up confirmation removed where it adds no football meaning

League `MatchLineup.status` DRAFT/CONFIRMED and the `confirmLineup()`/`revertLineupToDraft()`
actions, and Event `EventMatchLineup.status` DRAFT/CONFIRMED and its five `CONFIRMED`-guards in
`event-lineup-actions.ts`, are removed as coach-facing ceremony. The current line-up is
authoritative while planning is open (per §1); live match start captures it as part of the same
baseline-capture transaction. `MatchLineupAssignment.source`/`locked` (League) already distinguish
manual from suggested assignments and are kept — auto-fill must respect a `MANUAL`/locked-by-coach
assignment without a second confirm step, matching §5's Event precedent.

### 7a. Scope boundary: whole-EventSquad-set lock (`confirmEventSquadsAction`) is retained

Unlike round/match finalize (pure ceremony with no real-world temporal analog, confirmed by the
fact its trigger could be fully automated from time), the whole-squad-set lock
(`EventSquad.status` DRAFT/LOCKED, `confirmEventSquadsAction`/`unconfirmEventSquadsAction`)
performs real, distinct work with no time-based trigger to replace it: validating the *complete*
squad set together (no duplicate players across squads, no unavailable players, minimum size,
goalkeeper coverage) as a deliberate readiness gate, and superseding stale `ReviewRequest`s with a
notification. There is no kickoff-equivalent boundary for "the coach is done picking Event
squads" — this is a semantic assertion the system cannot infer from time, analogous to `Complete
report` (D9/PRINCIPLES.md #10), not a redundant mirror of information already present. This
programme instead fixes the *player-level* redundant lock this section's D12 examples target
(§5's `togglePlayerLockAction` removal) and leaves the whole-squad-set lock as-is. Revisit only
with a new, explicitly-scoped decision if a future audit finds its validation/review-supersession
role can be safely relocated to a real-world boundary.

### 7. Scope boundary: `Event.status`/`LeagueSeason.status` container finalization is out of scope

`Event.status` (whole-event DRAFT/FINALIZED, gating exports) and `LeagueSeason.status` (whole
season-part OPEN/FINALIZED, gating season-end reporting) are **not** touched by this programme.
Neither is named by `DECISIONS.md`'s explicit target list (round finalization, match finalization,
line-up confirmation, Event *squad* lock), both represent a genuinely different, coarser
real-world assertion ("this whole event/season is over and its export is final") rather than
per-round/per-match planning ceremony, and touching them was not verified as in-scope during
audit. Removing them without a dedicated audit of season-end/export workflows would be an
unrequested scope expansion into an area D26/D21's deletion authority does not clearly reach.
Flagged as a candidate for a future, explicitly-scoped follow-up decision — not built here.

### 8. Pin (`PlayerLock`) restriction moves from round-FINALIZED to planning-boundary-closed

`createPlayerLock()`'s hard block ("Cannot pin a player in a finalized round") is rewritten to
check `isMatchRoundPlanningEditable()` instead of `matchRound.status === "FINALIZED"` — a Pin
remains valid only while it can still affect a future generation/edit, matching
`DOCUMENTATION-MAP.md`'s explicit instruction and preserving the distinction between Pin (an
intent constraint, kept per D13) and finalize (a ceremony, removed).

## Rejected alternatives

- **Preserve finalize/lock/confirm states but hide the buttons.** Rejected — this is explicitly
  disallowed by `PRINCIPLES.md` §18 ("No hidden state-machine replacement... the state-space
  itself must become simpler") and would leave three duplicate adapter surfaces
  (`rounds/actions.ts`, `domain/fixtures/actions.ts`, `api/finalize-round/route.ts`) as dead
  ceremony behind an invisible door.
- **Add a generic workflow/state-machine engine to model the derived lifecycle.** Rejected per
  D23/PROGRAMME.md non-goals — the existing `planning-boundary.ts` owner plus the existing
  `round-finalization-transitions.ts` writer already cover every required transition; no new
  abstraction is needed.
- **Migrate `Selection.status`/`MatchRound.status` off the DRAFT/FINALIZED enum entirely in this
  PR.** Rejected for this iteration — ~90 existing readers (evidence, fairness, exports, history,
  season overview) depend on the exact current semantics, and Migration Rule #9 explicitly allows
  "stop using it as the future-plan mutability gate... migrate readers to the lifecycle/baseline
  owner... remove the enum only after no production reader/writer depends on it" as a staged
  transition rather than a single-PR rewrite. §1–§2 already achieve the behavior-relevant half of
  this (it is no longer the mutability gate); full reader migration is out of scope for this PR
  and is recorded as residue (see ARR companion, if verified after implementation).
- **Drop `EventSquadPlayer.locked` and the `LOCKED` enum value immediately.** Rejected —
  ADR-0105's expand/contract discipline applies; a same-PR drop risks breaking already-deployed
  code during the approval-gated migration window.

## Consequences

- No coach-visible action exists to finalize/un-finalize a round or match, confirm a line-up, or
  lock an Event squad player. A coach still explicitly locks a whole Event squad set
  (`confirmEventSquadsAction`) and completes/reopens a post-match report — both are semantic
  assertions the system cannot infer, preserved per D9/§6 of PRINCIPLES.md.
- `Selection.status`, `MatchRound.status`, `MovementLedger.isDraft` keep their exact current
  values and meaning for every existing reader; only their write trigger changes.
- A past, never-revisited match's baseline is captured either lazily on first later interaction or
  by the one-time backfill script — never invented retroactively, per Migration Rule #5.
- Event allocation gets a real, tested residual-fill operation and per-squad-correct regeneration;
  manual Event assignments survive both without a separate lock click.
- `Event.status`/`LeagueSeason.status` finalization ceremony is untouched and remains a known,
  explicitly out-of-scope area for a future decision.

## Migration

- Additive: `capture-planning-baseline.ts`, `event-squad-fill.ts`, one-time backfill script, data
  migration mapping `EventSquadPlayer.source = LOCKED` rows to `MANUAL`.
- Removed: `finalize-match-round.ts`, `finalize-single-match.ts`, `unfinalize-match-round.ts`,
  `unfinalize-single-match.ts` (coach-ceremony-shaped verbs with override-reason validation no
  longer meaningful once there is no coach decision point at capture time) and their three adapter
  surfaces (Round Board/rounds-list actions, `domain/fixtures/actions.ts` finalize actions,
  `api/finalize-round/route.ts`), `confirmLineup`/`revertLineupToDraft` (League),
  `EventMatchLineup` CONFIRMED guards (Event), `togglePlayerLockAction` (Event squad player lock).
- Unchanged, compat-only: `SelectionStatus`/`MatchRoundStatus`/`MatchLineupStatus`/
  `EventSquadStatus` enums and their historical rows; `EventSquadPlayerSource.LOCKED` enum value
  and `EventSquadPlayer.locked` column (write-path removed, column retained pending a follow-up
  contract migration); `Event.status`/`LeagueSeason.status` (untouched, see §7).

## Supersedes

ADR-0095 item 1 ("the existing finalization model is retained as the current mechanism") and
ADR-0100's decision to refuse ceremony removal. ADR-0101 is extended, not superseded: its
match-level `deriveMatchLifecycleStatus()` primacy is preserved; §3 above adds the round-level
analogue ADR-0101 explicitly left as future work ("A full Phase 6... remains open").
