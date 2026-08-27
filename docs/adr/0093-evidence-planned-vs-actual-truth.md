# ADR-0093: Evidence-Driven Coaching Loop — Planned vs Actual Truth

## Status

Proposed

## Context

Matchboard currently conflates finalized planned selections with historical truth. The `FINALIZED` status on selections is treated as immutable history, but it represents coaching intent, not what actually happened on-pitch.

The Evidence-Driven Coaching Loop programme (`.matchboard-work/evidence-driven-coaching-loop/`) establishes that planned data and actual data are separate truths. Only actual data becomes match evidence.

Current state:
- `Selection.status`: DRAFT ↔ FINALIZED. Finalized selections are treated as history.
- `PostMatchReport.status`: NOT_STARTED → DRAFT → REPORTED → LOCKED. LOCKED is the factual freeze boundary.
- `MovementLedger.isDraft`: Mirrors Selection status.
- Planned rotations have DRAFT → APPLIED → SUPERSEDED lifecycle.
- Post-match reports seed from finalized squads but are freely correctable until LOCKED.

## Decision

1. **Planned selections remain the authoritative record of coaching intent.** Finalized selections are preserved as the coach's plan at the time of finalization. They are not overwritten by actual participation data.

2. **Actual participation (`PostMatchPlayerActual`) is the authoritative record of what happened.** Actual data is separate from planned data. A player can have actual participation without being in the planned squad, and planned players may not actually play.

3. **The factual freeze boundary is report completion (LOCKED status), not selection finalization.** Kickoff freezes intent (planned selections become immutable), but actual truth remains editable until the coach explicitly completes the report.

4. **Evidence is derived from actual data only.** Combination evidence, position exposure, participation counts, and sporting assessments must use `PostMatchPlayerActual` with `attendanceStatus: PRESENT`, `Goal` events, and `Assist` events — not from finalized selections.

5. **Planned data is preserved as historical intent.** When a round is finalized, a snapshot of the plan (selections, movement ledger, plan integrity signals, coaching intent, matchday responsibilities) is preserved. This is not overwritten by later actual data.

## Consequences

- The existing `FINALIZED` selection status remains as planned intent history.
- The existing `LOCKED` report status remains as the factual freeze boundary.
- No new status is introduced for selections.
- Actual participation sources (LIVE_RECORDED, PLANNED, EMERGENCY_BACKFILL, ADDED_POST_MATCH) already exist and will be extended with POST_MATCH_CONFIRMED and POST_MATCH_CORRECTED.
- Combination evidence must use actual position data from lineups and live events, not planned position assignments.

## Migration

No schema change. This ADR clarifies the existing semantics and establishes the principle that evidence derives from actual data, not planned data.