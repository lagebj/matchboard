# Gate B W4 — Current State Audit (B07)

Grounded in the real repository at branch base `68eb32a69d3c73c316819d2865d99c2312d5b0f7` (PR
#808 merge), not the register's or the brief's assumptions. Every file path below was read
directly before any fixture or component decision was made.

## 1. What does the completed-match Overview already own?

`AfterMatchOverview` (`src/components/matches/match-detail/after-match-overview.tsx`) owns, in
order: result/header identity, team note, Match story (timeline + shape changes), Key figures
(goals/players used/assists/substitutions/position changes/observations — explicitly never
possession/xG/shots/cards/ratings/Player of the Match), Player involvement, Final lineup
(read-only), Plan vs reality, Match flow, Coaching intent review (the intent category/note +
embedded AI Advisor), "What this match added," and Reflection/Notes/Report-status. Everything
within this one match.

## 2. What does the current Advisor add?

`getCompletedMatchAdvisorViewModel()` (`src/lib/ai/presentation/completed-match-advisor.ts:149`)
already builds its content from `buildPostMatchReviewContext()`
(`src/lib/ai/context/post-match-review.ts`), which per ADR-0152 slices 4c/4e/5 already includes a
real, deterministic, League-only `recentTeamPatterns` section (42-day/8-match window, ranked
same-opponent > same-theme-as-today's-debrief > same-player > newest, deduped, capped 60/60) and
an opponent-pattern aggregate. These are real, shipped, cross-match mechanisms — B07 demonstrates
them producing a genuine finding, it does not invent a new one.

## 3. What is merely repeated from current-match facts?

Any insight whose only `evidenceRefs` are `fact:score:`/`fact:goal:`/`fact:assist:`/
`fact:minutes:` etc. (classified "Match data" only, per `EVIDENCE_SOURCE_PREFIXES`) with no
`fact:recent-team-patterns:`/`fact:opponent-history:`/`fact:debrief*` reference. B07-B's
hat-trick is exactly this failure mode if elevated into the Advisor section.

## 4. Which sources provide genuinely longitudinal context?

`recentTeamPatterns` (qualitative evidence/debrief observations across prior locked matches),
the opponent-pattern aggregate (prior encounters with the same opponent), and
`preMatchExpectations` (this match's own earlier MATCH_PREP/LINEUP_REVIEW review) — all real,
already in `post-match-review.ts`. B07-A's fixture models the first of these: a defensive-shape
concern recorded in two prior locked matches' debriefs, raised a third time in this match's own.

## 5. How should the coach distinguish interpretation from evidence?

Production already does this two ways: (a) the per-insight evidence-source footer
(`EvidenceSourceLabel`: "Match data" / "Coach observation" / "Previous Assistant Coach
expectation" / "Development evidence"), rendered inline under every insight; (b) Gate A's A04
evidence grammar (`SourceInspector`/`useSourceInspector`/`SourceRecordList`), not yet reused
anywhere in Gate B. B07-A is the first Gate B scenario to pair both — the real evidence-source
footer plus a genuine drilldown into the underlying debrief/event records.

## 6. What should the surface show when no meaningful interpretation exists?

There is no existing literal UI copy for this exact state in production. The closest real
precedent is the panel's own behavior when `insights` is empty: `AdvisorInsightList` simply never
renders (`viewModel.insights.length > 0` gate in `completed-match-advisor-panel.tsx:50`) and only
`viewModel.summary` shows. B07-B's fixture sets `summary: "No historical pattern identified from
the available evidence."` and `insights: []` — a plausible real AI-review summary, not an
invented UI state or a new component.

## 7. Which interactions can be reused without production mutations?

Rendering `viewModel.summary`/`insights`/section labels/evidence-source footer is pure display —
zero mutation. The only two call sites in `CompletedMatchAdvisorPanel` that ever invoke a
production server action (`ClarifyCard`, `DevelopmentSuggestionCard`) are gated on
`viewModel.clarification`/`viewModel.suggestions` being non-empty. Both B07 fixtures set
`clarification: null` and `suggestions: []`, making the real, unmodified component's entire
mutation surface structurally unreachable — proven directly against the fixture data in each
scenario's `fixtures.test.ts`, not inferred.

## 8. Which design decisions belong to B07 vs. B08?

B07 = this one surface's interpretation quality and evidence-hierarchy contrast (what's covered
here). B08 = tab reorganization and information-ownership transitions across the whole Match
Details surface (explicitly out of scope; not touched by any file in this wave).

## Correction to the brief's own assumption, found during implementation

Section 7 of the task brief suggested a possible narrowly-scoped adapter might be needed if the
real `CompletedMatchAdvisorPanel` "cannot be used safely in UI Lab." In practice the real
component *can* be mounted completely unchanged and safely — its mutation surface is gated
entirely on two fixture fields being non-empty, and both B07 fixtures set them empty by
construction. The actual blocker encountered was narrower and purely a test-environment one: the
real panel imports a `"use server"` actions module whose real auth/db dependency chain does not
resolve under the `vitest.config.components.ts` (jsdom) environment — production's own
`after-match-overview.test.tsx` already works around this by mocking
`@/components/ai/completed-match-advisor-panel` in its tests; B07's page tests do the same, for
the same reason, with a mock that faithfully re-renders the fixture's own viewModel fields. See
`SOURCE_RECONCILIATION.md`.
