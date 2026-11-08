# Gate B W5 — Source Reconciliation (B08)

**Updated for the W5 remediation (independent PR #822 review, 2026-11-08).** What each B08 page
reuses from real production source, verbatim, vs. what is fixture-substituted — by page, so a
reviewer can tell production fidelity from UI-Lab-only composition at a glance.

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
presentational primitive (`MatchScoreHeader`).

**FIXED (W5 remediation, P2-9):** the follower panel previously received a static fixture score
that could silently disagree with the reporter's own live state. It is now derived, on every
render, from the SAME event ledger `useB08LiveFixtureActions` itself returns (`events`), via the
real `buildMatchPresentation()` — recording a goal in the reporter panel updates the follower panel
on the very next render. Proven with a real `fireEvent.click` against the real mounted
`LiveMatchClient` in `live/__tests__/page.test.tsx`.

**New, bounded, fixture-local (W5 remediation, P1-6):** `shared/b08-journey.ts` is a real,
versioned `sessionStorage` persistence layer so a genuinely recorded live event can reach the
subsequent Report — see `DATA_TRUTH_AND_FIXTURES.md`'s own "Event persistence scope" section for
its exact lifetime/isolation guarantees. It is explicitly NOT a general-purpose event-sourcing
system, reuses the existing pure derivation functions, and never reaches a server.

**FIXED (W5 SECOND remediation):** the follower's own score (and every other interactive-mode
derivation) now goes through `shared/b08-projection.ts`'s reversal-aware
`computeEffectiveLiveEvents()`/`deriveEffectiveScore()` first — a real "Undo" on the reporter
correctly decrements the follower's score too, matching `LiveMatchClient`'s own real
`goalsFor`/`goalsAgainst` state exactly. `getRecentEvents()` also now marks `isReversed` on an
already-undone event via the new `markReversedEvents()` (same reversed-id algorithm, without
filtering) — real production computes this server-side; this fixture has no server, so it
computes it the same way for its own Recent Events display.

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

Now renders **both** real AFTER states (draft and completed), switched by an explicit `?report=`
query param (W5 remediation, P1-5) — one Match Details composition, not a second page.
`MatchAfterMatchPanel` now also takes an additive, backward-compatible `reportHrefOverride` prop
(W5 remediation, P2-8) so its own secondary report link resolves inside the UI Lab instead of a
production-shaped `orgUrl()` path — default preserves the exact prior behavior for every production
call site.

**FIXED (W5 SECOND remediation):** AFTER no longer trusts the `?report=` URL param when a real,
persisted interactive report exists — it reads `shared/b08-journey.ts`'s `loadB08JourneyReport()`
first (authoritative), falls back to a reversal-aware seed from a finished-but-unreconciled LIVE
journey second, and only falls back to the URL-switched reference fixture when no journey exists
at all. `deriveB08AfterDataFromReport()` builds the real `MatchDetailAfterData` shape from the
persisted report — reflection, football observations, opponent observation and combination
evidence come back empty/null in interactive mode (never fabricated against a different history),
and the embedded Assistant Coach panel switches to the real, already-production-modeled
`{status: "unavailable"}` state (via `AdvisorPanelUnavailable`) instead of showing the fixed
reference match's own insight.

## B08-REPORT-DRAFT / B08-REPORT-COMPLETED

Real, unmodified: `SafePostMatchReportShell` and `useSafeReportLifecycle` — the exact same B05
fixture-safe pattern, parameterized with B08's own match identity and fixture data instead of B05's.
Three additive, backward-compatible props were added to the shared shell across this wave: `backHref`
(default preserves B05's exact existing hardcoded href), and (W5 remediation, P1-5/P1-6)
`backHrefForStatus`/`onStatusChange` — letting B08-REPORT-DRAFT's own back-links react live when the
coach completes the report in place (status flips REPORTED → LOCKED with no navigation), instead of
staying pointed at the stale draft/incomplete AFTER variant. All three default to B05's unmodified
prior behavior; verified not to regress any of B05's own existing tests.

REPORT-DRAFT additionally reads `shared/b08-journey.ts`'s own `loadFinishedB08JourneyEvents()` (W5
remediation, P1-6): if a finished LIVE journey exists in this browser session, goals/assists/score
are derived from what was ACTUALLY recorded there instead of the fixed canonical report. No journey
(every direct visit, including every CI/Playwright capture) is unaffected.

**FIXED (W5 SECOND remediation):** a fourth, new prop — `onStateChange` — lets REPORT-DRAFT persist
the coach's own full reconciliation (not just `status`) back into the journey store on every real
change, so a reload or a navigation to AFTER/REPORT-COMPLETED never loses it. A skip-first-render
guard inside the shell prevents a bare mount from echoing `initialLocalState` straight back out
through `onStateChange` as though it were a real edit — without it, merely VISITING REPORT-DRAFT
(including a CI capture) would have silently started a persisted "interactive journey," breaking
reference-mode isolation for every other page. REPORT-COMPLETED now reads the SAME persisted report
when it exists (showing the coach's own real completed record, not the fixed reference) — if that
journey's own report was never actually locked, the real shared shell renders it honestly as its
own DRAFT-editable surface instead of fabricating a completed state (`surfaceState = status ===
"LOCKED" ? "COMPLETED" : "DRAFT"` already does this correctly; no special-casing was added).

## What was never built

No second live-reporting engine, no second report-validation reducer, no second Match Details
route, no new Event Match Details route, no new AI/Advisor pipeline, no new database schema or
server-side persistence. Every real mutation surface in this wave (the Players tab's goal/assist/
attendance edits and `complete()`) is the same fixture-local-only B05 mechanism already reviewed and
shipped as a UI Lab candidate. `shared/b08-journey.ts` (W5 remediation) is real, new, client-only
`sessionStorage` persistence, explicitly bounded to B08's own five routes — not a general
event-sourcing system, never a server call.

## TabRail (shared production component, W5 remediation P1-4)

`src/components/ui/tab-rail.tsx`'s pill variant previously had no width cap or overflow handling,
letting the whole page grow wider than the viewport once its tabs' combined content exceeded it —
a real, pre-existing defect, not something this wave introduced, but first surfaced by B08's own
7-tab AFTER rail. Fixed additively (`max-w-full overflow-x-auto` + `shrink-0` on each item) —
verified against all four real production call sites (Match Details, Post-Match Report, Team,
Event) plus every Gate A/B UI Lab wave (102 test files, 645 tests, all passing).
