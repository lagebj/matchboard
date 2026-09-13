# Pitch Rendering Inventory — Atlas Follow-up Phase F0

Audit performed against `main` prior to any Atlas Follow-up implementation work. Scope and
required target state: `.matchboard-work/matchboard_atlas_followup_roundboard_players_pitch_positions_2026-09-12/06_CANONICAL_PITCH_RENDERING_CONTRACT.md`.

## Phase F7 status: complete

Every `TouchlinePlanningPitch` target this F0 audit identified has been migrated, or confirmed to
have no real surface to migrate (verified by repository-wide search, not assumed), with one
deliberate, documented exception. See the "Production pitch consumers" table below for the
per-row detail; summary:

- **Migrated**: Formations builder/editor, match detail Lineup/Tactics tab, Event match lineup
  panel.
- **No real surface exists to migrate**: "read-only formation/lineup previews" (`TacticsBoard`
  mode "formation-preview" is dev-lab-only, never a production route), Round Board pitch
  subviews (no pitch renders anywhere in `round-board.tsx` or the wider Round Board component
  tree).
- **Deliberately skipped**: Event squad lineup board (`event-squad-lineup-board.tsx`) — confirmed
  entirely dead code with zero production callers; see **ARR-0050** for the full finding and the
  pending maintainer decision.
- **Out of Phase F7's scope** (belongs to Phase F8, "Production Players migration," per
  `10_IMPLEMENTATION_SEQUENCE_AND_HUMAN_GATES.md`, already gated by the approved Gates B/C): the
  Player Detail position card (`src/components/ui/position-map.tsx`), a `TouchlinePositionMap`
  target, not `TouchlinePlanningPitch`.

## Headline finding

**Most of the "pitch foundations" (Phase F2) work already exists**, built during the Touchline
Design Atlas programme (ADR-0136) but never carried into production:

- `TacticsBoard` (`src/components/formations/tactics-board.tsx`) already supports
  `orientation: "horizontal" | "vertical"` and `pitchStyle: "flat" | "perspective"`. Vertical
  orientation renders GK-bottom/attack-top (`getBoardPositionPercent()` in
  `src/lib/formations/board-projection.ts` returns `{x: modelX, y: modelY}` unchanged for
  `vertical`, i.e. no left-to-right remap — only `horizontal` remaps via
  `attackingDirection`). `pitchStyle="perspective"` already applies a
  `perspective(1100px) rotateX(9deg)` tilt to the whole flat plane as one rigid transform, which
  by construction does **not** distort hit-testing/drag coordinates/text (the transform moves the
  container, not individual token math) — this already satisfies contract §3/§4's "do not rotate
  the DOM if it distorts hit targets" requirement.
- `PitchFormationBuilder`/`PitchLineupView` (`src/components/formations/pitch-formation.tsx`)
  **default** to `orientation="vertical"` already (`orientation = "vertical"` in both
  components' prop destructuring) — evidence this default was set in anticipation of a future
  migration that never happened.
- `PitchPlayerToken`/`PitchEmptySlot` (`src/components/touchline/pitch/pitch-player-token.tsx`)
  is already the shirt-shaped token family (`lucide-react`'s `Shirt` icon), already shows a shirt
  number or initials, already distinguishes goalkeeper vs outfield. Its own doc comment
  explicitly anticipates this bundle: *"No team-kit colour is inferred unless a canonical stored
  field already exists"*.
- `/dev/ui-lab/atlas/routes/{lineup,tactics,formations}` already exercise
  `orientation="vertical"` + `pitchStyle="perspective"` and were the proving ground for exactly
  this visual target (per AGENTS.md's ADR-0136 account: *"Phase 4 ('High-identity routes')... is
  now in progress... Do not begin Phase 5 (Round Board, Lineup, Tactics, Rotations, Live
  Reporting, Follow Live, Post-match) without a fresh, explicit human approval at Human Gate
  B."*). **This Atlas Follow-up bundle's Phase F2/Gate A/Phase F7 is, functionally, that
  deferred ADR-0136 Phase 5 migration**, now extended with the two-renderer naming contract,
  shirt identity, and the evolving position model.

**What is genuinely missing**, confirmed by search — none of these exist anywhere in the
repository today:

- `TeamKitMark` component.
- `Team.kitColor` (or any equivalent) field.
- A normalized `{lateral, longitudinal}` → screen-point projection contract as its own named
  module (today the equivalent logic lives inline in `board-projection.ts`'s
  `getBoardPositionPercent()`, keyed by grid cell rather than a continuous 0..1 coordinate).
- `TouchlinePositionMap` as a distinct, contract-compliant component. The closest existing thing
  (`PositionMap` in `src/components/ui/position-map.tsx`) is horizontal, single-hue, has no
  confidence channel, and is driven directly by the two raw scalar fields
  (`primaryPosition`/`secondaryPositions`) rather than an effective-position-profile with
  support bands — see the companion `current-position-model-audit.md`.

## Production pitch consumers (as found on `main`)

| Route / Component | Current renderer | Coordinate owner | Orientation passed | pitchStyle | Interaction | Target renderer | Migration status |
|---|---|---|---|---|---|---|---|
| Formations builder/editor (`/rules` → `formations-builder.tsx`, `FormationsBuilderClient`) | ~~`TacticsBoard` mode `formation-builder`/`formation-preview` via `PitchFormationBuilder`~~ now `TouchlinePlanningPitch` | ~~`board-projection.ts` grid cell → `%`~~ now shared `buildPlanningPitchSlotsFromFormationSlots()` | n/a (canonical renderer owns orientation) | n/a (canonical renderer owns perspective) | click existing slot to edit (`onSlotClick`); click any other grid cell to add (new `editableGrid` capability, additive to `TouchlinePlanningPitch`) | `TouchlinePlanningPitch` | **Done** (Phase F7) — `editableGrid` is a new, additive capability on the canonical renderer (every other caller omits it); `handleAddSlot`/`handleEditSlot`/`handleRemoveSlot` mutation logic unchanged |
| Match detail → Tactics tab (`match-tactics-panel.tsx`, `MatchTacticsPanel`) | ~~`TacticsBoard` mode `lineup-assignment`/`lineup-readonly` via `PitchLineupView`~~ now `TouchlinePlanningPitch` | ~~same~~ now the shared `buildPlanningPitchSlotsFromFormationSlots()`/`buildPlanningPitchAssignments()` (`@/components/touchline`) | n/a (canonical renderer owns orientation) | n/a (canonical renderer owns perspective) | click-to-assign via `PlayerPicker` dialog, positional-fit inspector — unchanged | `TouchlinePlanningPitch` | **Done** (Phase F7) — `handleSlotClick`/`handleSlotView`/picker/suggestion mutation logic unchanged; team kit colour resolved via the existing `fetchTeamConfiguration()` action (Phase F1) |
| Event match lineup panel (`event-match-lineup-panel.tsx`, `EventMatchLineupPanel`) | ~~`TacticsBoard` mode `lineup-assignment` via `PitchLineupView`~~ now `TouchlinePlanningPitch` | ~~same~~ now the same shared projection helpers the Tactics tab uses — `teamKitColor` always `null` (Event squads have no kit-colour concept) | n/a (canonical renderer owns orientation) | n/a (canonical renderer owns perspective) | click-to-assign via `PlayerPicker` dialog — unchanged; auto-fill unchanged (a separate server action, not a pitch-rendering concern) | `TouchlinePlanningPitch` | **Done** (Phase F7) — `handleSlotClick`/picker/auto-fill mutation logic unchanged |
| Event squad lineup board (`event-squad-lineup-board.tsx`, `EventSquadLineupBoard`) | `TacticsBoard` mode `selection-preview` (read-only) | same | prop defaults to `"horizontal"`; passed through from caller — no caller found overriding it | flat (default) | — | `TouchlinePlanningPitch` | **Skipped — see ARR-0050.** Confirmed entirely unreachable (zero production callers of either this component or its sole domain dependency, `event-lineup-assignment.ts`) — superseded the day after introduction (2026-07-09, `#86`) by the now-canonical `EventMatchLineupPanel`, never removed. Migrating a component nothing renders would be wasted, unverifiable effort; a maintainer decision (delete vs. genuinely revive) is recorded in the ARR instead. |
| Player Detail / Player profile position card (`player-position-profile.tsx` → `PositionMap` → `TacticsBoard` mode `position-profile`) | `TacticsBoard` mode `position-profile` | `POSITION_GRID` (`position-map.tsx`) → `board-projection.ts` | **explicit `"horizontal"`** | flat (only mode this component supports) | none (display + separate inline-edit selects below) | `TouchlinePositionMap` | Not started — also needs full rebuild onto the effective-position-profile, not the raw two scalar fields it reads today |
| I-004 Position exposure widget (`src/components/touchline/widgets/position-exposure-widget.tsx` → `PitchExposure`, `src/components/touchline/viz/pitch-exposure.tsx`) | Bespoke mini-map reusing `PitchMarkings` + `POSITION_GRID`/`getBoardPositionPercent` directly (not `TacticsBoard` itself) | same grid lookup as above | **explicit `"horizontal"`** | n/a (own markup, no perspective) | none (hover/title only) | `TouchlinePositionMap` (or superseded by it — this widget's "recorded exposure share" data is a legitimate input into the new map's dot sizing/hue, see position-model audit) | Not started |
| `/dev/ui-lab/atlas/routes/lineup`, `/routes/tactics`, `/routes/formations` | `TacticsBoard` (various modes) via `PitchFormationBuilder`/`PitchLineupView`, fixture data | same | **explicit `"vertical"`** | **`"perspective"`** | fixture-driven, no live mutation | Already close to `TouchlinePlanningPitch` target — the reference implementation this bundle should generalize, not replace | Prior art, not yet promoted to a named canonical component |
| Round Board (`src/components/round/round-board.tsx`) | none — no pitch rendering anywhere in this file | n/a | n/a | n/a | n/a | Contract allows an optional "Round Board pitch subviews if any" target — **none exist today**, so nothing to migrate here | N/A |
| Rotation path card (`rotation-path-card.tsx`), Season client, `match-view-model.ts` | Grep hits on "TacticsBoard"/"PitchPlayerToken" were doc-comment text only, not actual pitch rendering | — | — | — | — | — | Not a pitch consumer; no action |

## Coordinate model detail

`src/lib/formations/board-projection.ts`:

```ts
export function getBoardPositionPercent(gridX, gridY, options): BoardPosition {
  const modelX = GRID_X_PERCENT[gridX] ?? 50;
  const modelY = GRID_Y_PERCENT[gridY] ?? 50;
  if (orientation === "vertical") return { x: modelX, y: modelY }; // GK-bottom/attack-top, no mirroring
  // horizontal: rotates the vertical model 90° and applies attackingDirection
  if (attackingDirection === "left-to-right") return { x: 100 - modelY, y: modelX };
  return { x: modelY, y: 100 - modelX };
}
```

`GRID_X_PERCENT`/`GRID_Y_PERCENT` (`src/lib/formations/types.ts`) are lookup tables keyed by the
existing 5×6 formation grid (`gridX: 0..4`, `gridY: 0..5`), **not** a continuous `0..1`
`{lateral, longitudinal}` pair. This is discrete-cell-based, not a general projection function.

**Decision for Phase F2**: do not replace this grid entirely (it is canonical formation-slot
storage, per `FormationSlot.gridX`/`gridY` in `prisma/schema.prisma`, and `ADR-0129`'s exact
positional semantics depend on it). Instead, add a thin `projectPlanningPitchPoint()` adapter
(contract §4) that (a) for slot-grid-based callers, converts `{gridX, gridY}` → normalized
`{lateral, longitudinal}` via the existing `GRID_X_PERCENT`/`GRID_Y_PERCENT` tables, then (b)
applies the perspective trapezoid scale (contract §5) on top of the existing vertical
`getBoardPositionPercent()` output. This is additive — it does not require rewriting
`FormationSlot` storage or `board-projection.ts`'s existing horizontal remap (kept for any
caller not yet migrated, and because `attackingDirection="right-to-left"` may still matter for a
literal home/away swap elsewhere — none found in this audit, but not proven absent).

## Non-pitch decorative/other

No stadium/photographic backgrounds, no additional bespoke inline pitch SVGs beyond the ones
listed above were found. `globals.css`/`touchline.css` pitch tokens (`--tl-pitch-*`,
`.tl-pitch-surface`) are already the canonical pitch-material tokens (ADR-0135 "Pitch owns its
own token system") and should be reused unchanged, only extended with the trapezoid/perspective
and green-dot-family tokens this bundle needs.

## Migration order recommendation (feeds Phase F7)

1. `pitch-formation.tsx` (`PitchFormationBuilder`/`PitchLineupView`) — flip its *callers*
   (`formations-builder.tsx`, `match-tactics-panel.tsx`, `event-match-lineup-panel.tsx`) to stop
   overriding the already-correct `"vertical"` default, and add `pitchStyle="perspective"`.
   **Correction (Phase F7 implementation)**: this "flip a flag on the existing `TacticsBoard`"
   plan was superseded once F2 actually built `TouchlinePlanningPitch` as a genuine standalone
   component (not a `TacticsBoard` prop mode) — F7 replaces the renderer entirely rather than
   reconfiguring the old one. `match-tactics-panel.tsx` and `formations-builder.tsx` are done on
   this basis; `formations-builder.tsx` additionally needed a new, additive `editableGrid`
   capability on `TouchlinePlanningPitch` itself, since its "click any empty grid cell to add a
   new slot" interaction has no equivalent in the Lineup/Tactics click-an-existing-slot model —
   see the table above and `touchline-planning-pitch.tsx`'s own doc comment.
2. `event-squad-lineup-board.tsx` — same treatment (flip its own default from `"horizontal"` to
   `"vertical"` once its caller(s) are confirmed to still pass nothing explicit).
3. Player Detail position card — full replacement, not a flip: retire `PositionMap`/`PositionMap`'s
   two-scalar-field reading in favor of `TouchlinePositionMap` fed by
   `EffectivePlayerPositionProfile` (Phase F3 dependency).
4. `PitchExposure` widget — superseded by `TouchlinePositionMap` on Player Detail; evaluate
   whether it has any other caller worth keeping once Player Detail migrates (audit found none
   beyond `position-exposure-widget.tsx`).

## Gate check (per `00_AUTHORITY_AND_EXECUTION_CONTRACT.md` §5)

No stop condition triggered for pitch rendering: no conflicting invariant found, no schema change
required for the pitch system itself (only for `Team.kitColor`, tracked separately), and the
existing `orientation`/`pitchStyle` props already prove the visual requirement is achievable
without breaking hit-testing (the perspective transform already ships, exercised today in
`/dev/ui-lab/atlas/`, with no reported hit-testing defect). Proceed to Phase F1/F2.
