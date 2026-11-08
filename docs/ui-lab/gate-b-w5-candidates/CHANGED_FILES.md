# Gate B W5 — Changed Files (B08)

**Updated for the W5 remediation (independent PR #822 review, 2026-11-08)** — see the new
"Remediation" sections below. The original implementation's own file list (as of the first PR push)
is preserved above them for history.

## New — candidate source

- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/fixture.ts`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/fixture-history.ts`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/ownership-map.ts`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/transition-nav.tsx`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/safe-transition-controller.ts`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/before/page.tsx`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/live/page.tsx`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/after/page.tsx`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/report-draft/page.tsx`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/report-completed/page.tsx`

## New — tests

- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/__tests__/fixture.test.ts`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/__tests__/fixture-history.test.ts`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/__tests__/combination-evidence.test.ts`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/__tests__/transition-nav.test.tsx`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/before/__tests__/page.test.tsx`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/live/__tests__/page.test.tsx`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/after/__tests__/page.test.tsx`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/report-draft/__tests__/page.test.tsx`
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/report-completed/__tests__/page.test.tsx`

## Modified — shared component (additive only)

- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/safe-post-match-report-shell.tsx` — added
  an optional `backHref` prop (default preserves B05's exact existing hardcoded href unchanged), so
  B08's report pages can point "back to match" at their own `/after` route instead of B05's. B05's
  own 22 existing tests re-run unchanged and still pass.

## Modified — registration

- `src/app/dev/ui-lab/gate-b/page.tsx` — registered all 5 B08 candidate links; updated the
  programme-status note (B08 implemented, no scenarios remain deferred).
- `scripts/ui-lab-visual-review.mjs` — registered all 5 B08 routes for CI visual capture
  (`gate-b-w5-b08-{before,live,after,report-draft,report-completed}`), a new `b08ExtraViewports` set
  (adds 600/768/900px for the three tab-rail/dense-layout pages), and one new interaction helper
  (`completeB08DraftFlow`, reusing the real shared report shell's own "Confirm duration"/"Complete
  report" controls, mirroring B05's own interaction-helper pattern) — explicitly to avoid repeating
  B06's own B5/R7 finding (new pages shipped with zero capture evidence because they were never
  added to this array).

## New — W5 documentation set (this directory)

- `CURRENT_STATE_AUDIT.md`, `INFORMATION_OWNERSHIP_MATRIX.md`, `SCENARIO_REGISTER.md`,
  `DATA_TRUTH_AND_FIXTURES.md`, `TRANSITION_AND_NAVIGATION_CONTRACT.md`,
  `INTERACTION_AND_STATE_AUDIT.md`, `VISUAL_VS_CURRENT.md`, `SOURCE_RECONCILIATION.md`,
  `THREE_PART_EXPERIENCE_CONTRACT.md`, `BLOCKERS.md`, `REVIEW_RECORD.md`, `CHANGED_FILES.md` (this
  file), `candidate_manifest.json`, `capture-attestation.json` (placeholder — see `BLOCKERS.md`).

## Remediation — new candidate source

- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/b08-journey.ts` — new, the
  sessionStorage-backed interactive-journey store (P1-6).

## Remediation — modified candidate source

- `shared/fixture.ts` — `globalMinuteToPeriodRelative()` ms-unit fix (P1-3); added
  `periodRelativeToGlobalMinute()` (its inverse, used by the journey derivation).
- `shared/fixture-history.ts` — added `b08GoalsAndAssistsFromJourney()` (P1-6).
- `shared/safe-transition-controller.ts` — LIVE clock fix (P1-2); `toGlobalMinute()` now uses the
  shared inverse function; `recordEvent`/`endSession` now persist to the journey store.
- `shared/transition-nav.tsx` — added a dev-only "Reset journey" control.
- `before/page.tsx` — unchanged in substance; re-verified against the clock/journey fixes.
- `live/page.tsx` — follower summary now derived from the real event ledger (P2-9).
- `after/page.tsx` — `?report=completed` variant switch (P1-5); `MatchAfterMatchPanel`'s
  `reportHrefOverride` wired in (P2-8).
- `report-draft/page.tsx` — `backHrefForStatus`/`onStatusChange` wired in (P1-5); journey-derived
  goals/score when a finished journey exists (P1-6).
- `report-completed/page.tsx` — back-links now carry `?report=completed` (P1-5).

## Remediation — new/modified tests

- New: `shared/__tests__/safe-transition-controller.test.tsx` (clock + journey persistence).
- New: `src/components/ui/__tests__/tab-rail.test.tsx` (overflow containment).
- New: `e2e/ui-lab-b08.spec.ts` (real browser — navigation, continuity, 40-point overflow matrix).
- Modified: `shared/__tests__/fixture.test.ts`, `fixture-history.test.ts` — literal ms-unit
  assertions.
- Modified: `after/__tests__/page.test.tsx`, `report-draft/__tests__/page.test.tsx`,
  `report-completed/__tests__/page.test.tsx`, `live/__tests__/page.test.tsx` — remediation coverage
  (P1-5, P1-6, P2-8, P2-9).

## Remediation — modified shared production components (additive only)

- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/safe-post-match-report-shell.tsx` — added
  `backHrefForStatus`/`onStatusChange` (both optional; default preserves the exact prior behavior).
- `src/components/matches/match-detail/match-after-match-panel.tsx` — added `reportHrefOverride`
  (optional; default preserves the exact prior `orgUrl(...)` behavior for every production call
  site — verified only `match-detail-shell.tsx` calls it in production, without this prop).
- `src/components/ui/tab-rail.tsx` — pill variant overflow containment (additive classes only).

## Remediation — CI/tooling

- `scripts/ui-lab-visual-review.mjs` — added a `document.scrollWidth` overflow gate (fails for Gate
  B, warns elsewhere).
- `playwright.config.ts` — new `ui-lab-b08` project (no auth dependency), excluded from the default
  `chromium` project's scope.
- `.github/workflows/ui-lab-visual-review.yml` — new step running the `ui-lab-b08` Playwright
  project against the same local server the capture step already starts; timeout bumped 35→45min.

## Second remediation — new candidate source (lifecycle data consistency, 2026-11-08)

- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/b08-projection.ts` — new. The single
  shared fixture-local projection: reversal-aware effective-event computation
  (`computeEffectiveLiveEvents`, mirroring production's own `EVENT_REVERSED` filtering algorithm
  exactly), `markReversedEvents` (display-only marking for Recent Events), score/goals/assists/
  timeline derivation, and the two report-mode builders (`deriveB08AfterDataFromReport`,
  `deriveB08IdentityFromReport`) that AFTER/REPORT-DRAFT/REPORT-COMPLETED now all share.
- `src/app/dev/ui-lab/gate-b/b08-information-ownership/shared/__tests__/b08-projection.test.ts` —
  new, 11 tests, the required projection-integrity matrix (reference, LIVE-cutoff, finished-no-goal,
  scorer-skipped, scorer-assigned, reversal, wrong-namespace-reversal negative test, duplicate-event,
  completed 1-1/2-1, timeline chronology).

## Second remediation — modified candidate source

- `shared/b08-journey.ts` — bumped to a v2 `sessionStorage` key; added `B08PersistedReportState` and
  `loadB08JourneyReport()`/`saveB08JourneyReport()` so a reconciled report survives navigation and
  reload; `resetB08Journey()` now clears both the LIVE ledger and the persisted report.
- `shared/fixture-history.ts` — removed the superseded, non-reversal-aware
  `b08GoalsAndAssistsFromJourney()` (replaced by `b08-projection.ts`).
- `shared/safe-transition-controller.ts` — `getRecentEvents()` now marks `isReversed` via
  `markReversedEvents()` instead of returning the raw ledger.
- `live/page.tsx` — follower score now goes through `computeEffectiveLiveEvents`/
  `deriveEffectiveScore` (reversal-aware), not a naive event-type count.
- `after/page.tsx` — now resolves data via the shared three-tier cascade (persisted report → finished
  journey seed → reference fixture); the `?report=` URL param is only honored in the no-journey tier;
  Assistant Coach uses the real `AdvisorPanelUnavailable`/`{status:"unavailable"}` state in
  interactive mode instead of showing the fixed reference insight.
- `report-draft/page.tsx` — same three-tier cascade; new `onStateChange` wiring persists every real
  edit back into `b08-journey.ts`.
- `report-completed/page.tsx` — reads the same persisted report when present; renders it honestly as
  DRAFT-editable (not fabricated COMPLETED) if it was never actually locked.

## Second remediation — modified shared production component (additive only)

- `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/safe-post-match-report-shell.tsx` — added
  an optional `onStateChange` prop plus a skip-first-render guard (a bare mount no longer echoes
  `initialLocalState` back out as a fake edit — a real bug caught and fixed during this pass, before
  it could silently start a persisted journey on every page visit, including CI captures). B05's own
  existing tests re-run unchanged and still pass.

## Second remediation — modified/new tests

- New: `shared/__tests__/b08-projection.test.ts` (see above).
- Modified: `report-draft/__tests__/page.test.tsx` — migrated two journey-seeding tests to the v2
  schema; added a file-level `sessionStorage.clear()` in `beforeEach` (jsdom shares one
  `sessionStorage` across tests in a file; several tests that genuinely complete a report were
  leaking that state into later, unrelated tests).
- Modified: `report-completed/__tests__/page.test.tsx`, `after/__tests__/page.test.tsx` — same
  `sessionStorage.clear()` fix.
- Modified: `e2e/ui-lab-b08.spec.ts` — extended the existing LIVE-to-report continuity describe block
  with Journeys A (1-1 finish), B (2-1 recorded goal), and E (reference-mode isolation / reset).
  Journey C (goal reversal, browser-level) was deliberately not added — see `BLOCKERS.md` for the
  disclosed reason; Journey D (duplicate/correction) is satisfied at the projection level per the
  review's own framing, by `b08-projection.test.ts`.

## Not touched

B01-B07 candidate source and documentation (`gate-b-w1/w2/w3/w4-candidates/`, `b01`-`b07` route
directories) are unmodified except for the additive shared-component props listed above, all
backward-compatible and re-verified against B05/B06/B07's own test suites plus every other
production consumer. No production route, component, data loader, AI capability, or server action
was changed. No database migration, no new server-side persistence, no new AI pipeline. The one
genuinely new persistence mechanism (`b08-journey.ts`) is client-only `sessionStorage`, explicitly
bounded to B08's own five routes.
