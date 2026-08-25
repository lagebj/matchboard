# ARR-0030: Event report completion (DRAFT->LOCKED) is reimplemented inline in a server action, not domain-owned

## State

Confirmed, deferred

## Identified

2026-08-24 (Architecture Integrity Programme, AIP-3, while resolving ARR-0028)

## Residue

The League side already centralizes post-match report Learn-phase-internal transitions
(DRAFT -> REPORTED -> LOCKED) in `src/lib/reports/report-mutations.ts`
(`submitReport`/`lockReport`/`completeReport`/`reopenReport`), which in turn use shared
validation helpers from `src/lib/reports/report-domain.ts` (`canTransitionTo`, `isReportLocked`,
`hasUnknownAttendance`). ARR-0028 explicitly scoped this as already-correct, not residue.

The Event side has no equivalent domain module. `completeEventMatchReportAction()`
(`src/app/(app)/events/event-post-match-actions.ts:310-351`, a `"use server"` action file)
independently reimplements the same category of logic inline:

- Its own "is this report already locked" check (`report.status === 'LOCKED'`, line 323) —
  duplicating what `isReportLocked()` centralizes for League.
- Its own "does any player have unknown attendance" check
  (`report.playerReports.some((pr) => pr.attendanceStatus === 'UNKNOWN')`, lines 327-329) —
  duplicating what `hasUnknownAttendance()` centralizes for League.
- Its own direct `db.eventPostMatchReport.update({ data: { status: 'LOCKED', completedAt: ...
  } })` (lines 335-341) — the literal completion write, done inline rather than through an owning
  function.

The same file's other exported actions (`updatePlayerAttendanceAction`,
`updatePlayerAttendanceBulkAction`, `updatePlayerReportAction`, `deletePlayerReportAction`,
`reopenEventMatchReportAction`, etc. — lines 140, 178, 207, 239, 265, 295, 353+) each repeat
their own `report.status === 'LOCKED'` guard independently rather than sharing one lock-check
helper — six-plus independent instances of the same one-line check, not just the completion path.

## Intended architecture

Programme outcome #4/#5 and ADR-0088 (this programme's Plan -> Run -> Learn lifecycle contract):
the Learn-phase-internal transition for a report family should have one owning implementation
that its adapters call, exactly as League's `report-mutations.ts` already demonstrates. The Event
side needs an equivalent — either its own `event-report-domain.ts`/extended
`event-report-mutations.ts` (ADR-0088 already created this file for Run->Learn *seeding*; it does
not yet cover Learn-phase-internal completion), or a genuinely shared cross-domain module if the
transition rules turn out to be identical enough to justify one (unverified — Event reports use
`attendanceStatus`/`playerReports` with different required fields than League's
`playerActuals`/absence-reason structure, so this needs its own investigation, not an assumption).

## Evidence

- `src/app/(app)/events/event-post-match-actions.ts:310-351` (`completeEventMatchReportAction`) —
  inline lock-check, inline unknown-attendance check, inline completion write.
- `src/app/(app)/events/event-post-match-actions.ts:140,178,207,239,265,295` — six further inline
  `report.status === 'LOCKED'` guards in sibling actions in the same file.
- `src/lib/reports/report-domain.ts` (`canTransitionTo`, `isReportLocked`,
  `hasUnknownAttendance`) — the League-side centralization this file does not have an Event-side
  equivalent of.
- `src/lib/reports/report-mutations.ts` (`completeReport`) — the League-side owning function this
  file does not have an Event-side equivalent of.

## Impact

- A future correction to League's completion rule (e.g. a new required field, a different
  attendance-completeness check) applied to `report-domain.ts`/`report-mutations.ts` would not
  automatically apply to the Event side, since the Event side has no shared implementation to
  inherit the fix — exactly the class of defect ARR-0028/ADR-0088 already fixed for League's
  finalize/un-finalize and Run->Learn seeding.
- Lower severity than ARR-0028's original findings: this is Learn-phase-*internal* (DRAFT <->
  REPORTED <-> LOCKED), not a cross-phase-boundary transition, and ARR-0028 explicitly scoped
  Learn-phase-internal transitions as out of its evidence (it only flagged the League side was
  already correct there). This is a same-*pattern* issue on the Event side, not literally within
  ARR-0028's own resolution criteria.

## Containment

- Do not add a third independent `report.status === 'LOCKED'`-style guard to
  `event-post-match-actions.ts` without at least extracting the existing six into one shared
  helper in the same pass.
- Do not build a new Event-report state-machine assuming it must mirror League's exactly —
  verify the actual required Event-side transition rules first (this file's actions suggest a
  simpler DRAFT/LOCKED model without League's REPORTED intermediate step and structured-absence
  requirement; confirm before designing).

## Resolution criteria

- An Event-side domain module (new or added to `event-report-mutations.ts`) owns the
  DRAFT->LOCKED completion transition and its lock/unknown-attendance checks; every action in
  `event-post-match-actions.ts` that currently reimplements a lock check calls it instead.
- Tests exist asserting the completion transition's invariants (cannot complete with unknown
  attendance, cannot mutate a locked report) against the shared implementation, not per-action
  duplicated assertions.

## Disposition

Confirmed, deferred. Not resolved in AIP-3 (Architecture Integrity Programme) — recorded so it
is not silently lost after being found during ARR-0028's investigation. No target phase assigned;
revisit as its own scoped task, since it needs its own state-machine investigation rather than
reusing ADR-0088's Run->Learn seeding work.

## Related decisions

ADR-0088 (Plan -> Run -> Learn lifecycle transition ownership — established the pattern this ARR
asks the Event side to follow, but did not resolve it)

## Related implementation

- `src/app/(app)/events/event-post-match-actions.ts`
- `src/lib/reports/report-domain.ts`, `src/lib/reports/report-mutations.ts` (League precedent)
- `src/lib/reports/event-report-mutations.ts` (Event's existing, narrower domain module —
  Run->Learn seeding only, added by ADR-0088)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-24

Identified while resolving ARR-0028 (Architecture Integrity Programme AIP-3). Deferred — recorded
rather than fixed, since it requires its own Event-report state-machine investigation.
