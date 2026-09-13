# Reference Decomposition — Players Overview

Golden: `04-atlas-planning-and-players.png`, panel 6 "PLAYERS OVERVIEW (DESKTOP)".
Contract: `03_PLAYER_OVERVIEW_CONTRACT.md`.

## Golden-vs-contract conflict (resolved per authority order)

The golden's panel shows tabs **"Overview | Development | Availability | Matchday additions"**
(the current pre-bundle production tab set). The bundle's own contract explicitly and repeatedly
locks a **different, three-mode** set: **"Overview / Current round / Development"**
(`03_PLAYER_OVERVIEW_CONTRACT.md §2`: *"Lock these modes"*). Per
`00_AUTHORITY_AND_EXECUTION_CONTRACT.md`'s authority order (bundle > golden references), the
golden is used here for **density, column composition, and inspector relationship only** — not
for its literal tab label set or count. Do not build a fourth "Availability"/"Matchday additions"
tab to match the image.

## Viewport

Desktop only (1440-ish width) for this specific golden panel. Mobile composition is our own
(no mobile golden for this exact page), following contract §7's own explicit "compact rows, tabs
remain, filters open in a sheet" instruction.

## Content order (desktop)

1. Page header: "Players" title + "Squad overview and season participation" subtitle, season
   selector + Export action top-right (season selector must say "League season", not "Season
   2024/2025" as literally shown — see AGENTS.md's Season/League season vocabulary rule).
2. Tab rail (our three contract-locked modes, not the golden's four).
3. Below-tab toolbar: a density toggle is shown in the golden ("Compact"/"Detailed") — not named
   anywhere in the bundle contract; a reasonable, low-risk affordance to keep IF it's cheap, but
   not required. Deferred unless trivial.
4. Two-region split: **dense table (~9/12 columns)** + **selected-player inspector (~3/12
   columns)** — contract §3 states this exact ratio explicitly.
5. Table row selection highlights the row (golden shows row 4 "Noah" highlighted) and populates
   the inspector.

## Table columns (per contract §3, desktop)

Player identity (shirt + name), core team, current effective primary position, availability,
opportunity this week, season match/participation summary, current attention state. The golden's
literal column set (Played/Goals/Assists/Core/Support/Development/Matchday/Planned absent) maps
onto "season match/participation summary" — use only fields Matchboard's canonical data actually
supports (contract's "keep columns intentionally limited" + `00_...md §4` "no invented data"):
Played (canonical), Goals (canonical, from Goal events per "Canonical data truth"), Assists
(same), Core/Support/Development counts (canonical, from Selection role). "Matchday additions" and
"Planned absent" map onto existing canonical concepts (unplanned/matchday participation, planned
absence) — include only if a real, already-existing query supports them without new aggregation
work; otherwise omit rather than invent placeholder columns.

## Selected-player inspector (right rail)

Golden shows: larger shirt/photo, name + role, three sub-tabs (Overview/Season/Development),
"Season stats" (Played/Goals/Assists numbers), "Role distribution" (a stacked bar — reuse
`RoleDistribution`, already built), "Availability" status, "Planned absences" count, "Notes" free
text. Contract §4 requires: larger shirt identity, name, current effective positions, availability,
opportunity, recent position exposure, current development focus, latest observation, "Open
player" link. Compose from what's canonical; the golden's "Notes" field is real (`Player.notes`,
per AGENTS.md's "Player profile stores coach notes") — keep it. No sub-tabs required by the
contract; a single inspector body is suffient and simpler — matches "must feel like a preview, not
a duplicate full profile" (contract §4).

## Current round mode (contract §5)

Not shown in this specific golden panel — compose from contract's own column list (player, core
team, availability, current assignment, opportunity status, position/coverage context,
attention), reusing the exact same `computeRoundPlanIntegrity()`-derived opportunity definition
Round Board uses (contract's own explicit "do not invent a separate rule" instruction).

## Development mode (contract §6)

Not shown in this specific golden panel either — compose from contract's own column list (player,
active development focus, focus start, latest observation, recent/effective position profile
summary, decision review state). No ranking (contract's own rule).

## Reuse inventory

- `TeamKitMark` — player identity in table rows and inspector (dense 20-28px, inspector 36-48px
  per `05_SHIRT_IDENTITY_AND_TEAM_KIT_COLOR.md §6`).
- `computeEffectivePlayerPositionProfile()` — current effective primary position, reused, not
  re-derived (ADR-0139).
- `RoleDistribution` (existing Touchline viz) — Core/Support/Development role-count visual, if the
  inspector keeps it.
- `PlayerPositionMapWidget` — could be reused as the inspector's "recent position exposure" — a
  smaller instance of the same widget already built for Player Detail.

## What is explicitly NOT normative

- The golden's fourth "Availability"/"Matchday additions" tabs — golden-only, not part of the
  bundle's locked three-mode set.
- The player photo in the inspector — shirt identity instead.
- The literal "Season 2024/2025" label wording — must read "League season" per existing product
  vocabulary rules.
