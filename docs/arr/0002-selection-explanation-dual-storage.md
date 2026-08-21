# ARR-0002: Selection explanation has two storage locations

## State

Partially resolved

## Identified

2026-07-29

## Residue

Selection explanation is stored in two places:
1. `Selection.explanation` — JSON field on the Selection model (convenience cache)
2. `SelectionExplanation` table — relational table with individual explanation rows

Both are written by the generation engine and can diverge. Some read paths use the JSON field, others use the table.

## Intended architecture

One authoritative representation for selection explanations. Per the source-of-truth register, `SelectionExplanation` table is the intended canonical source with `Selection.explanation` as a convenience cache that must not be independently written.

## Evidence

- `prisma/schema.prisma`: Selection model has `explanation Json?` field
- `prisma/schema.prisma`: SelectionExplanation model with selectionId, category, role, reason, etc.
- Generation engine writes to both
- Round board display may read from either source

## Impact

- Content divergence between JSON field and table rows
- Read paths may show inconsistent explanations
- Makes explanation querying and filtering unreliable

## Containment

- Do not add new read paths to `Selection.explanation` JSON field for provenance flags (manuallyAdded, manuallyRemoved, autoSelected, sourceTeamName, targetTeamName, selectionReason)
- All provenance flag reads must use the new `Selection` columns instead of parsing JSON
- `SelectionExplanation` table is the canonical source for structured explanation data (rulesApplied, blockers, warnings, recommendations, crossTeamImpacts)
- `Selection.explanation` is a compatibility cache populated during selection creation; it may be read for display but must not be the source of truth for operational flags
- New explanation display code must read from `SelectionExplanation` table or the provenance columns

## Resolution criteria

- [x] Provenance columns added to `Selection` model: manuallyAdded, manuallyRemoved, autoSelected, sourceTeamName, targetTeamName, selectionReason
- [x] Regeneration logic reads `manuallyRemoved` column instead of JSON parsing
- [x] Round board page reads `manuallyRemoved` column instead of JSON parsing
- [ ] All read paths for provenance flags migrated to columns
- [ ] `Selection.explanation` marked as compatibility field in source-of-truth register
- [ ] Reconciliation check confirms no divergence between columns and JSON

## Resolution progress

### 2026-08-02

- Added `manuallyAdded`, `manuallyRemoved`, `autoSelected`, `sourceTeamName`, `targetTeamName`, `selectionReason` columns to `Selection` model
- Updated `save-generated-draft.ts` to write provenance columns alongside explanation JSON
- Updated `manual-draft-edit.ts` to write provenance columns
- Updated `move-planned-selection.ts` to write provenance columns
- Updated `refresh-draft-selection.ts` to read/write provenance columns during cloning, use column instead of JSON parsing for `hasManualDraftChanges`
- Updated `generate-selection.ts` to read `manuallyRemoved` column instead of parsing JSON
- Updated round board page to read `manuallyRemoved` column instead of parsing JSON
- Migration backfills provenance columns from existing JSON data

## Resolution criteria

- All explanation display paths read from `SelectionExplanation` table
- `Selection.explanation` is marked as compatibility field in source-of-truth register
- Reconciliation check confirms no divergence
- ADR updated to designate canonical source

## Disposition

In progress. Provenance columns added to `Selection` model. `SelectionExplanation` table designated canonical for structured explanations. `Selection.explanation` remains as compatibility cache. Full migration of all read paths pending.

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

### 2026-08-20

Re-verified independently (consolidation programme residue reconciliation pass): the 3 checked
resolution criteria remain true, the 3 unchecked ones remain genuinely open — no drift since
2026-08-02. `State` updated from `Confirmed` to `Partially resolved` to match this file's own
`Disposition` text, which already accurately described the split. No other change.