# Hard Human Gate B — Player Detail Conformance Sheet

Phase F4 (`10_IMPLEMENTATION_SEQUENCE_AND_HUMAN_GATES.md`). Static-fixture UI Lab screens only — no
production route touched. Reference decomposition:
`docs/implementation/atlas-followup/reference-decomposition/player-detail.md`. Screenshots
captured locally with Playwright/Chromium against
`/dev/ui-lab/atlas-followup/player-detail?tab=<overview|matches|development|evidence>`, dark
colour scheme, at 390×844 (all four tabs) and 1440×900 (Overview) — the required minimum set.

## What was built

- Five new view-model files (`src/lib/touchline/presentation/player-{identity,overview,matches,development,evidence}-view-model.ts`),
  reusing the pre-existing `player-detail-view-model.ts` (ADR-0136 Atlas) where it already fit
  (`describeOpportunityTrend()`), rather than a second implementation of the same factual,
  non-causal sentence.
- Nine new components under `src/components/touchline/player/`: `PlayerIdentityHero`,
  `PlayerParticipationStrip`, `PlayerPositionMapWidget`, `PlayerDevelopmentFocus`,
  `PlayerObservationStory`, `PlayerRecentFootball`, `PlayerMatchTimeline`,
  `PlayerPositionTimeline`, `PlayerDevelopmentTimeline`.
- **Two widgets reused outright, not duplicated**: `OpportunityWidget`
  (`src/components/touchline/widgets/`, already exactly matches the contract's Opportunity-widget
  requirement) and `EvidenceStory` (`src/components/touchline/evidence/`, already exactly matches
  the contract's `observation → visual → sample → confidence → detail` grammar for the Evidence
  tab — no `PlayerEvidenceStory` wrapper was created).
- Tab shell: `TabRail`'s existing "underline" variant in href-mode — real `<Link>` navigation, so
  `?tab=overview|matches|development|evidence` is genuinely URL-backed and browser Back/Forward
  works for free, not simulated with local state (contract §3).
- `/dev/ui-lab/atlas-followup/player-detail` — static fixtures reusing the golden reference's own
  "Noah Larsen" scenario.

## Fixed during this pass

Desktop Overview's two-up row (Opportunity + Position map) initially appeared to stretch the
shorter Opportunity card to match the taller Position card's height (grid default `align-items:
stretch`). Added `items-start` to the grid. Verified by direct DOM measurement (not just visual
inspection, which was inconclusive against the dark-on-dark widget background) —
`getBoundingClientRect()` confirmed the Opportunity widget is 179px tall against the Position
widget's 603px after the fix, versus both being 603px before it.

Desktop's outer container also initially stayed at the mobile `max-w-[440px]`, floating as a
narrow column in a sea of unused canvas at 1440px width — widened responsively
(`medium:max-w-[720px] large:max-w-[820px]`) per the reference-decomposition doc's own
"desktop composition is our own composition" scope note (no desktop golden exists for Player
Detail specifically).

## Comparison against the golden reference (`02-player-detail-original-golden.png`)

Matches: full content order (identity → tabs → participation strip → opportunity/position two-up
→ latest review → development focus → recent football); participation strip as one composed
strip, not five cards; opportunity sparkline + factual trend sentence; position map compact and
paired with opportunity; latest-review card with quote glyph, italic prose, and pill tags (first
two accent-outlined, matching the golden's visual priority treatment); recent-football dense rows
with date-stack, no per-row card, goal/assist icon-counts, chevron.

Deviations (largest first):

1. **Position map legend** shows rank labels (Primary/Secondary/Tertiary) instead of the golden's
   colour-dot + percentage-share list. This follows directly from Gate A's approved change (the
   position map now shows support bands/confidence, not exposure percentages) — a genuine,
   already-approved semantic difference from the golden, not an oversight. A small colour-swatch
   next to each legend row (matching each dot's hue) would tighten the visual link between map and
   legend and is a reasonable follow-up polish item.
2. **Shirt hero size** is 96px ("hero") on both mobile and desktop — within the contract's stated
   72–112px range, but does not scale up further on desktop the way the identity text does. Not
   fixed in this pass; a `TeamKitMark` size prop with a viewport-responsive hero variant would be
   the clean way to address it if the reviewer wants it larger on desktop.
3. **Tab-rail overflow on the narrowest mobile width** (390px): "Evidence" is visually clipped at
   the right edge. `TabRail` is a pre-existing, shared, already-in-production component
   (`overflow-x-auto`, genuinely horizontally scrollable, not `overflow-hidden`) — this is
   existing behaviour inherited as-is, not something introduced by this composition. Confirmed
   scrollable, not broken; flagged for the reviewer's awareness rather than silently left
   unmentioned.
4. The decorative player photo, background atmosphere glow, and "BETTER PLAYERS BRIGHTER
   TOMORROW" marker graphic are correctly absent per the bundle's own explicit supersession by
   the shirt-identity system — not a gap.
5. "This season ›" in the golden implies a season switcher; per the reference-decomposition doc,
   no season-picker contract exists for this bundle, so it renders as a static label only — a
   disclosed, deliberate scope boundary, not an interaction left unbuilt by oversight.

## Verification run

- `npx tsc --noEmit` — clean.
- `npx eslint` on all touched files — clean (0 errors).
- Screenshots captured and visually reviewed for all four tabs (mobile) plus Overview (desktop) —
  the required minimum set per `01_GOLDEN_REFERENCE_INDEX_AND_CONFORMANCE_METHOD.md §2 Step D`.

## Gate

Per `00_AUTHORITY_AND_EXECUTION_CONTRACT.md` §6, this coding session may not self-certify golden
fidelity. No production Player Detail route has been touched — only
`/dev/ui-lab/atlas-followup/player-detail`.

**AWAITING HUMAN VISUAL APPROVAL**
