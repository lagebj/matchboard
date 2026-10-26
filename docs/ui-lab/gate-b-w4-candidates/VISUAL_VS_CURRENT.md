# Gate B W4 — Visual vs. Current (B07)

## What's genuinely new

- The first Gate B scenario to mount the real `CompletedMatchAdvisorPanel` at all (B01-B06 never
  rendered it — B06-EVENT-AFTER's own `assistantCoachState` is `NOT_APPLICABLE`).
- The first Gate B scenario to pair an Advisor insight's evidence-source footer ("Match data ·
  Coach observation") with a Gate A A04-style `SourceInspector` drilldown — Gate B previously had
  `factRefs`/`evidenceRefs` on a `matchInsights` fixture (B04) but no drilldown UI for them.
- **Revised (W4-R8):** B07-B now demonstrates production's real "nothing to show" state —
  `advisorViewModel: null`, no Advisor component mounted at all — rather than a hand-constructed,
  production-unreachable `"fresh"`-with-empty-content state. See `CURRENT_STATE_AUDIT.md` item 6.

## What's unchanged (reused exactly)

- `CompletedMatchAdvisorPanel`, `MatchIdentityCard`, `MatchTimelineList`, `MatchFlowPanel`,
  `MetricStrip`, `TouchlineWidget`/`WidgetHeader`, `AppearanceControl` — all real, unmodified
  production components, same as B04's own composition pattern.
- `SourceInspector`/`useSourceInspector` — real, unmodified Gate A A04 components, imported
  directly (same precedent `gate-b/shared/match-b-fixture.ts`'s `SourceRecord` type import
  already established for Gate B).
- Visual hierarchy: the factual Match story/Key figures/Match flow remain the dominant, top
  content; the Advisor sits in its own subordinate "Coaching intent review" widget, exactly where
  production places it — no second competing dashboard was built.

## Light/dark, desktop/mobile

No new theming — every component used already has committed Touchline token support. No new
layout breakpoints — the `max-w-[640px]` single-column container is the same one B04 uses.

## 320px/360px defect — found during independent review, confirmed pre-existing (W4-R finding 5)

An independent review found the score composition wrapping to two lines ("3 -" / "2") and
`MetricStrip` labels truncating ("Recorded e…") at 320px in B07's own CI captures. Investigation
traced this to two real production components, neither modified by B07:

- **`MatchIdentityCard`** (`src/components/matches/match-detail/match-identity-card.tsx`): the
  hero score `<p>` (`text-[32px]`/`text-[40px]`) has no `whitespace-nowrap` and no narrow-width
  variant, so the browser wraps `"3 - 2"` at the space whenever the flex row (two `TeamIdentity`
  blocks + the score column) doesn't fit 320px.
- **`MetricStrip`** (`src/components/touchline/widget/metric-strip.tsx`): its narrow layout is a
  3-column grid with `dt` labels deliberately `truncate`d — intentional CSS, but a long label in
  a 3-column 320px grid reads as an ambiguous ellipsis fragment.

**Confirmed NOT B07-specific:** already-captured narrow screenshots for B04
(`gate-b-w1-b04-completed-rich-narrow-light.png`) and B06-LEAGUE-AFTER
(`gate-b-w3-b06-league-after-narrow-light.png`) — both pre-existing, already-reviewed Gate B
candidates — show the **identical** two-line score wrap ("4 -"/"1" and "3 -"/"1" respectively)
and identical label truncation ("Recorded e…"). Neither prior wave's `BLOCKERS.md`/
`SOURCE_RECONCILIATION.md` discloses this as a found issue — it was never flagged before.

**What B07 fixed within its own scope:** `factsItems` labels (authored by B07's own pages, not a
shared component) shortened — "Recorded events" → "Events", "Goals against" → "Against", "Noah —
goals" → "Noah goals" — short enough to no longer truncate in a 3-column 320px grid.

**Update (close-out remediation): `MatchIdentityCard`'s score wrap is now fixed and merged into
this PR.** `MetricStrip`'s `truncate` behavior was NOT changed (B07's own shortened labels already
resolved the readability problem within B07's own scope — no further production change was found
to be needed there; see `BLOCKERS.md`'s "Verify MetricStrip readability" history).

The `MatchIdentityCard` fix was prepared on its own branch
(`fix/match-identity-card-narrow-score-wrap`) as intended — a narrowly-scoped production
correction, not a UI-Lab-only patch, so B07 keeps rendering the real, unmodified component exactly
as every other Match Details surface does. It could not be opened as its own PR (this
repository's sequential-PR governance forbids a second open PR while #811 is open, and #811 can't
merge until the owner resolves the Visual Authority Gate — a real dependency cycle, not a
preference). Resolution: merged directly into this PR's own branch — see `BLOCKERS.md` for the
full reasoning — so the fix is fully visible in the one PR the owner reviews, rather than invisible
to it or left undone.

**What changed, scoped entirely to below the app's own `medium` (600px) breakpoint:**
`whitespace-nowrap` + `shrink-0` on the score column (never wraps, never compressed below content
width); a tighter row gap; a tighter team-name truncation width; the existing smaller `TeamKitMark`
size variant in place of the regular one (two instances toggled by CSS display, not a new size).
A first draft also added `flex-1` to the team-identity columns unconditionally and used a 2-tier
gap (`gap-3 sm:gap-10`) that would have silently redefined the untouched 600-639px range (not
flagged until an independent review caught it) — corrected to `flex-1 medium:flex-none` and a
3-tier `gap-3 medium:gap-6 sm:gap-10` that preserves the original `gap-6` value exactly for
600-639px.

**Real-browser verification** (two `workflow_dispatch` runs on the fix branch, not jsdom):
320/360/390/430/600/768/900/1440px, both themes, B04/B01/B06. Desktop (1440px), 768px, 900px, and
600px screenshots are **byte-for-byte pixel-identical** to the true pre-fix baseline (`ImageChops`
diff, zero bounding box) — rigorous proof of zero regression, not just visual inspection. 320-430px
screenshots genuinely differ from the pre-fix baseline (the wrap is fixed) and are pixel-identical
between the first draft and the final refined version (confirming the refinement changed only the
600-639px boundary, nothing below it).

## Second remediation: team-identity readability regression (within this same PR)

A follow-up independent review found a real problem with the fix above: keeping the score on one
line relied on truncating compact team names to a fixed `max-w-[4.5rem]` — which, for Matchboard's
real naming convention (same club, different suffix — "Slemmestad Rød"/"Slemmestad Hvit"/
"Slemmestad Blå"), silently discards the ONE piece of information that distinguishes the two
teams. `"Slemme…"` could be either team. This is unacceptable regardless of how well the score
itself renders.

**Design options considered** (ranked, per the review's own decision rule — correct match identity
first, compactness last):

1. **Allow names to wrap** (2 lines) instead of truncating — preserves full information, but a
   fixed ~72px column still crowds a line like "Slemmestad" (10 characters) against the score's
   own horizontal demand in the same row.
2. **Restructure to a 2-row composition** — decouple team names from the score's row entirely, so
   names get their own full-width row with no competition. Chosen.
3. **Controlled truncation as a last resort only** — kept only as a `line-clamp-2` safety net for
   genuinely extreme names, not a routine path.

**What changed** (commit `c608554383bde1abc5c8774d0966387b89090953`): `MatchIdentityCard` now
renders two **completely independent, always-present compositions**, exactly one visible at a time
via `medium:hidden` / `hidden medium:flex` (the same technique the first pass already used for the
two `TeamKitMark` size instances) — not the same DOM responsively restyled:

- **Compact (&lt;600px):** a `grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`, two rows —
  row 1 is `[home kit] [score] [away kit]`, row 2 is `[home name] [status] [away name]`. The score
  column (`auto`) always gets exactly the width it needs; the two name columns
  (`minmax(0,1fr)`) share whatever's left, independently of the score, since they're no longer in
  the same row. No `truncate`, no fixed `max-w` — names wrap onto a second line if they don't fit
  one, with `line-clamp-2` as the only remaining bound.
- **medium+ (600px and up):** reverted to the **exact original, pre-any-fix** markup and classes,
  byte-for-byte — `TeamIdentity` no longer carries any compact-specific props at all. This was a
  deliberate engineering choice to de-risk the "desktop stays unchanged" guarantee: rather than
  trying to prove a single shared/responsive structure produces identical desktop pixels to the
  original (which a grid-vs-flex structural change would make much harder to reason about with
  confidence), the medium+ branch is literally the untouched original JSX.

**Real-browser verification:**

- A fresh `workflow_dispatch` run (https://github.com/lagebj/matchboard/actions/runs/40023252963)
  at the full matrix (320/360/390/430/600/768/900/1440px, both themes) — B01/B04/B06 (sharing the
  component) plus both B07 scenarios, all genuinely with the fixed layout. All 24 B07 captures
  independently re-hashed, zero mismatches.
- **Desktop pixel-diff:** this run's B07-A/B07-B desktop screenshots are byte-for-byte identical
  (`ImageChops`, zero bounding box) to the *previous* fix's own desktop captures — which were
  already proven pixel-identical to the true original pre-any-fix baseline. Transitively: this
  second remediation changed nothing at 600px and up, confirmed by direct pixel measurement, not
  only by reasoning about the markup.
- **Same-club-suffix verification** (explicitly required — "Slemmestad Rød" vs "Slemmestad Hvit"/
  "Slemmestad Blå"): no existing B01-B07 fixture pairs two same-club teams, and B07's own fixture
  content is out of scope to change for this maintenance fix. Verified instead on a temporary,
  uncommitted scratch branch (`scratch/same-club-verify`, one fixture field — B01's opponent
  name — edited locally, pushed only long enough to run one `workflow_dispatch` capture,
  **deleted from origin immediately after inspection**, never opened as a PR, never merged, never
  part of any real branch's history). Both full names rendered correctly at every tested width,
  wrapped onto two lines where needed, clearly distinguishable, no overlap with the score — see
  `BLOCKERS.md` for the exact disclosure.
- Visually inspected directly (not only hash-verified): B07-A narrow-light (320px), B07-B
  gb-360-dark (360px), B07-A mobile-dark-evidence-open, B01-after narrow-dark (2-digit-adjacent
  score "2 - 1" with two same-club names, from the scratch verification), B04 narrow-light.
