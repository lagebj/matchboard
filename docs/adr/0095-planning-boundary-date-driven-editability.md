# ADR-0095: Planning Boundary — Date-Driven Editability

## Status

Proposed

## Context

Matchboard currently uses a ceremonial finalization model: coaches explicitly finalize rounds or individual matches to lock selections. The `FINALIZED` status on selections and movement ledger entries prevents further editing. Un-finalization is available but requires explicit action.

The Evidence-Driven Coaching Loop programme specifies that normal planning should be editable until scheduled kickoff (or live start, whichever is earlier). Kickoff freezes intent, not truth. After kickoff, the planning boundary closes automatically.

Current state:
- `Selection.status`: DRAFT ↔ FINALIZED. Finalization is an explicit coach action.
- `MatchRound.status`: NOT_GENERATED / DRAFT / BLOCKED / READY / FINALIZED. Finalization is explicit.
- Per-match finalization allows individual match locking within a round.
- Un-finalization is available but requires explicit action.

## Decision

1. **The existing finalization model is retained as the current mechanism.** This ADR does not remove DRAFT/FINALIZED or the finalize/unfinalize actions. The ceremonial model works and is well-understood by coaches.

2. **A date-driven planning boundary is introduced as a future enhancement.** When implemented, the planning boundary will be: `planningEditable = now < scheduledKickoff AND liveStartedAt is null`. This will automatically close planning at kickoff without requiring explicit coach action.

3. **Finalization and the planning boundary coexist.** Finalization remains available for coaches who want to lock selections early (equivalent to "pinning" a plan). The planning boundary provides an automatic floor — selections cannot be edited after kickoff even if not explicitly finalized.

4. **Per-match finalization is the primary mechanism.** The round is a container. Individual matches can be finalized independently. When all matches in a round are finalized, the round status transitions automatically. This aligns with the programme's "round is a container" principle.

5. **The user-facing vocabulary shifts toward football actions.** In the UI:
   - "Finalize" becomes "Confirm squad" or "Lock selections" (explicit coach constraint)
   - "Un-finalize" becomes "Reopen for editing" (explicit coach action)
   - Round status labels use: "Not generated", "Draft", "Blocked", "Ready", "Finalized"
   - Post-match status uses: "Incomplete", "Done" (not "REPORTED", "LOCKED")

6. **`Pin` is introduced as the concept for explicit coach constraints.** A pinned selection is coach-confirmed regardless of the planning boundary. Pin is separate from finalize — pin is a constraint, finalize is a status.

## Consequences

- No immediate schema change. The DRAFT/FINALIZED model continues to work.
- Future implementation will add a `plannedAt` / `planningClosedAt` timestamp on `Match` to track when planning became non-editable.
- Future implementation will add server-side enforcement of the planning boundary in selection edit actions.
- The `FINALIZED` status remains as a "coach confirmed" semantic, not just "planning closed."
- The `Pin` concept will be introduced as a separate mechanism for explicit coach constraints.

## Migration

- Phase 1 of the programme will add the planning boundary concept and server-side checks.
- Phase 6 will consolidate the lifecycle vocabulary and remove vestigial states (REPORTED).
- No breaking changes to existing finalization behavior until Phase 6.

## Superseded (2026-08-30)

Decision item 1 ("the existing finalization model is retained as the current mechanism") is
superseded by ADR-0109, which wires the date-driven boundary this ADR introduced into an
automatic, lazy, idempotent baseline capture and removes the coach-operated finalize/un-finalize
actions entirely. The planning-boundary concept and `planningClosedAt` field introduced here are
retained and extended, not replaced.