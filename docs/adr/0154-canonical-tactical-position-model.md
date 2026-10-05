# ADR-0154: Canonical 24-Code Tactical Position Model and 5×6 Grid

## Status

Accepted (programme — delivered incrementally, following ADR-0146/ADR-0152's precedent; see
"Delivery" below)

## Context

A product-owner-authored specification
(`.matchboard-work/canonical-tactical-position-addendum-2026-10-05/ADDENDUM.md`, gitignored
working document — decisions normatively sourced from there, not linked further since the
directory is not part of the durable repository, matching ADR-0152's own sourcing precedent)
establishes one canonical tactical-position vocabulary and grid for Matchboard, extending and
partially superseding ADR-0129.

### The problem: five incompatible position vocabularies are live in production

This is confirmed by direct repository inspection, not merely a display inconsistency:

1. `src/domain/positions/roles.ts` — the 12-code `EXACT_ROLES` (`GK/LB/CB/RB/DM/CM/AM/LM/RM/
   LW/RW/ST`), ADR-0129's automatic-planning eligibility authority, backed by a directed
   `position-suitability-matrix.json`.
2. `src/lib/player-development/position-code.ts` — a separate 15-exact + 3-broad normalizer
   (`normalizePlayerPositionCode()`), feeding the effective-position/evidence engine
   (ADR-0139) and `src/lib/touchline/presentation/exact-position-labels.ts`'s labels. Adds
   `WM`/`CF`/`W` on top of ADR-0129's set and uses its own, different alias table (e.g.
   `DEFENSIVE_MIDFIELDER → DM`, where ADR-0129's own alias table separately maps the same
   concept differently for *source*-role normalization).
3. `src/lib/players/player-position-resolver.ts` — a separate 5-code `PositionCode`
   (`GK/CB/CM/W/ST`) plus a lowercase `BroadPosition` union (`'goalkeeper'|'defender'|
   'midfielder'|'forward'|'flexible'`), live in squad-generation eligibility
   (`src/lib/events/event-types.ts`'s `getPlayerBroadPositions`, `event-squad-generation.ts`,
   `src/domain/team-composition/position-suitability.ts`) — never routed through either of the
   above.
4. `FormationSlotRoleType` — a 7-value Postgres enum (`GOALKEEPER/DEFENDER/
   DEFENSIVE_MIDFIELDER/MIDFIELDER/ATTACKING_MIDFIELDER/FORWARD/FREE`) matching none of the
   three above, with inconsistent granularity by line (defenders/forwards have no lateral
   split; midfielders get two).
5. `src/components/touchline/pitch/position-coordinates.ts` — its own `POSITION_GRID`
   code→`(gridX, gridY)` table, a fourth independent mapping for the same concept.

All raw storage (`Player.primaryPosition/secondaryPosition/tertiaryPosition`,
`ActualPositionInterval.position/line/lane`, lineup/rotation position columns) is untyped
`String` — nothing at the schema level constrains which vocabulary a given row uses.

`deriveExactTargetRole(roleType, gridX)` (`src/domain/positions/slot-target.ts`) compresses
five horizontal lanes into only `LEFT/CENTRE/RIGHT` via `laneFromGridX` and ignores `gridY`
entirely for lane purposes — it cannot express `LCB` vs `CB` vs `RCB`, or `LWB` vs `LDM`.

## Decision

### 1. One canonical 24-code tactical-position vocabulary

```
GK
LB   LCB  CB   RCB  RB
LWB  LDM  CDM  RDM  RWB
LM   LCM  CM   RCM  RM
LW   LAM  CAM  RAM  RW
     LCF  CF   RCF
```

Full labels: `GK`=Goalkeeper; `CB`=Centre Back, `LCB`=Left Centre Back, `RCB`=Right Centre
Back, `LB`=Left Back, `RB`=Right Back; `CDM`=Centre Defensive Midfield, `LDM`=Left Defensive
Midfield, `RDM`=Right Defensive Midfield, `LWB`=Left Wing Back, `RWB`=Right Wing Back;
`CM`=Central Midfield, `LCM`=Left Central Midfield, `RCM`=Right Central Midfield, `LM`=Left
Midfield, `RM`=Right Midfield; `CAM`=Central Attacking Midfield, `LAM`=Left Attacking
Midfield, `RAM`=Right Attacking Midfield; `LW`=Left Wing, `RW`=Right Wing; `CF`=Central
Forward, `LCF`=Left Central Forward, `RCF`=Right Central Forward.

`DM`/`AM`/`ST` and every other historical spelling (`CB1`/`CB2`/`ST1`/`ST2`/
`DEFENSIVE_MIDFIELDER`/`GOALKEEPER`/`STRIKER`/…) are legacy input aliases only — never a
second canonical vocabulary, never emitted as new output.

### 2. One normative 5×6 grid, with `LW`/`RW` as explicit two-cell identities

`canonicalPositionForCell(gridX: 0-4, gridY: 0-5): CanonicalTacticalPosition | null` is a
direct lookup table (not inference) over:

| gridY | x0 | x1 | x2 | x3 | x4 |
|---|---|---|---|---|---|
| 0 (attack) | LW | LCF | CF | RCF | RW |
| 1 (att. mid) | LW | LAM | CAM | RAM | RW |
| 2 (mid) | LM | LCM | CM | RCM | RM |
| 3 (def. mid) | LWB | LDM | CDM | RDM | RWB |
| 4 (defence) | LB | LCB | CB | RCB | RB |
| 5 (GK) | null | null | GK | null | null |

`LW` and `RW` are each **one** canonical position with **two** valid formation cells
(`LW`: `x0/y0` and `x0/y1`; `RW`: `x4/y0` and `x4/y1`), not two distinct roles. A
`CanonicalTacticalPosition` carries `primaryDisplayCell` (used for single-point renderings —
`LW→x0/y0`, `RW→x4/y0`) and `validFormationCells[]` (used to validate/derive a slot's
position). No other cell produces a position; `y5` is `null` except `x2`.

### 3. `src/domain/positions/` becomes the single domain owner

Extending the module ADR-0129 already established as the right owner (`roles.ts`,
`aliases.ts`, `labels.ts`, `matrix.ts`, `slot-target.ts`, `suitability.ts`), not creating a
parallel one. It becomes the sole owner of: the 24-code type, full/compact labels, the grid
cell mapping above, valid-cells-per-position, primary display cell, side/lane and depth/line
metadata, legacy-alias normalization, formation-cell→position derivation, and the automatic-
planning compatibility projection (§5). Every other module —
`position-code.ts`, `exact-position-labels.ts`, `position-coordinates.ts`, formation helpers,
live-match code, player-development code, lineup generators — becomes a thin adapter over this
authority; none of them retains its own position list or mapping once migrated.

### 4. Normalization: sided exact codes never collapse

`DM→CDM`, `AM→CAM`, `ST→CF`, `GOALKEEPER→GK`, `STRIKER→CF`, `DEFENSIVE_MIDFIELDER`/"DEFENSIVE
MIDFIELDER"`→CDM`, `ATTACKING_MIDFIELDER`/"ATTACKING MIDFIELDER"`→CAM`, and the existing centre/
center-spelling aliases continue normalizing to their base code. This is a **behavior change**
from ADR-0129's own alias table, which mapped `CDM→DM` and `CAM→AM` (the reverse direction) and
`LCB`/`RCB`→`CB`+source-side — those three mappings are superseded (§7).

`LCB`, `RCB`, `LDM`, `RDM`, `LCM`, `RCM`, `LAM`, `RAM`, `LCF`, `RCF` are first-class canonical
codes and **must never** normalize to their unsided sibling (`LCB↛CB`, `LCM↛CM`, `LAM↛CAM`,
`LCF↛CF`). Unrecognized strings normalize to themselves unchanged (never fabricated, never
fuzzy-matched) — unchanged from ADR-0129's "unknown creates no eligibility" principle.

Broad historical concepts (`DEFENDER`/`MIDFIELDER`/`FORWARD`/`W`/`WM`/`FLEXIBLE`) remain valid
for genuinely broad questions and historical display, but are not canonical tactical positions
and must not be fabricated into exact precision they don't carry (`MIDFIELDER` never becomes
`CM` without evidence).

### 5. Automatic-planning compatibility: a projection, not a bigger matrix

ADR-0129's directed suitability matrix (`position-suitability-matrix.json`) is **not**
regenerated at 24×24. A new compatibility projection maps each of the 24 codes to
`{ baseRole: ExactRole, side: Lane | null }` (`LCB→{CB,LEFT}`, `RWB→{RB,RIGHT}`, `CDM→{DM,
null}`, `LW→{LW,null}`, …) and suitability lookups route through this projection into the
existing matrix. This projection is compatibility machinery only — it never changes the
canonical role stored, displayed, evidenced, or returned by planning (`LCB` is never reported
as `CB` merely because they share a suitability base). Where this exposes ambiguous
transferability policy, the conservative choice (no safe fit, rather than an invented
equivalence) wins, per ADR-0129's own existing precedence rule.

### 6. Formation-slot identity comes from the grid cell, not label-parsing or 3-lane compression

`deriveExactTargetRole` is replaced by a direct `canonicalPositionForCell(gridX, gridY)` call.
`FormationSlotRoleType` remains the broad depth/category descriptor (unchanged enum, unchanged
schema) — it is validated for consistency against the derived exact position, never used to
independently invent one. `FREE` slots continue to derive no automatic exact target.
`suggestSlotDefaults()` and every system formation's slot metadata are corrected to agree with
the grid (e.g. two centre-backs become `LCB`/`RCB`, not `CB1`/`CB2`; wide forwards sit at
`x0`/`x4`, not the old 3-lane-compressed `x1`/`x3`).

### 7. What this supersedes in ADR-0129, and what it preserves

**Superseded:** the 12-code `EXACT_ROLES` vocabulary as the complete exact-position authority;
`deriveExactTargetRole`'s `roleType`+3-lane-`gridX` derivation; the `LCB/RCB→CB`+side and
`CDM→DM`/`CAM→AM` alias directions in `src/domain/positions/aliases.ts`.

**Preserved, unchanged:** exact eligibility as a hard gate before optimization; suitability
before fairness; unsafe automatic assignments stay unresolved (no-safe-fit over invented
eligibility); no fuzzy/substring position matching; deterministic bounded bipartite matching;
manual coach override with the same graduated `NATURAL/STRONG/PLAUSIBLE/DEVELOPMENTAL/
UNSUPPORTED` boundary; broad `BroadPosition`/`StructuralRole`/`OutfieldStructuralRole` helpers
remain valid, unchanged, for their own genuinely-broad questions (ADR-0116, team-composition's
cross-team distribution) — this ADR does not touch them.

### 8. Persistence and migration rule

New writes (player declarations, live reporting, formation authoring) use the 24-code
vocabulary only. Legacy stored values normalize non-destructively at read time — never
rewritten to "look newer." Mutable current declarations (`Player.primaryPosition` etc.) may be
safely migrated for unambiguous aliases (`DM→CDM`, `AM→CAM`, `ST→CF`) at implementation time.
Immutable historical evidence (`ActualPositionInterval`, locked report snapshots) is never
retroactively reinterpreted — a historical `CB` stays `CB` forever unless real recorded
evidence (not inference) establishes which side it was.

## Alternatives considered

- **Keep the 12-code vocabulary and only fix labels/display.** Rejected: the addendum's whole
  purpose is sided precision (`LCB` vs `RCB`, `LDM`/`CDM`/`RDM`) that the 12-code model cannot
  express at all; this would leave the actual dispersion (declaration vs. evidence vs. planning
  vs. squad-generation vs. formation-slot vocabularies) unresolved.
- **Regenerate a full 24×24 suitability matrix.** Rejected per the addendum's own instruction
  (§16): this is a product-owner-normative artifact (ADR-0129), not something to re-derive by
  implementation judgement, and a 24×24 expansion risks silently changing automatic-planning
  safety behavior that is currently regression-locked.
- **Leave the five vocabularies as-is and only add a translation layer at each boundary.**
  Rejected: this reproduces the dispersion with more code (addendum §24's explicit warning) —
  every boundary would need its own translation, with no single source of truth to verify
  against.

## Consequences

### Positive

- One answer to "what are Matchboard's tactical positions" and "what does cell (x,y) mean"
  across declaration, formation geometry, planning, live match state, actual-position evidence,
  reporting, player development, pitch rendering, and AI context.
- Sided evidence (`LCB`/`RCB`, `LCM`/`RCM`, etc.) becomes distinguishable everywhere instead of
  being silently collapsed at various points today.
- Automatic-planning safety (ADR-0129) is preserved by construction — the matrix itself is
  untouched; only the identity feeding it gains a projection step.

### Negative

- Touches a wide surface (automatic planning, formation defaults, system formations, live
  reporting, player declarations, effective-position evidence, pitch rendering, AI context) —
  delivered as a sequenced, ADR-gated series of PRs (see "Delivery"), not one commit.
- `src/domain/positions/aliases.ts`'s alias directions for `CDM`/`CAM`/`LCB`/`RCB` change
  meaning from ADR-0129's original table — any external memory of the old mapping is now stale.
- The effective-position evidence engine (ADR-0139) must be re-verified to ensure it does not
  accidentally aggregate newly-distinguished sided evidence (`LCB`/`LCM`/`LAM`/`LCF`) into its
  unsided sibling, since aggregation is its normal mode of operation.

## Migration

No schema change required for the vocabulary itself (all affected columns are already
`String`/`Json`). Additive only: new domain-module exports, corrected formation-slot/
system-formation metadata (data correction, not a schema change), and an optional one-time,
unambiguous-alias-only migration of mutable `Player` position declarations. No historical
`ActualPositionInterval` row, locked report, or other immutable evidence is rewritten.

## Security and operations

No new authorization surface. All affected code already runs under existing tenant-scoped,
authenticated paths (automatic planning, formation authoring, live reporting). No new external
data flow, secret, or write path.

## Related records

- ADR-0129 (Exact Positional Semantics and Automatic-Planning Safety) — partially superseded;
  see §7 above for the exact boundary.
- ADR-0116 (outfield role suitability and tactical-function evidence) — unaffected; broad-role
  helpers stay as-is.
- ADR-0139 (Evolving Player-Position Model) — a direct consumer; its effective-position engine
  must switch from `normalizePlayerPositionCode()` to this ADR's domain authority and is
  re-verified for sided-evidence-not-aggregated behavior (see "Negative" above).
- ARR-0052 (realised match positions have two/three persisted representations) — a distinct,
  pre-existing, already-filed concern about which *source* a position *value* is read from
  (`ActualPositionInterval` vs. `PostMatchPlayerActual.actualPositions` vs. a third independent
  derivation), not which *vocabulary* that value uses. Not addressed by this ADR; left to the
  development-context-and-evidence programme's own governing ADR.

## Delivery

Delivered incrementally, one branch/PR per slice (sequential-PR policy, matching
ADR-0146/ADR-0152's own precedent):

0. This ADR.
1. Repository-wide audit confirming the concrete file list for steps 2+ (research only).
2. Canonical domain core: 24-code type, grid function, label authority, corrected alias table,
   compatibility projection — with its own full regression suite (grid table, alias
   regressions, `LW`/`RW` two-cell identity) before any consumer is touched.
3. Formation grid derivation and `suggestSlotDefaults()`.
4. System-formations audit and correction.
5. Pitch coordinates and position-map rendering.
6. Actual-position timeline and live reporting production.
7. Player declarations and position-evolution evidence (ADR-0139 re-verification).
8. Reporting, insights, and Assistant Coach sweep.
9. Retire the 12-code path's public surface; final repository-wide verification.

## History

### 2026-10-05

Record created, establishing the canonical 24-code tactical-position vocabulary and 5×6 grid,
and the exact boundary with ADR-0129, ahead of any implementation stage.
