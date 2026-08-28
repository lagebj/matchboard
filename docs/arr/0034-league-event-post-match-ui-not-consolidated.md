# ARR-0034: League and Event post-match report UI are not consolidated

## State

Resolved

## Identified

2026-08-28 (Event Evidence Parity, Shared Post-Match Reporting, and Historical Opponent
Learning Catch-Up programme, ADR-0104)

## Residue

ADR-0104 unified the *backend* post-match learning pipeline (opponent/player/combination
evidence, actual-timeline reconstruction) across League and Event matches — one canonical
algorithm per evidence type, source-agnostic via `FootballMatchRef`. It also resolved
report-*completion* ownership (ARR-0030): `completeEventReport()` now mirrors League's
`completeReport()` shape.

The *UI* was initially left unconsolidated in that same work: League's post-match report page
assembled its score/goals/assists/attendance/lifecycle controls inline in one large component
(`PostMatchPage`), and Event's equivalent (`EventMatchReportPanel`) independently hand-rolled
the same concepts with different markup, no shared type, and materially fewer capabilities
(no participant add/remove at all). This was first recorded as deferred, then actually resolved
the same day once the "cannot verify in this environment" assumption blocking it turned out to
be false (see "Verification note" below) and the effort itself was judged not a valid reason to
leave a real gap unresolved.

## Intended architecture

One shared post-match report shell (League and Event as adapters supplying data and an actions
interface, with a `capabilities` flag set for genuine differences) — delivered.

## What was built

- **`src/lib/reports/post-match-report-view-model.ts`** — the canonical
  `PostMatchReportViewModel`, `PostMatchReportActions`, `PostMatchReportCapabilities`,
  `PostMatchAvailablePlayer` types. `ourScore`/`opponentScore` are always from the coach's own
  team's perspective regardless of League's underlying home/away-goals storage — League's
  adapter translates in both directions; Event's storage already matches directly.
- **`src/components/matches/post-match-report-shell.tsx`** — the shared `PostMatchReportShell`
  component: status/lifecycle actions (Complete/Submit/Lock/Reopen, gated by
  `capabilities.hasSubmitLockSteps`), Result, Goals, Assists, and Attendance (list with
  attendance-status control, remove, and — new — add-player). Renders an `extraSections` slot
  after Attendance for source-specific additions.
- **League** (`src/components/assistant/post-match-page.tsx`, rewritten): builds the
  viewModel/actions from its existing `MatchReportDetail` data and existing server actions, uses
  the shell for the shared core, and renders its own `extraSections`: Team notes, Planned squad,
  Planned absences, Mark planned absence, Player stats — none of which have an Event equivalent
  (see "Decisions" below).
- **Event** (`src/app/(app)/events/[eventId]/event-match-report-panel.tsx`, rewritten): builds
  its viewModel/actions from `EventPostMatchReport` data and Event server actions, uses the same
  shell, and renders its own `extraSections`: Team reflection, Opponent observation, Notes (all
  still free-text — see "Decisions"), Football observations, and (locked-only) combination
  evidence.
- **New Event capability — participant add/remove** (resolution criteria #3):
  `addEventMatchPlayerAction`/`removeEventMatchPlayerAction`
  (`src/app/(app)/events/event-post-match-actions.ts`), mirroring League's
  `addActualPlayer`/`removeActualPlayer` (`capabilities.hasUnplannedReason: false` — Event has no
  unplanned-appearance-reason concept). Verified working end-to-end in-browser (see below).

## Decisions (documented, not silent — resolution criteria #3)

- **Structured absence does not extend to Event.** League's `MarkPlannedAbsence`/
  `MatchReportAbsence` concept depends on a planned-squad-vs-actual diff Event has no equivalent
  of (Event's squad assignment is already flexible pre-match, not a fixed "plan" to diff
  against). Event's existing `attendanceStatus` enum (`PRESENT`/`NO_SHOW`/`UNKNOWN`, plus
  `LATE_ADDITION`/`WITHDRAWN` at the schema level) remains the only absence signal for Event.
- **Structured opponent observation and team reflection do not extend to Event.** Neither
  `OpponentEncounterObservation` nor `TeamReflection` is an evidence-algorithm input (verified
  during ADR-0104: `recordOpponentSportingEvidenceForRef` never reads either), so they were never
  required by Goal 1. Event keeps its existing free-text `opponentObservation`/`teamReflection`/
  `notes` fields, now rendered inside the shared shell's `extraSections` rather than bespoke
  markup, but not restructured into League's structured models. Revisit only if a future need for
  structured Event opponent/reflection data is identified — not implied by anything in this
  programme.
- **Player stats and the planned-squad/absence diff stay League-only sections**, rendered via
  `extraSections`, since Event's squad has no "planned" concept distinct from what's on the
  report, and Event's goals/assists are already the authoritative per-player stat source (no
  separate `playerStats` aggregate table for Event).

## Verification note (2026-08-28)

Browser verification of this exact UI **was** performed in-session, correcting an earlier
(wrong) assumption that no browser was available here. Working local setup: seed the canonical
test dataset (`npm run db:seed:test`, targets `TEST_DATABASE_URL`), run `next dev` with
`MATCHBOARD_ENV=test TEST_AGENT_AUTH_ENABLED=true DATABASE_URL=$TEST_DATABASE_URL` pointed at
that same database, install a Playwright browser once (`npx playwright install chromium
--with-deps`), then drive it with `PLAYWRIGHT_BASE_URL=http://localhost:3333 npx playwright
test` (see `docs/development/browser-acceptance-testing.md`, which already documented this local
mode — it was simply not tried before this was first written).

Using this, both the League and Event post-match pages were confirmed to render and function
correctly end-to-end against real evidence data, through real UI interaction (not just static
rendering): editing the score, adding/removing a goal, adding a new player to attendance via the
new shared "Add player" control, and clicking "Complete report" through to a real `LOCKED` state
with the correct source-specific lifecycle controls shown (League: Submit/Lock/both Reopen
variants; Event: Complete/Reopen-as-draft only). Screenshotted and inspected at each step.

That same verification pass found and fixed three real, pre-existing bugs (none caused by
ADR-0104's changes, all surfaced only by actually rendering the pages) before the shell rewrite
began:
- `FootballObservationSection` showed nothing at all once a report locked (existing-observation
  display was nested inside the `!isLocked` branch) — fixed, now shown read-only when locked, on
  both League and Event.
- `computeAndApplyPlayerEvidenceForMatch`'s `SKIPPED` reason was `NO_FOOTBALL_OBSERVATIONS` even
  when observations existed but hadn't crossed `evidence-accumulator.ts`'s
  `MINIMUM_DISTINCT_MATCHES` (2) threshold yet — fixed by returning `observationsFound` and
  adding a distinct `INSUFFICIENT_DISTINCT_MATCHES` reason.
- Event's attendance table's "Source" column always rendered blank —
  `EventPostMatchPlayer.playerReports[].source` referenced a field that doesn't exist on the
  Prisma model — removed the dead column (superseded anyway once the shell replaced the table).

A separate, unrelated pre-existing issue was also surfaced (React hydration warning: a nested
`<form>` inside another `<form>` in `ObservationSection`, League's opponent-observation
component) — not fixed here, since `ObservationSection` was not otherwise touched by this ARR
and the warning predates it; left for a future pass on that component specifically.

One permanent, UI-driven regression test exists for the shared shell:
`e2e/post-match-evidence-parity.spec.ts` (League: create → finalize → live-report a goal → end
session → complete report → assert LOCKED, proving `runPostMatchLearning()` runs without error
through the real UI). No Event-side equivalent was added — League's flow could reuse
`e2e/helpers/live-match-fixtures.ts`'s already-proven `createFinalizedLiveTestMatch` helper;
Event has no equivalent fixture helper (event creation → squad generation → event-match creation
→ live session), and building one from scratch remains a reasonable, bounded follow-up, not a
blocker to anything.

## Resolution criteria (all met)

- [x] One canonical `PostMatchReportViewModel` type and a `capabilities` flag set, used by both
  League and Event report pages/components.
- [x] A shared score/goals/assists/attendance/lifecycle shell component, with League and Event
  supplying data and an actions interface.
- [x] Event gains participant add/remove; a decision (documented, not silent) on structured
  absence — it stays League-only (see "Decisions" above).
- [x] Verified in-browser for both a League and an Event match's full report lifecycle.

## Disposition

Resolved (2026-08-28, same session it was identified in). The full shared-shell consolidation
was initially deferred citing verification difficulty and effort — both turned out not to be
valid reasons: a working local browser-testing setup existed already
(`docs/development/browser-acceptance-testing.md`) and simply hadn't been tried, and the actual
engineering effort, once undertaken, was a bounded, verifiable piece of work rather than an
open-ended risk. Remaining follow-ups (an Event-side E2E fixture helper; the
`ObservationSection` nested-form hydration warning) are independent, non-blocking, and recorded
above rather than folded into this ARR's resolution criteria.

## Related decisions

ADR-0104 (Canonical Post-Match Learning Pipeline) — delivered the backend unification this ARR's
"Intended architecture" extended to the UI layer.

## Related implementation

- `src/lib/reports/post-match-report-view-model.ts` (new — canonical types)
- `src/components/matches/post-match-report-shell.tsx` (new — shared shell)
- `src/components/assistant/post-match-page.tsx` (League, rewritten to use the shell)
- `src/app/(app)/events/[eventId]/event-match-report-panel.tsx` (Event, rewritten to use the shell)
- `src/app/(app)/events/event-post-match-actions.ts` (new `addEventMatchPlayerAction`/`removeEventMatchPlayerAction`)
- `src/app/(app)/o/[orgSlug]/matches/[matchId]/post-match/page.tsx` (League page, unchanged)
- `src/components/opponents/observation-section.tsx`,
  `src/components/matches/legacy-match-feedback-section.tsx`,
  `src/components/matches/team-reflection-section.tsx`,
  `src/components/player-development/football-observation-section.tsx`,
  `src/components/matches/match-combination-evidence-panel.tsx` (League-only or already-shared
  sections rendered via `extraSections`, not restructured by this ARR)
- `e2e/post-match-evidence-parity.spec.ts` (League regression coverage)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-28

Identified while completing the Event Evidence Parity, Shared Post-Match Reporting, and
Historical Opponent Learning Catch-Up programme, initially recorded as deferred (assuming no
browser was available for verification, and citing the effort of a two-screen rewrite). Both
reasons were challenged and found invalid within the same session: a working local
browser-verification setup was found and used, and the shared shell was actually built,
wired into both League and Event, and verified end-to-end in-browser (draft editing, the new
Event participant add/remove capability, and the full completion-to-LOCKED lifecycle for both
sources). Resolved same day.
