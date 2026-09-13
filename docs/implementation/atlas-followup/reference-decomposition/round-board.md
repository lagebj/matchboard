# Reference Decomposition — Round Board

Golden: `01-round-board-approved.png`. Contract: `02_ROUND_BOARD_CONTRACT.md`.

## Viewports shown in the golden

1. Desktop (~1536px canvas) main board.
2. Mobile ×4 panels (390-ish): Round overview, Match list, Match squad (one match open),
   Player assignment (bottom sheet).
3. Desktop allocation matrix (secondary mode).

## Desktop — content order

1. App shell top bar (existing, not rebuilt).
2. Page header: "Round Board" title + "Plan squads for all matches in this round. Let Matchboard
   suggest. You decide." subtitle.
3. Toolbar row, right-aligned: round selector ("Week 42 ▾"), date range text, "Auto populate",
   accent "Save round" button, overflow (`...`).
4. **Attention strip** — five cards in a row: decisions-needing-attention (with a ring/progress
   indicator + count), matches count, opportunities-planned (count + progress bar), coverage
   issues count, "Review suggestions" (a static explainer card, not obviously actionable — maps
   to contract's "review suggestions" concept loosely; may be foldable into the attention strip's
   general affordances rather than a fixed fifth tile).
5. **Main body**, four-column-equivalent layout: 3 match lanes (width scales with match count,
   contract §4: "exact number of lanes determined by the round") + one selected-player inspector
   column on the right, same width class as one lane.

## Match lane anatomy (top to bottom)

- Colored round dot (team-distinguishing accent, e.g. red/white/blue circle) + team name.
- "vs {opponent}" + kickoff date/time, small "swap" icon top-right, status pill.
- Green "Squad (N)" pill + a secondary state pill ("Needs 1" / "Complete").
- A thin progress bar beneath the header (visible in Rød/Blå lanes, subtle).
- Player rows: `#num | shirt-avatar | name | position code | role pill ("Core"/"Support") |
  overflow (⋯)`. Grouped implicitly by role (Core rows first, Support rows after — a thin
  visual gap, not a section header, per the golden).
- "+ Add player" affordance pinned to the lane's bottom.

Player rows are dense — no per-row card/border, matching contract §4 "Do not wrap each player in
a card."

## Selected-player inspector (right column)

- Header: shirt avatar + number + name, position codes, close (×).
- Sub-tabs: "Overview / This week / History" (thin underline tabs).
- An attention banner when relevant ("No opportunity yet — this player does not have a match
  assigned in this round") — amber/warning tone, not red/blocking.
- "Suggested assignments" list: each suggestion is its own bordered card (team-color-dotted),
  showing target match, resulting squad count ("10 / 12 players"), 2-3 bullet reasons (✓ Good
  squad balance / Needs CM depth / Counts as support opportunity), and one dominant accent
  "Assign player" button on the currently-selected/best suggestion. Alternative suggestions below
  are more muted (outline only, no filled button) with just a summary line + a small radio circle.

## Mobile — four panels

1. **Round overview**: local tab bar (Overview/Matches/Players) directly below the page title;
   attention-strip content re-flows into two 2-up stat tiles + one wide "decisions need attention"
   ring tile; a "Needs attention" list below with per-item "Resolve" buttons.
2. **Match list**: back chevron removed (still on Overview tab bar), match cards stacked
   vertically — team color dot + names + kickoff, a progress bar, and a right-aligned state pill
   ("Needs 1" / "Complete" / "Needs 2").
3. **Match squad** (one match opened): header shows opponent + progress ("10/12") + state pill;
   local sub-tabs "Squad / Available / Suggestions"; dense player rows below, same row anatomy as
   desktop.
4. **Player assignment** (tapping a player): a bottom-sheet-style full page — identity header,
   sub-tabs (Overview/This week/History), the same attention banner + suggested-assignments list
   as desktop's inspector, with one dominant "Assign to {team}" button at the very bottom of the
   sheet.

Confirms contract §7's exact structure: Overview → Matches → open one match (Squad/Available/
Suggestions) → tap a player → assignment sheet → commit.

## Desktop allocation matrix (secondary mode)

- Top toolbar: "Board | Allocation" segmented switch (not shown separately in this crop, but
  implied — the golden's panel 5 is directly captioned "ALLOCATION VIEW (DESKTOP)... Matrix
  alternative for maximum overview"), round selector persists.
- Columns: Player | one column per match team (colored dot) | Total | Target | Status.
- Cells: a colored dot in the cell when that player is assigned to that match; blank otherwise.
- One row highlighted (Henrik) showing `Total 0 / Target 1`, Status "Needs assignment" in a
  warning tone — everything else "OK".

## Region width ratios (desktop)

Attention strip: five roughly-equal tiles spanning full width. Main body: three match lanes +
inspector, each lane roughly equal width (~22% each), inspector slightly wider (~28%) — total
four roughly-equal columns, inspector marginally dominant since it carries the decision content.

## Typography hierarchy

Page title largest; lane team name and player names share a mid-weight bold tier; counts/pills/
labels are small and muted; inspector's "Assign player" button label is the single most visually
dominant piece of text-on-a-button on the page (bright accent fill).

## Interaction anchors

- Round selector: dropdown (existing round-switching mechanism, not new).
- Auto populate / Save round: existing actions (`regenerateRoundAction`/save equivalents already
  exist per Phase F0 audit) — restyled, not reimplemented.
- Player row: click/tap selects → populates inspector (desktop) or opens assignment sheet
  (mobile). Drag-and-drop remains available on desktop as an accelerator calling the exact same
  `addPlayerToMatchAction`/`movePlayerWithinRoundAction` (contract §3, already true of the current
  implementation per the Phase F0 audit — `route-component-map.md`).
- "+ Add player": opens a player picker for that lane.
- Suggested-assignment card: one click commits (`Assign player` / `Assign to {team}`).
- Allocation matrix cell: same assignment command as the board (contract §8's explicit rule).

## What is explicitly NOT normative

- The literal five-tile attention strip count/wording — contract's own required content is:
  decisions needing attention, matches planned, opportunities planned, coverage issues, review
  suggestions — golden's exact tile styling (ring gauge, progress bar) is compositional guidance,
  not literal pixel law.
- Exact suggestion reasoning bullet text ("Good squad balance", "Needs CM depth") — illustrative;
  real reasons must come from the existing canonical planning/suggestion logic (contract §5: "Do
  not invent 'AI reasons'").
- Player avatar photos — shirt identity instead.
