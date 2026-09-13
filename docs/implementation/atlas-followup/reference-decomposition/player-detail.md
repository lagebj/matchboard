# Reference Decomposition — Player Detail

Golden: `02-player-detail-original-golden.png` (mobile, 390-ish width, iPhone frame).
Contract: `04_PLAYER_DETAIL_CONTRACT.md`. Per `01_GOLDEN_REFERENCE_INDEX_AND_CONFORMANCE_METHOD.md
§2 Step A` — this is reverse engineering of an approved design, not product discovery.

## Viewport

Golden shows a phone frame (~390×844 content area). Desktop composition is not shown in this
specific golden image for Player Detail (the desktop reference for general density/inspector
pairing is `04-atlas-planning-and-players.png`, used for Player *Overview*, not Player *Detail* —
Player Detail's desktop layout is our own composition, following the same content order as
mobile in a wider single column or a two-column identity+content split, decided during
implementation, not dictated by a golden).

## Content order (top to bottom, mobile)

1. Back chevron + overflow (`...`) — top row, outside any card.
2. Identity block (no card, direct on background): small caps context line ("GRAABEIN UNITED /
   G2015 · Autumn 2026" — the golden image's own on-screen season label uses the pre-Touchline
   American-English term for this season instead of the current product terminology; this
   bundle's own fixtures correctly use the current term, per AGENTS.md's season-terminology
   rules), large player name (two-line capable, bold), shirt number + primary
   position line ("#10 · Left Wing"), two pill badges (age-group "U12", team "Graabein United").
   A decorative photo/atmosphere occupies the top-right — **not normative** (superseded by shirt
   identity per bundle rule).
3. Tab rail: Overview / Matches / Development / Evidence, underline-active style, directly below
   identity, no card wrapper.
4. **Participation strip** — one card, label "PARTICIPATION" + "This season ›" affordance
   top-right, five numeric columns (Matches, Minutes, Starts, Goals, Assists) — large bold
   condensed numerals, label beneath each in muted small caps.
5. **Two-up row**: Opportunity widget (left) + Position exposure/map (right), roughly equal
   width, both same height, both cards.
   - Opportunity: label "OPPORTUNITY" + info icon, big "1 / 1" + "this week", a small five-bar
     sparkline (W32-W36, current week highlighted lime, others muted), one line of factual
     interpretation text below.
   - Position map (superseded by `05-followup-pitch-position-system.png` for the actual dot
     semantics/orientation — this golden's version is horizontal/flat with a differently-scaled
     glow-highlighted primary dot): label "POSITION EXPOSURE", a small pitch diagram, a 3-row
     legend below with dot + code + percentage right-aligned.
6. **Latest review** — one card, label "LATEST REVIEW" + right-aligned source/date ("Coach
   feedback · 7 Sep"), a large quote-mark glyph, italicized prose (2-3 sentences), then a row of
   small pill tags naming the observation themes ("Direct play", "Creates chances", "Final third
   decisions") — the first two lime-outlined (positive/primary), the third neutral.
7. **Recent football** — one card, label "RECENT FOOTBALL" + "View all ›", 3 dense rows (date
   stacked day/month at left, opponent bold + competition muted beneath, then a compact
   goal/assist icon-count pair, then a chevron). No border between the label row and the first
   data row beyond the card edge; thin dividers between rows.
8. Bottom tab bar (Today/League/Events/**Players**[active]/More) — this is the app shell's
   primary nav, not part of Player Detail's own composition; already implemented, not rebuilt
   here.

## Region width ratios (mobile)

Full-bleed single column, ~16-24px side padding. The two-up row (Opportunity / Position) splits
roughly 45/55 (Opportunity slightly narrower than the pitch-diagram card).

## Vertical rhythm

Consistent ~16-20px gap between cards. Identity block has more breathing room above/below (~24px)
than inter-card gaps. Tab rail sits close to identity (~12px) with a full-width thin divider
beneath it separating chrome from content.

## Typography hierarchy

- Player name: largest weight on the page, bold, ~28-32px, two-line capable.
- Card section labels ("PARTICIPATION", "OPPORTUNITY", etc.): smallest, uppercase, wide
  letter-spacing, muted.
- Participation strip numerals: second-largest on the page, condensed/tabular, bold.
- Opportunity "1 / 1": large, bold, same visual weight class as participation numerals.
- Body/prose (Latest review quote): regular weight, comfortable line-height, larger than meta
  text but smaller than numerals.
- Meta text (dates, competition names, muted labels): smallest regular-weight text.

## Widget grouping (maps to contract §4 required Overview sections)

| Golden region | Contract concept | Component |
|---|---|---|
| Identity block | Persistent identity header (contract §2) | `PlayerIdentityHero` |
| Tab rail | Tabs (contract §3) | shared tab-rail primitive (`TabRail`, already exists) |
| Participation strip | Participation strip (contract §4) | `PlayerParticipationStrip` |
| Opportunity | Opportunity widget (contract §4) | `PlayerOpportunityWidget` |
| Position exposure | Position map (contract §4) — **orientation/dot semantics superseded by `05-followup-pitch-position-system.png`**, not this golden's flat horizontal version | `PlayerPositionMapWidget` (wraps `TouchlinePositionMap`) |
| Latest review | Latest observation/review (contract §4) | `PlayerObservationStory` |
| Recent football | Recent football (contract §4) | `PlayerRecentFootball` |

## Interaction anchors

- Tab rail: tap to switch tab, URL-backed (`?tab=overview` etc., contract §3).
- "This season ›" (participation strip): a scope affordance — real season-switching is **not**
  in scope for this bundle (no multi-season selector contract given); render as a static label
  unless a real, already-existing season-scoping mechanism is trivially reachable. Do not invent
  a new season-picker interaction to match the chevron.
- "View all ›" (recent football): links to the Matches tab.
- Recent football row: tap opens the match/event detail page (existing route).
- Position map dot: tap/hover/focus reveals detail (already built in `PositionEvidenceDot`,
  contract §10).

## Pitch size and location

Position exposure card is roughly square, occupying the right half of the two-up row — a compact
size class, not the full-width pitch-dominant size used on Lineup/Tactics. `TouchlinePositionMap`
already scales via its container (`aspect-[4/5]`, `w-full`), so this is a sizing/placement
decision at the call site, not a new component variant.

## Inspector width/placement

Not applicable — Player Detail has no side inspector; it is a single content column (mobile) or a
wide single column (desktop, our own composition).

## Mobile transformation

The golden **is** the mobile reference directly (no separate compression step needed). Desktop
composition: same content order, wider max-width single column (matching how other Touchline
detail pages compose, e.g. Team detail), participation strip numerals possibly larger, two-up row
stays two-up (has room to breathe further on desktop, could go three-up with a wider position map
— decided during implementation based on available width, not golden-dictated since no desktop
golden exists for this specific page).

## What is explicitly NOT normative (per `01_GOLDEN_REFERENCE_INDEX...md` and
`00_AUTHORITY_AND_EXECUTION_CONTRACT.md §4`)

- The player photograph — replaced by `PlayerIdentityHero`'s generated shirt mark.
- The decorative "BETTER PLAYERS BRIGHTER TOMORROW" marker/tagline graphic — illustrative brand
  content, not a real Matchboard feature.
- The position-exposure pitch's exact visual treatment (flat/horizontal in this golden) —
  superseded by the newer pitch-system golden; use `TouchlinePositionMap` (vertical, matching the
  planning pitch's graphic per the human-approved Gate A revision) instead.
- "This season ›" as a working season switcher — no season-selector contract exists for Player
  Detail; render the label, do not build new season-switching behavior speculatively.
