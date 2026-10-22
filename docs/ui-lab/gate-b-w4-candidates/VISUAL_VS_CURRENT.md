# Gate B W4 — Visual vs. Current (B07)

## What's genuinely new

- The first Gate B scenario to mount the real `CompletedMatchAdvisorPanel` at all (B01-B06 never
  rendered it — B06-EVENT-AFTER's own `assistantCoachState` is `NOT_APPLICABLE`).
- The first Gate B scenario to pair an Advisor insight's evidence-source footer ("Match data ·
  Coach observation") with a Gate A A04-style `SourceInspector` drilldown — Gate B previously had
  `factRefs`/`evidenceRefs` on a `matchInsights` fixture (B04) but no drilldown UI for them.
- B07-B is the first Gate B scenario to demonstrate the Advisor's own "nothing to show" content
  path (`insights: []`) deliberately, rather than omitting the panel.

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
layout breakpoints — the `max-w-[640px]` single-column container is the same one B04 uses, known
to work at the Gate B smoke widths (320/360/430/390/1440).
