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
3. **Add real navigation to the correct canonical context** — a small, genuinely shipped (not fixture-only) addition: `PlayerAssignmentInspector`/`PlayerAssignmentSheet` gained an optional `lineupHref` prop; `round-board.tsx` computes it as `/o/{orgSlug}/matches/{matchId}` for the selected player's *current* match (only once an assignment exists — there is nothing to link to before that; the canonical organisation-scoped route, fixed in a later remediation pass, W2-F01 — see `CHANGED_FILES.md`), and renders "Open Lineup →". This is exactly the brief's own escape hatch: *"If exact slot information is not available in Round Board, preserve the existing match-assignment responsibility and provide the correct canonical context or navigation."* The link label deliberately does not claim an exact position: Round Board has no way to know whether the destination's own formation editor already has this player placed in a slot — "Open Lineup" promises only navigation, never data that may not exist.
4. **Build the rest of C06 fully on what Round Board actually has**: a genuinely dense player×match matrix (54 players, 4 matches, two real cross-team movers via active rotation paths), the mobile assignment sheet with a truthful committed result, and — new for this wave — a truthful **denied** result (`buildC06WithDeniedAssignmentFixture`), so the candidate demonstrates the matrix is real and constrained, not that it merely looks dense.

## C06 as two separate acceptance concerns (W2-F02, required by a fourth independent review)

A fourth independent review found that navigating to the Lineup editor, by itself, does not demonstrate the original acceptance question — it provides correct context, but it is not proof that Round Board (or this candidate) satisfies "24-slot precision vs. 14 general roles." C06 is therefore split into two independently-dispositioned concerns, neither of which is silently folded into the other:

### C06-A: Dense Round Board allocation

**Demonstrable, and demonstrated, inside Round Board as it exists today.** The 54-player, 4-match fixture; cross-team assignments via real rotation paths; the real allocation matrix; desktop player inspection; the mobile assignment sheet; a successful assignment; a rejected assignment; correct per-match planning boundaries (closed matches never offer a cell toggle). This portion's disposition is **PROPOSED_REFINEMENT (implemented)** and may be accepted on its own merits — see `VISUAL_VS_CURRENT.md` for the full evidence mapping.

### C06-B: Exact tactical-position precision

**Not demonstrated inside Round Board, and still not demonstrated by this wave's navigation addition.** The Lineup link is correct, honest navigation — it does not, and cannot, prove that the 24-slot-vs-14-role question is answered *inside Round Board*, because Round Board genuinely has no data to answer it with. This portion's disposition remains **BLOCKED_BY_SOURCE_OR_AUTHORITY**, unchanged by the navigation fix.

### Required decision record (owner action, not implemented by this PR)

**Option A — accept a narrower C06 contract.** Round Board's own responsibility is player-to-match assignment; exact tactical positioning is explicitly the Lineup/Formation editor's domain, reached via the navigation link above. Under this option, C06's acceptance would cover dense allocation (C06-A), truthful role display, and correct navigation to the canonical Lineup — and the original cross-surface positional-precision question would be verified separately, in the feature that actually owns that data (the Lineup/Formation editor itself), not inside Gate C W2.

**Option B — preserve the original requirement unchanged.** C06-B remains blocked exactly as disclosed, and is deferred to a later programme that can exercise both the Lineup/Formation editor and the 24→12 `projectToBaseRole` general-position projection together, in the surface that actually owns both.

**This PR does not choose between Option A and Option B.** That is an acceptance-contract decision for the repository owner, not something a coding agent is authorized to decide on the owner's behalf. Recorded here as a technical recommendation only: Option A is the more coherent long-term contract, since C06-B's data genuinely does not exist in Round Board and manufacturing it here would violate the brief's own prohibition on inventing a new tactical-placement system — but the decision itself, and any resulting change to the official golden-wave register's C06 acceptance text, belongs to the owner.

## Disposition

**C06-A (dense allocation): PROPOSED_REFINEMENT (implemented).** **C06-B (24-slot vs. 14-role precision): BLOCKED_BY_SOURCE_OR_AUTHORITY**, unchanged by this wave's navigation fix — a genuine, documented source gap, not a UI Lab shortcoming, and not resolved merely because a correct link now exists. These two dispositions are reported separately and must not be collapsed into one blanket "C06: READY" status.
