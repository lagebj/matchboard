# Gate B W5 — Interaction and State Audit (B08)

**Updated for the W5 THIRD remediation (independent PR #822 review, 2026-11-08, "final
data-integrity remediation").** Component/unit-level coverage below, PLUS real Chromium browser
coverage in `e2e/ui-lab-b08.spec.ts` (53 tests — the independent review's own section 11 explicitly
treats unit tests as insufficient proof for navigation/continuity/layout claims; see that file and
`TRANSITION_AND_NAVIGATION_CONTRACT.md`).

Component tests: `npx vitest run --config vitest.config.components.ts
src/app/dev/ui-lab/gate-b/b08-information-ownership` → **7 files, 82 tests, all passing**
(component-test config required — a bare `vitest run` silently skips `.tsx` tests in this repo).

## B. Information ownership

- AFTER: Overview shows the final result and a bounded match-story preview, **not** the full Events
  tab content inline; the Events tab itself shows the full canonical chronology; the Stats tab owns
  per-scorer/per-assist attribution.
- AFTER: Overview's team reflection renders as an attributed coach observation, not a measured fact;
  its Assistant Coach content is visually distinguishable (own labelled, evidence-sourced widget).
- AFTER: **the §3 correction is directly asserted** — Overview's report-status widget is a status
  pill + link only, with no reflection/timing/out-of-range detail duplicated; the After-match tab
  is asserted as the full report-status/integrity owner instead.
- AFTER: a structural-guarantee test asserts the page never imports a report-mutation module —
  editing is only reachable from the report workspace.
- REPORT-DRAFT/-COMPLETED: Players tab default (DRAFT) vs. Summary tab default (COMPLETED), Review
  tab DRAFT-only / Combinations tab COMPLETED-only, reflection shown read-only and attributed.

## C. Lifecycle and navigation

- Every one of the 5 pages has its own "no `href=\"#\"` / no fake navigation" structural test.
- BEFORE: "Start live reporting" asserted as a real working link into `/live`.
- AFTER: the primary "Continue report" action asserted as a real link into `/report-draft`.
- REPORT-DRAFT: "Back to match" asserted routing to this candidate's own `/after`, never another
  match's.
- REPORT-COMPLETED: "Back to match" asserted routing to `/after` (the historical Overview — no
  separate historical page), and `?tab=review` asserted to fall back to the real default without
  showing stale Review content once locked.
- `shared/__tests__/transition-nav.test.tsx`: all 5 real route links render and the current stage is
  marked distinguishably, parameterized across all 5 stages in one test; a second test asserts none
  of the 5 real candidate pages contain a literal `href="#"` or an onClick-only fake link, run once
  across all five as a single structural guarantee.

## D. Mutation safety

- REPORT-DRAFT: completion is asserted to **reject** while timing still needs review (state
  unchanged), and to succeed once the real timing-resolution action runs — both against the real
  `useSafeReportLifecycle` reducer, not a mock.
- REPORT-DRAFT: a successful local reconciliation is asserted to update every dependent
  presentation together (score, goals, attendance) in one test — the exact reconciliation discipline
  B05 already established and this wave must not regress.
- REPORT-COMPLETED: asserted LOCKED with no active edit control reachable on the Players tab; the
  finalized content is asserted identical to the draft's goals/assists/attendance (finalization
  doesn't silently change facts).
- LIVE: a structural-guarantee test asserts the fixture-local actions hook never imports the real
  realtime hook or either production live adapter.
- AFTER/LIVE both carry their own "never imports [the real mutating module]" structural guarantee,
  mirroring the same discipline applied on REPORT-DRAFT's completion-safety side.

## E. Accessibility

- Every page: exactly one `<h1>` (the two Report pages correctly have two headings total — the
  page's own `<h1>` plus the real shared shell's own match-title `<h1>`, the same established
  B05/B06 pattern, not a new defect).
- `B08TransitionNav`: asserted visually distinct dev-only chrome (never mistaken for a production
  action), and its current-stage indicator is asserted exposed to assistive tech, not color-only.
- BEFORE: scenario-navigator current-stage marking is explicitly asserted exposed to assistive tech.

## F. Remediation-specific coverage (W5, independent review)

- **P1-2/P1-3 (clock/timestamp units)**: `shared/__tests__/safe-transition-controller.test.ts`
  feeds the fixture's clock output through the REAL `getElapsedMs()`/`formatElapsedMs()`
  (`match-clock.ts`), using `vi.setSystemTime` for deterministic replay — asserts exactly 15:00
  elapsed (not 45:00) and no false over-duration warning. `fixture.test.ts`/`fixture-history.test.ts`
  assert literal millisecond values independent of the conversion function itself.
- **P1-4 (mobile overflow)**: `src/components/ui/__tests__/tab-rail.test.tsx` asserts the
  containment classes are present (structural proof); real pixel/scroll-width proof is
  `scripts/ui-lab-visual-review.mjs`'s own new overflow gate (fails for any Gate B scenario) plus
  `e2e/ui-lab-b08.spec.ts`'s 40-test width matrix (5 scenarios × 8 widths, 320-1440px).
- **P1-5 (completed-report state on return)**: `after/__tests__/page.test.tsx`'s
  `?report=completed` describe block (5 tests) and `report-completed/__tests__/page.test.tsx`
  assert the back-links/heading/status/primary-CTA all reflect the real locked state; `report-draft/
  __tests__/page.test.tsx` asserts BOTH back-links switch to `?report=completed` once the report is
  completed in place. Verified end-to-end in a real browser in `e2e/ui-lab-b08.spec.ts`.
- **P1-6 (LIVE-to-report continuity)**: `safe-transition-controller.test.ts` asserts real
  sessionStorage persistence (recordEvent survives beyond this component's own React state, a
  second hook instance restores exactly where the first left off, an unfinished journey is not
  readable, reset works). `report-draft/__tests__/page.test.tsx`'s journey describe block asserts a
  seeded finished journey changes the rendered score/goals (1-1 vs the fixed 2-1) and an unfinished
  one is ignored. `live/__tests__/page.test.tsx`'s P2-9 block proves a real `fireEvent.click` on
  "Goal for us" updates the follower score. All of this is additionally proven end-to-end with real
  browser navigation in `e2e/ui-lab-b08.spec.ts`.
- **P2-8 (secondary report link)**: `after/__tests__/page.test.tsx` asserts `MatchAfterMatchPanel`'s
  own "Continue report"/"View full report" link resolves to this candidate's own route in both the
  draft and completed variants — no production-shaped URL remains reachable.
- No regression: the existing B05/B06/B07 test suites (84 tests), plus every other TabRail consumer
  across Match Details/Report/Team/Event and all Gate A/B waves (102 files, 645 tests total), were
  re-run after the shared-component changes (`safe-post-match-report-shell.tsx`'s `backHref`/
  `backHrefForStatus`/`onStatusChange`, `match-after-match-panel.tsx`'s `reportHrefOverride`,
  `tab-rail.tsx`'s overflow containment) — all still pass.

## G. Second remediation-specific coverage (W5, "lifecycle data consistency", 2026-11-08)

- **Shared projection integrity**: `shared/__tests__/b08-projection.test.ts` (11 tests, literal
  expected values throughout) — reference 2-1, LIVE cutoff 1-1, finished-without-goal 1-1,
  scorer-skipped unattributed goal, scorer-assigned attributed goal, reversal back to 1-1 (with an
  explicit assertion that the correct `EVENT_REVERSED`→target-`id` namespace is used, plus a
  dedicated negative test proving a `SCORER_SET`/`ASSIST_SET`-namespaced `correctsEventId` does
  **not** reverse anything), a duplicate-delivery case (the same event object appearing twice changes
  nothing), and completed-report AFTER-data derivation for both 1-1 and 2-1, including timeline
  chronology.
- **Report mutation/completion persistence**: `report-draft/__tests__/page.test.tsx` asserts
  `onStateChange` round-trips through `saveB08JourneyReport()`/`loadB08JourneyReport()` and that a
  reload resumes the exact persisted state (not the seed). A dedicated test asserts the shell's own
  mount does NOT fire `onStateChange` (the skip-first-render-guard regression this pass caught and
  fixed) — visiting the page with no prior edit leaves no persisted report behind.
- **REPORT-COMPLETED honesty**: `report-completed/__tests__/page.test.tsx` asserts a persisted report
  that was never actually locked renders as the real shell's own DRAFT-editable surface, not a
  fabricated COMPLETED state.
- **AFTER authority over its own `?report=` param**: `after/__tests__/page.test.tsx` asserts that
  once a persisted report exists, the `?report=` URL value is ignored and the persisted
  state's own status determines the rendered variant; only with no persisted report at all does the
  URL switch the reference variant, exactly as before this pass.
- **Narrative non-leakage**: `after/__tests__/page.test.tsx` asserts reflection/observations/
  combination-evidence render as their existing "Not recorded"/empty null-state UI (not the fixed
  reference match's own content) whenever an interactive journey is active, and that the Assistant
  Coach panel renders the real `AdvisorPanelUnavailable` state instead of the reference insight.
- **Test-isolation fix**: `report-draft/__tests__/page.test.tsx`, `report-completed/__tests__/
  page.test.tsx`, and `after/__tests__/page.test.tsx` each gained a file-level
  `beforeEach(() => window.sessionStorage.clear())` — jsdom shares one `sessionStorage` across every
  test in a file, and several tests that genuinely complete a report were leaking that state into
  later, unrelated "reference mode" tests before this fix.
- **Browser journeys (real, Chromium, `e2e/ui-lab-b08.spec.ts`)**: Journey A (finish LIVE without a
  goal → 1-1 persists through REPORT-DRAFT → completion → AFTER → REPORT-COMPLETED → reload), Journey
  B (same chain for a recorded 2-1), Journey E (a fresh context sees the unchanged 2-1 reference
  directly; starting and finishing an interactive 1-1 journey then using "Reset journey" restores the
  2-1 reference). Journey C (a real browser Undo) and Journey D (a direct reference-report edit) were
  deliberately NOT added in this second pass — see `BLOCKERS.md` for the disclosed reasoning at the
  time; both are now added in the third remediation pass, see section H below.
- No regression: the first remediation's full existing suite (above) was re-run unchanged after this
  pass's changes and still passes.

## H. Third remediation-specific coverage (W5, "final data-integrity remediation", 2026-11-08)

- **History provenance (defect #1)**: `shared/__tests__/b08-projection.test.ts`'s
  `resolveB08EffectiveHistory` describe block (4 tests, literal expected values) — a `"REFERENCE"`
  origin (or no journey at all) always resolves the real canonical chronology/goal-count/team-note,
  never an empty derivation; a `"LIVE_JOURNEY"` origin with a real ledger resolves exactly what was
  recorded. `report-draft/__tests__/page.test.tsx`'s new describe block proves the same at the page
  level: editing the reference report directly (Confirm duration) and reloading preserves the real
  10'/22'/48' chronology, the 2-1 score, and the real narrative (not an interactive-looking
  derivation); a LIVE_JOURNEY-origin seed correctly shows NO reference-only narrative.
- **Narrative provenance in the shared report shell (defect #2)**: both `report-draft`/
  `report-completed` pages now choose `debriefAnswers`/`debriefStatus`/`footballObservations`/
  `combinationEvidence`/`observationCountByParticipant` by the same `isInteractiveJourney` flag
  `after/page.tsx` already used — proven by the report-draft describe block above (the LIVE_JOURNEY
  seed test specifically asserts the reference debrief's own text is absent).
- **Idempotent event recording (defect #3)**: `shared/__tests__/safe-transition-controller.test.tsx`'s
  "idempotent event recording" describe block (8 tests) — new goal accepted once; an identical retry
  (same `clientEventId`) is a no-op returning the SAME real id; a second hook instance (reload) retry
  is also a no-op; a conflicting retry (same `clientEventId`, different content) is rejected with the
  first event untouched; two distinct goals both accept; a retried identical reversal applies once;
  a retried scorer correction applies once; a distinct assist is a normal, separate append.
- **Shared-shell B05-specific internals (defect #4)**: `safe-post-match-report-shell.tsx`'s own
  existing B05 test suite (unchanged) re-verifies the five new optional props all default to B05's
  exact existing values; B08's own `report-draft`/`report-completed` tests implicitly exercise the
  B08-specific values (B08 player names/ids already asserted present throughout the existing suite).
- **LIVE Undo real-browser verification (defect #5)**: `safe-transition-controller.test.tsx`'s own
  dedicated test proves the `EVENT_REVERSED`/`clientEventId` normalization directly (an Undo recorded
  against a not-yet-confirmed row's `clientEventId` is still correctly resolved to the real target
  id). `e2e/ui-lab-b08.spec.ts`'s new Journey C exercises the full real-browser path: record a goal,
  Undo it through the real mounted `LiveMatchClient`'s own Recent Events panel, verify reporter and
  follower scores agree before and after, verify the "reversed" marker and the Undo control's own
  removal (with an explicit, documented wait spanning the real 5-second `fetchEvents()` poll
  interval — not an arbitrary sleep), then verify the reversed goal never resurfaces through
  REPORT-DRAFT, AFTER, REPORT-COMPLETED, or a reload.
- **Journey D (a direct reference-report edit, no LIVE journey at all)**: proves defect #1's fix
  end-to-end in a real browser — the real chronology survives on REPORT-DRAFT's own Timeline tab,
  AFTER's Events and Stats tabs (not only its Overview score), and REPORT-COMPLETED's Timeline tab,
  across a completion and a reload; the real Assistant Coach insight (narrative) stays present,
  proving it is not incorrectly withheld for a reference-origin edit.
- No regression: the first and second remediation passes' full existing suites (sections A-G above)
  were re-run unchanged after this pass's changes and still pass.
