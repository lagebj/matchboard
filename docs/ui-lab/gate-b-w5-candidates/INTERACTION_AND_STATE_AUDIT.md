# Gate B W5 — Interaction and State Audit (B08)

51 component tests across 6 files (`npx vitest run --config vitest.config.components.ts
src/app/dev/ui-lab/gate-b/b08-information-ownership` → **6 files, 51 tests, all passing**, plus the
46 fixture-level tests in `DATA_TRUTH_AND_FIXTURES.md`), organized by the task brief's own test
sections.

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

## Known test-writing findings (disclosed here, cross-referenced in `BLOCKERS.md`)

- `after/page.tsx`'s reused `MatchAfterMatchPanel` has its own secondary report-status link that
  resolves outside the UI Lab (see `TRANSITION_AND_NAVIGATION_CONTRACT.md`'s "Known gap"). Not
  fixed; the page-level primary CTA is correctly tested and wired.
- No regression: the existing B05/B06/B07 test suites (84 tests) were re-run after the one shared
  shell change (`safe-post-match-report-shell.tsx`'s new optional `backHref` prop) — all 84 still
  pass.
