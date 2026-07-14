# 0014 — Per-Match Finalization and Unfinalization

Date: 2026-07-14

## Status

Accepted

## Context

Matchboard originally supported only round-level finalization: all selections in a round were locked together. Coaches requested the ability to finalize individual matches within a round, since matches on different dates may have different deadlines.

Similarly, unfinalization was only at the round level. Coaches needed to un-finalize individual matches (e.g., when a match was postponed but other matches in the round remained finalized).

## Decision

Support finalization and unfinalization at two levels:

1. **Per-match**: Finalize or un-finalize individual matches within a round. Only the target match's selections change status. Other matches in the round remain in their current status.

2. **Round-level**: Finalize or un-finalize all remaining DRAFT selections in the round atomically. This remains the existing behavior.

Per-match finalization rules:
- Locks all DRAFT selections for the target match as FINALIZED
- Checks Blocked and Decision required conditions scoped to the target match only (not the entire round)
- Both require override reason, neither absolutely prevents finalization
- When all matches in a round are finalized (no remaining DRAFT selections), the round's status transitions automatically to FINALIZED
- A match in a FINALIZED round cannot be finalized again

Per-match unfinalization rules:
- Reverts Selection.status from FINALIZED to DRAFT
- Clears ruleConfigVersion and overrideReason on affected selections
- Reverts MovementLedger.isDraft from false to true
- Re-derives round status from plan integrity signals (DRAFT/BLOCKED/READY)
- When un-finalizing a single match in a FINALIZED round, if other finalized selections remain, the round stays FINALIZED
- Only FINALIZED matches can be un-finalized
- Un-finalize requires confirmation (not silent)

## Consequences

- Coaches can finalize matches on different dates independently
- Per-match unfinalization preserves other finalized matches in the round
- Round status is always derived, never manually set
- Per-match finalization uses the same rule-config version stamping as round-level finalization
- UI provides both per-match and round-level finalization controls