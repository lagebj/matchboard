# Gate B W5 — Source Reconciliation (B08)

What each B08 page reuses from real production source, verbatim, vs. what is fixture-substituted —
by page, so a reviewer can tell production fidelity from UI-Lab-only composition at a glance.

## B08-BEFORE

Real, unmodified: `MatchIdentityCard`, `MatchPreparationWidget`, `TouchlinePlanningPitch` (read-only),
`TouchlineButton`. Fixture-substituted: the real interactive `CoachingIntentSelector` is **not**
mounted — it self-fetches/mutates against the real DB and is not fixture-injectable, the same gap
B01's own doc comment already discloses; coaching intent is shown as a read-only Class-1 fact
instead. No new readiness surface invented.

## B08-LIVE

Real, unmodified: `LiveMatchClient` (the actual shared production component — zero server-only
imports, zero hardcoded network calls; see `BLOCKERS.md` item #3's resolved decision),
`MatchScoreHeader`, `AppearanceControl`. Fixture-substituted: a hand-written, synchronous,
in-memory `LiveMatchActions` implementation (`shared/safe-transition-controller.ts`) in place of
both production adapters (`league-live-match-client.tsx`/`event-live-match-client.tsx`) — no real
network or persistence call is reachable. **Not mounted:** the real `FollowLiveClient` — it performs
its own real realtime-ticket fetch and Durable Object connection on mount, not safely
fixture-injectable without a second stubbing layer this wave doesn't need; the reporter-vs-follower
distinction is instead demonstrated with a small read-only panel built from the same real
presentational primitive (`MatchScoreHeader`), fed static fixture data.

## B08-AFTER

Real, unmodified: `MatchIdentityCard`, `MatchTimelineList`, `MatchFlowPanel`,
`WhatThisMatchAddedPanel`, `MatchEventsPanel`, `MatchStatsPanel`, `MatchAfterMatchPanel` (inside a
real `OrgSlugProvider`), `CompletedMatchAdvisorPanel`, `TouchlinePlanningPitch` (read-only), the
real `TabRail`/`getMatchDetailTabs("AFTER")`/`resolveMatchDetailTab`. **Omitted and disclosed:**
`PlanVsRealityPanel` and `MatchTacticsPanel` — both self-fetch via real server actions/DB against a
real `matchId`/`teamId` and are not fixture-injectable; the Tactics/Opponent context/History tab
bodies are disclosed placeholders, the same discipline B05's own "Review" tab already uses for an
analogous gap. **Corrected, not reused verbatim:** the bottom-row report-status widget — see
`INFORMATION_OWNERSHIP_MATRIX.md` §3 and `VISUAL_VS_CURRENT.md` for the full rationale.

## B08-REPORT-DRAFT / B08-REPORT-COMPLETED

Real, unmodified: `SafePostMatchReportShell` and `useSafeReportLifecycle` — the exact same B05
fixture-safe pattern, parameterized with B08's own match identity and fixture data instead of B05's.
One additive, backward-compatible change was made to the shared component itself: an optional
`backHref` prop (default preserves B05's exact existing hardcoded href unchanged) so the "back to
match"/breadcrumb destination can point at B08's own `/after` route instead of B05's — verified not
to regress any of B05's own 22 existing tests.

## What was never built

No second live-reporting engine, no second report-validation reducer, no second Match Details
route, no new Event Match Details route, no new AI/Advisor pipeline, no new database schema or
persistence. Every real mutation surface in this wave (the Players tab's goal/assist/attendance
edits and `complete()`) is the same fixture-local-only B05 mechanism already reviewed and shipped as
a UI Lab candidate.
