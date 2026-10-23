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

**What B07 did NOT fix, and why:** the score vertical-wrap and the `truncate` CSS itself are
`MatchIdentityCard`/`MetricStrip` behavior, reused unmodified by B04/B06 as well as B07. Patching
it locally (a UI-Lab-only wrapper/override) would make B07 diverge from how these components
actually render in production and in every other Gate B candidate — the opposite of what a real
production-component reference is for. Recorded as a production dependency, not fixed here (see
`BLOCKERS.md`).

**Proposed minimal production fix** (for a future, separate production PR, not attempted here):
add `whitespace-nowrap` to `MatchIdentityCard`'s hero `<p>` (and/or reduce `heroSize`/gap at a
narrow breakpoint); give `MetricStrip`'s narrow grid either 2 columns instead of 3, or a
`title={item.label}` tooltip/accessible-full-text fallback alongside the visual truncation so the
full label is never only available via overflow.
