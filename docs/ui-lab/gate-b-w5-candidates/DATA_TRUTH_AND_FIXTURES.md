# Gate B W5 — Data Truth and Fixtures (B08)

**Updated for the W5 SECOND remediation (independent review, 2026-11-08, "lifecycle data
consistency").** One canonical match history (`src/app/dev/ui-lab/gate-b/b08-information-ownership/
shared/fixture.ts` + `fixture-history.ts`) feeds all five lifecycle candidates in REFERENCE mode —
never a second interpretation of the same match. In INTERACTIVE mode (a real recorded LIVE journey
and/or a reconciled report), all five candidates instead read the ONE shared projection
(`shared/b08-projection.ts` + `shared/b08-journey.ts` v2) — see "The shared projection" section
below. Every number in this document is asserted by a real test, not restated here as a separate
claim to trust; see the referenced test file for the authoritative check.

## Identity (`fixture.ts`)

- `B08_MATCH_ID` / `B08_REPORT_ID` — one identity throughout all five states.
- Home: the programme's persistent team (`MATCH_B_TEAM_NAME`, shared across Gate B since ADR-0157).
  Opponent: "Vollen IL". Kickoff `2026-11-05T10:00:00.000Z`.
- Format: NFF G11 7v7, 2×30 minutes (60' regulation) — the same authoritative format B05 already
  established; no new duration invented (`CURRENT_STATE_AUDIT.md` §5).
- Five real, fixed, chronologically increasing observation instants (`B08_BEFORE_NOW` ... `B08_COMPLETED_AT`)
  — never `Date.now()`, strictly ordered, checked directly in `shared/__tests__/fixture.test.ts`.
- 8-member squad: 7 starters filling every real G11 7v7 slot, 1 bench reserve (Elias) who attends
  but is never fielded (0 minutes, no unexplained gap).

## Canonical event record (`fixture-history.ts`)

Final result: **2-1** (home win). Three real goal events, in period-relative time
(`globalMinuteToPeriodRelative()`):

- 10' — Vetle scores, unassisted (1-0).
- 22' — Vollen equalizes (1-1).
- 48' — Noah scores, assisted by Sindre (2-1, final).

Slemmestad never trails and never leads by more than one goal at any point — asserted directly,
not assumed (`shared/__tests__/fixture-history.test.ts`).

### FIXED (W5 remediation, independent review P1-3) — `matchSeconds` unit correction

`globalMinuteToPeriodRelative()` previously multiplied by 60 (producing real seconds). The field is
actually **milliseconds** despite its legacy name — confirmed directly against
`live-match-client.tsx`'s own `formatElapsedMs(event.matchSeconds)` renderer and doc comment ("...is
milliseconds since period start (legacy name — ADR-0133 H3)"). The prior value made every live event
render at roughly 0:00 in B08-LIVE's own Recent Events list once the real `LiveMatchClient` was
mounted. Fixed to multiply by 1000; `periodRelativeToGlobalMinute()` (the inverse) added alongside
it for the journey-derivation code (see below). Literal production-contract values (not a
self-comparison against the same function) are now asserted directly in
`shared/__tests__/fixture.test.ts` and `fixture-history.test.ts`. B05's identically-shaped helper
carries the same latent bug but is out of this wave's scope — it never mounts the real
`LiveMatchClient`, so the bug stays dormant there (see `BLOCKERS.md`).

### FIXED (P1-2) — the LIVE clock's `elapsedBeforeStartMs`

`safe-transition-controller.ts`'s fixture-local `getPreMatchPackage()` set the second-half clock's
`elapsedBeforeStartMs` to the full first-half duration (30'), double-counting it on top of a
`startedAt` already 15' in the past — per `match-clock.ts`'s real `getElapsedMs()` contract
(`elapsedBeforeStartMs + (now - startedAt)`, reset to 0 on every real `advancePeriod()`), this
produced a false ~45:00 reading and a spurious over-duration warning instead of the real 15:00.
Fixed to `elapsedBeforeStartMs: 0`. Verified with deterministic fake timers (`vi.setSystemTime`) in
`shared/__tests__/safe-transition-controller.test.ts`, fed through the REAL production
`getElapsedMs()`/`formatElapsedMs()` functions, not a reimplementation.

## The one genuine incomplete-data condition

The second half's running-clock duration is **unconfirmed** in the DRAFT report
(`b08TimingReview("draft")` → `needsReview: true`, a plausible-but-unreviewed 27' reading) and
resolved to the real 30' period duration in COMPLETED. This is not a decorative warning panel — it
is the real blocker the shared `useSafeReportLifecycle` reducer's own `complete()` action enforces
(confirmed directly against the real reducer code during Step 4 implementation): attempting to
complete the DRAFT report without resolving it is rejected with an explicit error, state unchanged.
There is deliberately **no** goal-attribution gap in this fixture (both report goals exist from the
start) — B05 already demonstrates that axis; B08's own incomplete-data axis is timing, kept
distinct on purpose.

## Report data consistency (DRAFT vs. COMPLETED)

`b08Goals`/`b08Assists`/`b08AttendanceFacts` are identical between variants — finalization does not
silently change goals, attendance, or match identity. The only field that changes between variants
is the timing-review row's own `resolvedDurationMinutes`/`needsReview`, plus the lifecycle-derived
`status`/`completedBy`/`completedAt` fields. Asserted directly in `shared/__tests__/fixture-history.test.ts`.

## Combination evidence

`b08CombinationEvidence` (the Noah/Sindre LCM-RCM partnership behind the 48' winner) is a
hand-written literal — **never computed inline** in this module, since the real
`deriveCombinationsFromSegments()` lives in a server-only module
(`combination-topology.ts`/`combination-aggregation.ts`) that would pull `db`/`pg`/Node builtins
into this page's client bundle if imported by value (the exact real CI `Build` failure class
documented in `CURRENT_STATE_AUDIT.md` §7, already hit once by B05). The literal is independently
verified byte-for-byte (except the non-deterministic `createdAt` stamp) against the real function's
own output for the same input, in `shared/__tests__/combination-evidence.test.ts` — mirroring B05's
own `combination-evidence.test.ts` exactly.

## Event persistence scope — `shared/b08-journey.ts` (v2)

A real, versioned, B08-namespaced `sessionStorage` blob (key `b08-live-journey-v2`) — never a
general-purpose event-sourcing system. Scope and lifetime:

- **Tab/session-scoped**: `sessionStorage` never crosses browser tabs, never reaches a server,
  never survives closing the tab. Cleared automatically by the browser; also clearable on demand
  via the scenario navigator's own "Reset journey" dev control (clears BOTH the LIVE ledger and
  the reconciled report in one call).
- **Reference-snapshot mode is the default**: every CI/Playwright capture gets a brand-new browser
  context (`scripts/ui-lab-visual-review.mjs` calls `browser.newContext()` fresh per scenario/
  viewport/theme), so `loadB08Journey()` returns `null` and every page renders the unchanged
  canonical fixture — the pre-remediation behavior, provably unaffected.
- **Interactive-journey mode** only activates once a real browser session records an event on
  B08-LIVE; an **unfinished** journey (the coach never clicked "Finish live reporting") is never
  read by REPORT-DRAFT — `loadFinishedB08JourneyEvents()` returns `null` until `markB08JourneyFinished()`
  has actually run.
- **Second remediation (2026-11-08): the reconciled REPORT is now ALSO persisted**, not just the
  raw LIVE ledger — `B08PersistedReportState`, written via `SafePostMatchReportShell`'s new
  `onStateChange` callback (a skip-first-render guard prevents a bare mount from echoing the
  initial state back out as a fake "edit" — see `SOURCE_RECONCILIATION.md`). AFTER, REPORT-DRAFT
  and REPORT-COMPLETED all read this SAME persisted report when it exists, in that priority order
  ahead of a raw-events-only seed, ahead of the reference fixture — see "The shared projection"
  below.
- **Storage key bumped `-v1` → `-v2`** as the explicit version increment: a v1 blob (from the
  first remediation pass) is simply never read — the safest migration for a client-only,
  tab-scoped, dev-fixture store (no partial-read risk, no crash, starts fresh).
- **Deterministic replay**: `wallClockTime`/`clientEventId` are revived/normalized on load to match
  `LiveEventSummary`'s real type (`Date | null` / `string | null`) — `JSON.stringify` silently drops
  `undefined` keys and turns `Date` into an ISO string; both were real round-trip bugs found and
  fixed while testing this module.
- **Isolation**: a clearly synthetic `matchId` (`b08-fixture-live-match`, distinct from
  `B08_MATCH_ID`) keeps the fixture's own real-but-harmless browser-local IndexedDB outbox
  (`live-local-store.ts`) and service-worker registration from ever colliding with a real match's
  local rows on the same device (`BLOCKERS.md` item #3).

## The shared projection — `shared/b08-projection.ts`

"One authoritative event ledger, multiple read models" (the review's own framing): every
interactive-mode derivation across LIVE's follower, REPORT-DRAFT, REPORT-COMPLETED and AFTER starts
from `computeEffectiveLiveEvents()`'s own output, never a second, independently-filtered pass.

- **`computeEffectiveLiveEvents()`** mirrors the REAL production reversal-filtering algorithm
  exactly — confirmed by reading `get-match-detail-after-data.ts` directly (two real Prisma
  queries: one for relevant event types, one for `EVENT_REVERSED` rows, then an in-memory filter),
  not reimplemented from guesswork. A reversed event — and the `EVENT_REVERSED` marker itself —
  never appears in the effective set. `EVENT_REVERSED.correctsEventId` references the target's own
  `id` (confirmed against `LiveMatchClient.handleUndo()`), a DIFFERENT reference namespace than
  `SCORER_SET`/`ASSIST_SET.correctsEventId`, which references the goal's own `clientEventId` — the
  two are never conflated (a dedicated negative test proves reversing via the wrong namespace
  reverses nothing).
- **`deriveEffectiveScore()`/`deriveGoalsAndAssists()`/`deriveEffectiveTimeline()`** all operate on
  the effective set — an unattributed goal (scorer skipped) stays genuinely unattributed, a
  reversed goal contributes nothing, a real `buildMatchTimeline()` (never a second chronology
  builder) produces the chronology.
- **`deriveB08AfterDataFromReport()`/`deriveB08IdentityFromReport()`** build the real
  `MatchDetailAfterData`/`MatchPresentation` shapes every page already consumes — from a persisted
  report, not a second rendering path. Narrative/evidence fields authored for the FIXED 2-1
  reference match (reflection, football observations, opponent observation, combination evidence)
  are deliberately empty/null here, and the Assistant Coach panel switches to its own real
  `{status: "unavailable"}` state — per the review's own explicit guidance, "mark reference-only
  observations as unavailable in the interactive journey," never fabricated against a different
  history.
- **`markReversedEvents()`** is the one exception to "filter, don't mark": LIVE's own Recent Events
  panel must keep SHOWING a reversed event (with its real `isReversed` badge, Undo control
  correctly hidden) rather than removing it — production computes this server-side; B08's fixture
  has no server, so `getRecentEvents()` computes it the same way, without filtering.

## Test coverage summary

| File | What it proves |
|---|---|
| `shared/__tests__/fixture.test.ts` | Stable identity, chronological ordering, format consistency, literal ms-unit contract values, clock period-relative round-trips. |
| `shared/__tests__/fixture-history.test.ts` | Score-to-goal-event consistency, DRAFT/COMPLETED data parity, the timing-review gap's shape, literal matchSeconds values against the real production contract. |
| `shared/__tests__/combination-evidence.test.ts` | The hand-written combination-evidence literal matches the real derivation function's output. |
| `shared/__tests__/ownership-map.test.ts` | The ownership map's content matches the audited matrix (also its deadcode:check consumer). |
| `shared/__tests__/safe-transition-controller.test.ts` | The LIVE clock fix (fed through the real `getElapsedMs()`/`formatElapsedMs()`), and the journey store's real persistence/restore/reset behavior, including a second hook instance resuming a prior session exactly. |
| `shared/__tests__/b08-projection.test.ts` | The full required test matrix (reference/1-1/2-1/unattributed/reversed/duplicate), literal expected values, the reversal-namespace distinction, and that reference-only narrative never leaks into an interactive projection. |

Full run: `npx vitest run --config vitest.config.components.ts src/app/dev/ui-lab/gate-b/b08-information-ownership/`
→ **7 files, 71 component tests, all passing**, plus `npx vitest run
src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/__tests__/` → **5 files, 62 fixture/
projection tests, all passing** (component-test config required for the `.tsx` files — a bare
`vitest run` silently skips them in this repo). Real browser coverage: `e2e/ui-lab-b08.spec.ts`,
51 tests including Journeys A/B/E (full LIVE→REPORT-DRAFT→AFTER→REPORT-COMPLETED consistency for
both a 1-1 and a 2-1 interactive journey, plus reference-mode isolation) — see
`TRANSITION_AND_NAVIGATION_CONTRACT.md`.
