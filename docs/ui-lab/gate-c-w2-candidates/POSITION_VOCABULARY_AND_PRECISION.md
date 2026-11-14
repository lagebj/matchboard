# Gate C W2 — Position Vocabulary and Precision Mapping (C06)

## The two real vocabularies

- **24-code `CANONICAL_TACTICAL_POSITIONS`** (ADR-0154, `src/domain/positions/roles.ts`): `GK, LB, LCB, CB, RCB, RB, LWB, LDM, CDM, RDM, RWB, LM, LCM, CM, RCM, RM, LW, LAM, CAM, RAM, RW, LCF, CF, RCF`. Exact formation-slot identity — sided codes (`LCB`, `LCM`, ...) never collapse to their unsided sibling.
- **14-code `SOURCE_ROLES`** (`src/domain/positions/roles.ts`): the 12-code `EXACT_ROLES` (`GK, LB, CB, RB, DM, CM, AM, LM, RM, LW, RW, ST` — ADR-0129's automatic-planning vocabulary) plus `"SS"` and `"W"`. This is the register's "14 general roles."
- `projectToBaseRole` (`src/domain/positions/compatibility-projection.ts`) is the real, already-shipped ADR-0154 projection from the 24-code vocabulary onto `{baseRole: ExactRole, side: Lane | null}` — i.e. 24 → 12, not 24 → 14, and not 24 → `SOURCE_ROLES` directly.

Both vocabularies are real, correct, and already shipped. **Neither is a Round Board capability.**

## Where each vocabulary is actually owned

| Vocabulary / data | Owning feature | Evidence |
|---|---|---|
| 24-code position **assignment** (a formation slot a player is placed in for a specific match) | The Lineup/Formation editor | `FormationSlot.gridX/gridY` → `canonicalPositionForCell()` (`src/domain/positions/grid.ts`), `MatchLineupAssignment` (`prisma/schema.prisma`), `src/app/(app)/matches/[matchId]/page.tsx`, `src/components/formations/`. |
| 24-code position **evidence** (what a player was observed playing, from live reporting) | Live-match reporting | `ActualPositionInterval.position` (free-string column, written by `rebuildActualTimeline`/`finish-live-reporting.ts`), the position-correction UI in `live-match-client.tsx`. |
| 14-code `SOURCE_ROLES` / 12-code `ExactRole` **suitability** | Automatic-planning eligibility (ADR-0129) | `projectToBaseRole`, the eligibility-tier matrix that underlies suggestion derivation. |
| Round Board's own assignment | Player × match, planning-category role only | `Selection.role: SelectionRole` (CORE/SUPPORT/BACKFILL/DEVELOPMENT/CONFIDENCE_REBUILD/...) — confirmed by reading `prisma/schema.prisma`: **no position field exists on `Selection` at all.** `AllocationMatrixRow.assignments: Record<matchId, boolean>` confirms the matrix itself is a boolean grid, never a formation-slot grid. |
| `Player.primaryPosition` (what Round Board actually displays today) | Free text | `prisma/schema.prisma`: `primaryPosition String`, `secondaryPosition String?`, `tertiaryPosition String?` — unconstrained, not validated against either vocabulary, not even an enum. |

## Why C06 does not fabricate a 24-vs-14 contrast

Doing so would require either (a) inventing a new field on `Selection` to carry an exact position per assignment, which the brief explicitly forbids ("No new database schema... Do not invent a new tactical placement system"), or (b) silently repurposing `Player.primaryPosition`'s free text as if it were validated 24-code data, which would misrepresent what the field actually is. Both are dishonest demonstrations.

## What this wave does instead

1. **Disclose the gap plainly** (this document, plus `CURRENT_STATE_AUDIT.md` item 6) rather than concealing it behind a convincing-looking fixture.
2. **Keep Round Board's existing display unchanged**: the assignment inspector still shows `Player.primaryPosition` exactly as production already did — free text, no fabricated precision.
3. **Add real navigation to the correct canonical context** — a small, genuinely shipped (not fixture-only) addition: `PlayerAssignmentInspector`/`PlayerAssignmentSheet` gained an optional `lineupHref` prop; `round-board.tsx` computes it as `/matches/{matchId}` for the selected player's *current* match (only once an assignment exists — there is nothing to link to before that), and renders "View exact position in Lineup →". This is exactly the brief's own escape hatch: *"If exact slot information is not available in Round Board, preserve the existing match-assignment responsibility and provide the correct canonical context or navigation."*
4. **Build the rest of C06 fully on what Round Board actually has**: a genuinely dense player×match matrix (54 players, 4 matches, two real cross-team movers via active rotation paths), the mobile assignment sheet with a truthful committed result, and — new for this wave — a truthful **denied** result (`buildC06WithDeniedAssignmentFixture`), so the candidate demonstrates the matrix is real and constrained, not that it merely looks dense.

## Disposition

**BLOCKED_BY_SOURCE_OR_AUTHORITY** for the literal "24-slot precision vs. 14 general roles inside Round Board" acceptance question — this is a genuine, documented source gap, not a UI Lab shortcoming. The dense-matrix and mobile-sheet portions of C06's requirements are fully met on real production code and data.
