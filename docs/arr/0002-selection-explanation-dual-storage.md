# ARR-0002: Selection explanation has two storage locations

## State

Confirmed

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

- Do not add new read paths to `Selection.explanation` JSON field for explanation display
- All new explanation display code must read from `SelectionExplanation` table
- `Selection.explanation` must not be independently written — it is a cache populated from the table

## Resolution criteria

- All explanation display paths read from `SelectionExplanation` table
- `Selection.explanation` is marked as compatibility field in source-of-truth register
- Reconciliation check confirms no divergence
- ADR updated to designate canonical source

## Disposition

Pending. Source-of-truth register designates `SelectionExplanation` table as canonical. `Selection.explanation` to be made read-only in IMPROVE-0C.

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