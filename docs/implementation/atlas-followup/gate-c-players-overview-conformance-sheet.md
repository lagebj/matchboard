# Hard Human Gate C — Players Overview Conformance Sheet

Phase F5 (`10_IMPLEMENTATION_SEQUENCE_AND_HUMAN_GATES.md`). Static-fixture UI Lab only — no
production `/players` route touched. Reference decomposition:
`docs/implementation/atlas-followup/reference-decomposition/players-overview.md`. Screenshots
captured at 1440×900 (desktop) and 390×844 (mobile), all three modes, dark colour scheme.

## Golden-vs-contract conflict, resolved per authority order

The golden (`04-atlas-planning-and-players.png`, "PLAYERS OVERVIEW (DESKTOP)" panel) shows tabs
"Overview | Development | Availability | Matchday additions". The bundle's own written contract
(`03_PLAYER_OVERVIEW_CONTRACT.md §2`) explicitly locks a **different** three-mode set: "Overview /
Current round / Development". Per `00_AUTHORITY_AND_EXECUTION_CONTRACT.md`'s stated authority
order (this bundle's text outranks a golden image), this build uses the contract's three modes —
the golden's literal fourth tab and different labels are not followed. Recorded explicitly so this
isn't mistaken for an oversight.

## What was built

- Three new view models (`players-overview-view-model.ts`, `players-current-round-view-model.ts`,
  `players-development-view-model.ts`) — column shapes deliberately mirror the real,
  already-existing `getPlayersSeasonOverview()` result
  (`src/lib/players/get-players-overview.ts`), not invented fields; `PlayersCurrentRoundRow`
  reuses the real `IntegrityAttentionState` vocabulary from that same file.
- Three new components: `PlayerRosterTable` (desktop dense table), `PlayerCompactRow` (mobile,
  shared across all three modes with a mode-specific trailing slot), `PlayerInspector` (desktop
  selected-player preview panel).
- `PlayerInspector` reuses `PlayerPositionMapWidget` (built in Phase F4) outright for its position
  section — not a third position-map implementation.
- `/dev/ui-lab/atlas-followup/players-overview` — static fixtures, desktop uses a
  `grid-cols-[3fr_1fr]` table+inspector split (contract's own explicit ~9:3 ratio) with `TabRail`
  for the three modes; mobile switches to compact rows via a CSS breakpoint (no inspector on
  mobile — tap opens Player Detail instead, contract §7's own explicit rule).

## Comparison against the golden reference

Matches: dense roster + inspector desktop composition; row selection highlights and populates the
inspector; shirt identity throughout (table rows, compact rows, inspector); Current-round mode's
default sort (Blocked → Decision required → Covered, contract's own stated order); Development
mode as a plain list with no ranking (contract's own explicit rule — no score, no sort-by-anything
implying comparison).

Deviations:

1. Desktop content sits in a centered `max-w-[1100px]` column rather than spanning the full
   viewport width — a deliberate choice (matching the same content-well pattern used elsewhere in
   Touchline, e.g. Player Detail's own desktop width), not a stretched full-bleed table. Worth the
   reviewer's explicit confirmation since the golden's own screenshot happens to be captured at a
   narrower overall canvas where this doesn't arise as a visible choice.
2. The golden's density toggle ("Compact"/"Detailed") was not built — not required by the written
   contract, and no equivalent affordance exists elsewhere in this bundle to anchor its behaviour;
   a disclosed scope decision, not an oversight (see the reference-decomposition doc).
3. Table columns are a considered subset of the golden's full column list, per contract's own
   "keep columns intentionally limited" instruction — Matchday-additions/Planned-absent are
   modelled in the view-model type (`PlayersOverviewRow`) but not yet rendered as their own table
   columns in this fixture pass; straightforward to add if the reviewer wants them visible.

## Verification run

- `npx tsc --noEmit` — clean.
- `npx eslint` — clean (0 errors).
- Screenshots captured and reviewed for all three modes at both required viewports (6 total).

## Gate

Per `00_AUTHORITY_AND_EXECUTION_CONTRACT.md` §6, this coding session may not self-certify golden
fidelity. No production Players route has been touched.

**AWAITING HUMAN VISUAL APPROVAL**
