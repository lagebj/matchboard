# ADR-0129: Exact Positional Semantics and Automatic-Planning Safety

## Status

Accepted

## Context

The Matchboard Productification and Decision Safety programme
(`.matchboard-work/matchboard_productification_programme_2026-09-09/`, a temporary gitignored
implementation bundle) has two primary outcomes; the first is: **automatic planning must be
football-safe**.

### The problem

Automatic lineup, rotation, squad-repair and formation-coverage logic currently reason about
player position through **broad role families**:

- `src/lib/formations/lineup-compatibility.ts` (`mapExistingPositionToBroad`) and
  `src/lib/formations/suggest.ts` (`mapExistingPositionToBroadSimple`) collapse
  `CM/DM/AM/LM/RM/W` into a single `"midfielder"` `BroadPosition`, and fuzzy-match unknown
  strings through substring tests (`lower.includes("mid")`).
- `src/domain/team-composition/position-suitability.ts` (`mapPositionCodeToBroad`,
  `getPositionFit`, `buildRoleSuitability`) collapses the same set into one `MIDFIELD`
  `StructuralRole` family, with an "accepts flexible ⇒ floor at TERTIARY" rule that makes
  `NO_FIT` unreachable for outfield roles.
- `src/lib/players/player-position-resolver.ts` (ARR-0040) knows only five position codes
  (`GK/CB/CM/W/ST`) and maps everything else to `"flexible"`.
- `src/lib/planned-rotation/generate-rotation-plan.ts` scores bench candidates with a single
  additive number blending broad role-tier score, fairness under-share, opponent-function
  bonus and position-context bonus — so an exact winger/central distinction can be
  out-weighed, and an `UNSUPPORTED` candidate (score 0) is still selectable to satisfy a
  substitution batch.
- `src/lib/selection/emergency-repair-options.ts` gates eligibility only on rotation
  path / availability / squad size (via `addPlayerToDraftMatch`), never on positional fit,
  and treats `primaryPosition === vacatedPosition` string-equality as a `+15` additive bonus.

A left or right midfielder is not a central midfielder; a winger is not a central midfielder.
Broad `midfielder` equivalence is not safe exact-role eligibility authority. The model must
also express **asymmetric football transferability** — a striker or a same-side full-back is a
more suitable emergency winger than a central midfielder, and the reverse relationship does not
carry the same weight — which a symmetric broad-family model cannot represent.

### Existing owners that this decision does not replace

- `getPositionFit()` / `RoleSuitabilityProfile` (broad `StructuralRole`) remain correct and
  unchanged for **team-composition's own cross-team distribution problem** (ADR-0116 §1): every
  player in a shared pool must land on some team, so a "nobody is truly unplaceable" floor is
  right there.
- `computeOutfieldRoleSuitabilityProfile()` / `OutfieldRoleSuitabilityTier` (ADR-0116, broad
  `OutfieldStructuralRole`, evidence-aware) remain the owner of the descriptive Player-Profile
  role-suitability panel and of the bounded evidence *scoring nudges* in Bundle 7/8. They are
  not exact-role eligibility authority.
- Broad `BroadPosition` mapping stays valid for genuinely broad questions (reporting buckets,
  squad-composition when no exact formation context exists — see §7 below).

## Decision

### 1. One exact-position domain owner

A new domain module family under `src/domain/positions/` is the single owner of exact
positional semantics for automatic planning. It owns, and no exact-planning caller
re-implements:

- the canonical exact target-role set `GK, LB, CB, RB, DM, CM, AM, LM, RM, LW, RW, ST`;
- input-alias normalization of declared player position strings;
- the directed suitability matrix;
- suitability tiers and the automatic-eligibility threshold;
- the `bestSide` modifier;
- formation-slot → exact target-role derivation from `roleType` + grid geometry;
- player → target-role effective suitability (declaration-weighted, side-modified, clamped);
- neutral coach-facing fit labels.

The normative matrix ships verbatim as
`data/position-suitability-matrix.json` (imported into the module as canonical data — not
re-typed, not re-tuned, not symmetrized).

### 2. Directed, asymmetric suitability

Suitability is a **directed** source-role → target-role score in `[0, 100]`, evaluated
independently per declared source role (primary ×1.00, secondary ×0.95, tertiary ×0.90), with
a small `bestSide` modifier (`same +4 / opposite −4 / centre 0`) applied **only** to unsided
source roles (`CB, DM, CM, AM, ST, SS, W`). Effective suitability for a target is the maximum
across the player's declared sources. The matrix is never symmetrized.

Tiers after modifiers: `NATURAL 90–100`, `STRONG 70–<90`, `PLAUSIBLE 50–<70`,
`DEVELOPMENTAL 30–<50`, `UNSUPPORTED 0–<30`. **Automatic eligibility is `NATURAL`, `STRONG`
and `PLAUSIBLE` only.**

Normative consequences (regression-locked): `CM → LW/RW` is `DEVELOPMENTAL` (never an
automatic winger candidate); `ST → LW/RW` and same-side `LB/RB → winger` are `STRONG`;
opposite-side full-back → winger is `PLAUSIBLE` and still outranks `CM`; `LM → LW` and
`RM → RW` are `NATURAL`; a player with a *secondary* exact winger declaration outranks a
player whose winger suitability is only `ST`-derived.

### 3. Unknown strings create no eligibility

Alias normalization is exact (`CDM→DM`, `CAM→AM`, `CF→ST`, `LCB→CB`+source-side `LEFT`,
`RCB→CB`+source-side `RIGHT`, `SS`→special source `SS`, `W`→special unsided winger source
`W`; canonical roles unchanged). Any other string resolves to `UNKNOWN` and produces **no
automatic exact-role eligibility for any target**. Unknown declared strings are never
substring-fuzzy-matched and are never destructively rewritten in storage (§Migration).

### 4. Slot → exact target role from geometry, not labels

Derivation uses `FormationSlotRoleType` + a canonical lane from `gridX`
(`laneFromGridX`: `0–1 LEFT`, `2 CENTRE`, `3–4 RIGHT`), per the bundle's fixed table
(`DEFENDER → LB/CB/RB`, `MIDFIELDER → LM/CM/RM`, `ATTACKING_MIDFIELDER → LW/AM/RW`,
`FORWARD → LW/ST/RW`, `DEFENSIVE_MIDFIELDER → DM`, `GOALKEEPER → GK`). Free-form
`label`/`shortLabel` strings are never parsed. `FREE` slots derive **no** automatic target
role — they are manual-only for automatic assignment. `FormationSlot.acceptedPositionIds`
may remain for compatibility but is no longer exact automatic-eligibility authority.

### 5. Eligibility precedes optimization; candidate ordering is lexicographic

The fixed automatic-planning precedence is:

```
hard domain constraints
  → target slot identity
  → positional eligibility (NATURAL / STRONG / PLAUSIBLE)
  → maximum safe positional coverage
  → fairness
  → coaching intent / tactical function
  → evidence-informed preference
  → deterministic tie-break
```

Automatic candidate ordering is **lexicographic** over `(tier, fairness need, exact suitability
score, tactical/intent fit, evidence-informed preference, stable tie-break)` — never a single
unbounded additive score across position fit + fairness + evidence. A lower tier can never
beat a higher tier because of fairness or evidence. **Fairness, evidence, opponent context,
tactical attributes and strength cannot create eligibility.** Evidence can only rank already
eligible candidates and can never upgrade a tier or infer an undeclared role.

### 6. Unsafe invention is forbidden; no-fit is visible

If no automatically eligible player can fill a required exact role: starting-lineup generation
leaves the slot **unresolved** and reports `No safe automatic fit for <ROLE>`; rotation
generation **skips** the unsafe replacement, keeps the unmatched due player on, and records a
diagnostic (`No safe replacement for <ROLE> at <n> min`); plan integrity shows the gap. Never
`DEVELOPMENTAL`/`UNSUPPORTED` to satisfy a substitution batch size. Repair suggestions use the
same exact target role and the same eligibility threshold.

Automatic lineup and rotation matching is **deterministic bounded bipartite matching** with
ordered objectives (maximize eligible-filled slots → maximize `NATURAL` count → maximize
`STRONG` count → fairness objective → exact suitability → existing tactical/evidence preference
→ deterministic tie-break) — so one versatile player is not greedily consumed for a scarce
winger/full-back slot needed elsewhere, and exact formation coverage is tested with
simultaneous maximum matching, not "some compatible player exists per slot".

### 7. Manual coach override remains, with a graduated boundary

- `NATURAL` / `STRONG` / `PLAUSIBLE`: assign normally.
- `DEVELOPMENTAL`: assign with a small neutral annotation (`Developmental positional fit`), no
  modal.
- `UNSUPPORTED`: assign only after one explicit confirmation
  (`Use outside automatic positional fit?` / `Assign anyway`).

Neutral labels only — `Natural fit`, `Strong fit`, `Plausible fit`,
`Developmental positional fit`, `Outside automatic fit`. Never player-value language.

### 8. Exact formation-context resolution

When exact formation context exists (existing match lineup formation → explicitly selected
match formation → team Best Lineup formation), generated squad coverage uses exact target
roles and maximum matching. The first system formation is never silently chosen. When no
exact formation context exists, broad composition may remain, but the UI must not claim exact
formation coverage, and exact lineup/rotation generation requires a formation to be selected.

## Consequences

- Broad `BroadPosition` / `StructuralRole` / `OutfieldStructuralRole` helpers and their
  team-composition / Player-Profile / evidence-nudge callers are unchanged. This ADR adds an
  exact layer used specifically by automatic lineup / rotation / repair / exact-coverage
  paths; it does not remove the broad layer.
- A player declared only with a broad legacy string (`"Midfielder"`, `"MID"`, `"Forward"`,
  `"NONE"`, …) has **no automatic exact-role eligibility** under the new model until the coach
  updates the player's declared positions to exact codes (or an alias the matrix recognises).
  This is deliberate per the bundle (broad legacy mapping is not exact-planning authority) —
  seed/demo/fixture data that must exercise automatic planning is updated to exact codes.
  Automatic planning that finds no eligible player surfaces a visible no-safe-fit gap rather
  than an unsafe pick.
- Rotation generation output changes: an `UNSUPPORTED`/`DEVELOPMENTAL`-only bench option is no
  longer selected to complete a batch; that due player stays on and a diagnostic is recorded.
- Emergency repair output changes: positional eligibility becomes a gate (same threshold),
  ranked `NATURAL > STRONG > PLAUSIBLE` before secondary consequences.
- `ARR-0040` (duplicated declared-position fit in `player-position-resolver.ts`) is not
  resolved by this ADR; the exact owner is a new, distinct concern. That consolidation remains
  tracked separately.
- The matrix weights are a product-owner-supplied normative artifact, not a tuned model. They
  are inspectable (`data/position-suitability-matrix.json`) and changed only by a
  specification change, never by implementation judgement.

## Migration

- Declared player position strings normalize **at read time**. No destructive rewrite of
  `Player.primaryPosition`/`secondaryPosition`/`tertiaryPosition` or of historical
  `*PositionSnapshot` / actual-position strings.
- Historical actual positions are not re-interpreted retroactively just because today's model
  reads a string differently.
- No schema change. `FormationSlotRoleType` (incl. `FREE`), `BestSide` (`LEFT/CENTER/RIGHT`)
  and `FormationSlot` geometry fields are already sufficient.

## Supersedes

None. Adds an exact-role authority alongside the existing broad-role helpers (ADR-0116 and
earlier) for the specific question of automatic-planning positional eligibility and safe
matching. Where prior UI/UX guidance described "broad automatic position" behaviour as
correct, that guidance is superseded for automatic lineup/rotation/repair/exact-coverage
paths.
