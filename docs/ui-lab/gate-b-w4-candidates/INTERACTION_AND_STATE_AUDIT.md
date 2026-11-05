# Gate B W4 — Interaction and State Audit (B07)

## B07-A (historical pattern)

- Static read-only composition: match identity, Match story (timeline), Key figures, Match flow,
  Coaching intent review (real `CompletedMatchAdvisorPanel`, `status: "fresh"`).
- One interactive element beyond the Advisor panel's own "Show all" (not triggered — only 2
  insights, below `VISIBLE_INSIGHT_COUNT`): "Inspect historical evidence", opening Gate A's A04
  `SourceInspector` (inline panel on desktop ≥600px, `TouchlineBottomSheet` on mobile — same
  responsive split A04/B04 already established). Closes on Escape, restores focus to the
  trigger (tested).
- No `interactionState` beyond `"initial"` is captured — the evidence inspector's open/closed
  states are a genuine secondary interaction, captured once in the base run per the `initial`
  convention every prior Gate B wave has used for a toggleable panel (same as B04's own evidence
  inspector, which is also captured only in its default-closed state).

## B07-B (trivial fact)

- Static read-only composition: match identity, Match story (showing the real hat-trick), Key
  figures (`Noah — goals: 3`), Match flow, Coaching intent review (real
  `CompletedMatchAdvisorPanel`, `status: "fresh"`, `insights: []`).
- No interactive elements beyond the appearance control shared by every Gate B page — nothing
  else to toggle, by design (there is no evidence to inspect for a scenario demonstrating the
  *absence* of a finding).

## Mutation-action unreachability (both scenarios)

`CompletedMatchAdvisorPanel` only ever renders a production-mutation-wired control
(`ClarifyCard`/`DevelopmentSuggestionCard`) when `viewModel.clarification`/`viewModel.suggestions`
are non-empty (`src/components/ai/completed-match-advisor-panel.tsx:51-54`). Both B07 fixtures
set `clarification: null` and `suggestions: []`. Verified directly against the fixture data (not
inferred from a DOM query against a mock) in both `fixtures.test.ts` files — the "carries no
clarification or development suggestion" / "no fabricated prior encounters or development
evidence exist" tests.

## Degraded AI states — deliberately not implemented this wave

The real `getCompletedMatchAdvisorViewModel()` can also return `{status: "reviewing"}` or
`{status: "unavailable"}`, rendered via the real `AdvisorPanelReviewing`/`AdvisorPanelUnavailable`
components. The brief frames a degraded-state capture as optional ("if it adds material value"),
and B07's actual point — meaningful cross-match interpretation vs. a trivial single-match fact —
doesn't need a third AI-unavailable variant to make that contrast legible. Disclosed as a
deliberate scope decision, not an oversight; see `BLOCKERS.md`.
