# ARR-0003: Warning table rows conflict with live plan integrity computation

## State

Confirmed

## Identified

2026-07-29

## Residue

Plan integrity signals are derived in two ways:
1. `computeRoundPlanIntegrity()` — live computed function that recalculates from current draft state
2. `Warning` table rows — persisted projections written by the generation engine

Stale Warning rows may not match the canonical live computation. The application must not make stale Warning rows authoritative again, but some read paths may still read from the Warning table instead of using the live computation.

## Intended architecture

Per the source-of-truth register, current plan integrity is derived live from `computeRoundPlanIntegrity()`. Warning table rows are derived projections that may be rebuilt but never independently written. `Warning.resolved` is vestigial.

## Evidence

- `src/lib/selection/compute-plan-integrity.ts` — canonical live computation
- `src/lib/selection/persist-warnings.ts` — persists Warning rows after generation
- `src/lib/data-integrity/reconcile-canonical-derived-data.ts` — reconciliation exists
- AGENTS.md: "Do not make stale Warning or AssistantIssue rows authoritative again"

## Impact

- Stale Warning rows could be displayed as current plan integrity
- Assistant work items could reference outdated conditions
- Finalisation could check stale Warning rows instead of live computation

## Containment

- All plan integrity display must use `computeRoundPlanIntegrity()` output
- Warning rows must not be treated as authoritative for finalisation decisions
- `Warning.resolved` boolean must not be used to suppress live computation results
- New code must not add Warning table read paths for plan integrity

## Resolution criteria

- All plan integrity display paths use live computation
- Warning rows are only written as derived projections during generation
- Reconciliation confirms Warning rows match live computation
- `Warning.resolved` field is removed or documented as deprecated
- ADR updated

## Disposition

In progress. Canonical live computation (`computeRoundPlanIntegrity()`) is used by Assistant, Fixtures, Players overview, and reconciliation. Finalization still reads `Warning.resolved` from the database — needs migration to live computation. Warning table rows remain as persisted projections but must not be authoritative for finalization decisions.

## History

### 2026-08-02

- Verified that Assistant, Fixtures, Players overview, and reconciliation all use `computeRoundPlanIntegrity()` for live computation
- Identified that finalization (`finalize-match-round.ts`, `finalize-single-match.ts`) and refresh (`refresh-draft-selection.ts`) still read `Warning.resolved` from the database
- `Warning.resolved` vestigial field needs to be replaced with live computation during finalization
- Warning persistence (`persist-warnings.ts`) remains as derived projection for audit/debugging

## Related decisions

ADR-0029 (source-of-truth inventory and deprecation map)

## Related implementation

Source-of-truth register audit candidate entry

## Supersedes

None

## Superseded by

None

## History

### 2026-07-29

Record created from IMPROVE-0A source-of-truth assessment.