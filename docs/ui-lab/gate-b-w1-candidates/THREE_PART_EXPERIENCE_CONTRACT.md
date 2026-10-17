# Gate B W1 — Three/Four-Part Experience Contract

Reuses ADR-0157's existing knowledge hierarchy verbatim — this wave does not invent a second one.

## The hierarchy (ADR-0157 §1)

1. **Fact** — a recorded database value (final score, a logged timeline event, a player's shirt
   number). Rendered by `MatchIdentityCard`, `MatchTimelineList`, `MetricStrip`.
2. **Deterministic evidence** — a computed-but-not-judged derivation over facts (`buildMatchFlowChronology()`,
   `buildMatchPreparationDisplayItems()`, deterministic Match Insights). Rendered by
   `MatchFlowPanel`, `MatchPreparationWidget`, `MatchInsights` items with `source: "DETERMINISTIC"`.
3. **Coach observation/judgement** — a human-entered note or decision (coaching intent, team
   notes, reflection). Not exercised by this wave's components beyond read-only display; no
   mutating coach-input control is reused (see `DATA_TRUTH_AND_FIXTURES.md`).
4. **Assistant Coach hypothesis** — an AI-sourced interpretation layered on top of the same facts
   (Match Insights items with `source: "AI"`, carrying `confidence` and `evidenceRefs`, never a
   bare number). B04's single `AI`-sourced insight demonstrates this tier; B01/B02's insights are
   all `DETERMINISTIC`, which is itself honest for a plan that hasn't earned an AI-sourced finding
   yet.

These four tiers are never visually blurred: `MatchInsightCard` discloses `source` only inside its
expandable "Evidence" details, matching ADR-0149's "the coach does not need to know which insight
was deterministic and which used AI to connect evidence" at first glance, while still making the
distinction inspectable on demand — never hidden, never conflated.

## Assistant Coach status vocabulary (ADR-0149, reused verbatim)

`MatchInsightsStatus` — `CURRENT` (silent) / `UPDATING` / `STALE_AI_WITHHELD` / `AI_UNAVAILABLE`
("AI interpretation is temporarily unavailable. Factual insights are still current."). All four
candidates in this wave render `status: "CURRENT"` because their fixtures don't model a stale/
failed AI job — `UPDATING`/`STALE_AI_WITHHELD`/`AI_UNAVAILABLE` are left for a future Gate B wave
that specifically targets Assistant Coach degraded states (overlapping B07), not invented here
just to demonstrate coverage.

## Evidence inspection never implicitly applies a decision

`MatchInsightCard`'s "Evidence" `<details>`/`<summary>` only reveals confidence/evidence-ref
counts — it never triggers a mutation, matches the task's "evidence inspection must not implicitly
select or apply a decision" requirement by construction (it's a native disclosure element with no
`onClick` side effect), and is covered by `b04-completed-rich/__tests__/page.test.tsx`.
