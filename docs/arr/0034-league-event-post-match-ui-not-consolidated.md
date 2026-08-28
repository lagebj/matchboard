# ARR-0034: League and Event post-match report UI are not consolidated

## State

Identified

## Identified

2026-08-28 (Event Evidence Parity, Shared Post-Match Reporting, and Historical Opponent
Learning Catch-Up programme, ADR-0104)

## Residue

ADR-0104 unified the *backend* post-match learning pipeline (opponent/player/combination
evidence, actual-timeline reconstruction) across League and Event matches — one canonical
algorithm per evidence type, source-agnostic via `FootballMatchRef`. It also resolved
report-*completion* ownership (ARR-0030): `completeEventReport()` now mirrors League's
`completeReport()` shape.

The *UI* was deliberately not consolidated in the same work. League's post-match report page
(`src/app/(app)/o/[orgSlug]/matches/[matchId]/post-match/page.tsx`) assembles six independent
sibling components (`PostMatchPage`, `ObservationSection`, `FootballObservationSection`,
`LegacyMatchFeedbackSection`, `TeamReflectionSection`, `MatchCombinationEvidencePanel`), each
`matchId`-bound and each importing its own dedicated server-action file directly. Event's report
UI (`EventMatchReportPanel`, embedded in `event-matches-tab.tsx`) is one much smaller,
client-fetched component with an untyped view-model, handling score/goals/assists/attendance
inline in its own markup, plus (as of this programme) two mounted already-source-agnostic
presentational components: `FootballObservationSection` (mandatory — player evidence has no
input otherwise) and, gated on `isLocked`, `MatchCombinationEvidencePanel` (already took no
`matchId` prop at all — purely presentational, so wiring it into Event's panel via a new
`getEventMatchCombinationEvidenceAction` was safe, additive, and required no restructuring of
either component tree).

No shared `PostMatchReportViewModel` type, no shared action-interface abstraction, and no shared
score/goals/assists/attendance form component exist between the two. They remain two
independently-maintained implementations of the same conceptual report screen — this ARR is
about that structural duplication, not about individual sections being unreachable from Event
(the two genuinely mandatory-or-safely-additive ones now are).

## Intended architecture

One shared post-match report shell/workspace (League and Event as adapters supplying data and an
actions interface, with a `capabilities` flag set for genuine differences like structured vs.
free-text opponent observation) — this was the original scope of "Goal 2: shared post-match
reporting" in the programme's spec, alongside the evidence-pipeline unification actually
delivered.

## Impact

- A future fix or feature to League's score/goals/assists/attendance handling (e.g. a new
  validation rule, a UI accessibility fix) will not automatically apply to Event's — the same
  class of drift risk ARR-0028/ARR-0030 already fixed for the domain layer, still open at the UI
  layer.
- Event's report UI still lacks some League capabilities entirely: participant add/remove
  (League has `addActualPlayer`/`removeActualPlayer`; Event has none), structured absence
  (League's `MatchReportAbsence`; Event only has `attendanceStatus` enum values), structured
  opponent observation (League's `OpponentEncounterObservation`; Event has a free-text field),
  and structured team reflection (League's `TeamReflection`; Event has a free-text field).
- Not a correctness or data-integrity issue — every evidence-relevant write path (score, goals,
  assists, attendance, football observations) already exists and is wired for both sources. This
  is a maintainability/consistency residue, not a missing capability that blocks Event evidence
  parity.

## Containment

- Do not build a third, narrower Event-specific copy of any League report section when adding a
  new Event capability — either widen the existing League component's props (as
  `FootballObservationSection` was widened in this programme to accept `eventMatchId`) or extract
  a shared component at that point, rather than hand-rolling new Event-only markup that
  duplicates League's.
- Do not attempt this consolidation without visual browser verification of both a League and an
  Event match's full report lifecycle (CLAUDE.md's UI-change verification rule) — it touches the
  score/goals/assists/attendance flows coaches use on every completed match. This is achievable
  locally (see "Verification note" below) — do not defer the consolidation itself citing an
  inability to verify; that reason no longer applies.

## Resolution criteria

- One canonical `PostMatchReportViewModel` type and a `capabilities` flag set, used by both
  League and Event report pages/components.
- A shared score/goals/assists/attendance/lifecycle shell component, with League and Event
  supplying data and an actions interface (not each mounting independently-coded markup for the
  same concepts).
- Event gains participant add/remove and a decision (documented, not silent) on whether
  structured absence extends to Event or stays a documented League-only capability.
- Verified in-browser for both a League and an Event match's full report lifecycle before merge.

## Disposition

Identified, deferred. Not addressed in the Event Evidence Parity programme — that programme's
mandatory scope (Goal 1: evidence parity; Goal 3: one learning pipeline; Goal 4: historical
catch-up) is complete and does not depend on this. The full shared-shell consolidation
(resolution criteria below) is deferred as its own scoped task on effort/risk grounds — it is a
real rewrite of two large, materially-different production coach-facing screens (League has
planned/actual squad diff, absence marking, player stats, and manual add/remove that Event has
none of) — not because it cannot be verified.

### Verification note (2026-08-28)

Browser verification of this exact UI **was** performed in-session, correcting an earlier
(wrong) assumption that no browser was available here. Working local setup: seed the canonical
test dataset (`npm run db:seed:test`, targets `TEST_DATABASE_URL`), run `next dev` with
`MATCHBOARD_ENV=test TEST_AGENT_AUTH_ENABLED=true DATABASE_URL=$TEST_DATABASE_URL` pointed at
that same database, install a Playwright browser once (`npx playwright install chromium
--with-deps`), then drive it with `PLAYWRIGHT_BASE_URL=http://localhost:3333 npx playwright
test` (see `docs/development/browser-acceptance-testing.md`, which already documented this local
mode — it was simply not tried before ARR-0034 was first written).

Using this, both the League and Event post-match pages were confirmed to render correctly
end-to-end against real evidence data (real `completeReport()`/`completeEventReport()` calls,
real `runPostMatchLearning()` results, screenshotted and inspected) — the pages are not broken,
this ARR is genuinely only about code-sharing/maintainability. That same pass found and fixed
three real, pre-existing bugs (none caused by ADR-0104's changes, all surfaced only by actually
rendering the pages):
- `FootballObservationSection` showed nothing at all once a report locked (existing-observation
  display was nested inside the `!isLocked` branch) — fixed, now shown read-only when locked, on
  both League and Event.
- `computeAndApplyPlayerEvidenceForMatch`'s `SKIPPED` reason was `NO_FOOTBALL_OBSERVATIONS` even
  when observations existed but hadn't crossed `evidence-accumulator.ts`'s
  `MINIMUM_DISTINCT_MATCHES` (2) threshold yet — fixed by returning `observationsFound` and
  adding a distinct `INSUFFICIENT_DISTINCT_MATCHES` reason.
- Event's attendance table's "Source" column always rendered blank —
  `EventPostMatchPlayer.playerReports[].source` referenced a field that doesn't exist on the
  Prisma model — removed the dead column rather than inventing schema for it.

One permanent, UI-driven regression test was added:
`e2e/post-match-evidence-parity.spec.ts` (League: create → finalize → live-report a goal → end
session → complete report → assert LOCKED, proving `runPostMatchLearning()` runs without error
through the real UI, not just via direct domain-function calls). No equivalent was added for
Event in this pass — League's flow could reuse `e2e/helpers/live-match-fixtures.ts`'s
already-proven `createFinalizedLiveTestMatch` helper; Event has no equivalent fixture helper
(event creation → squad generation → event-match creation → live session), and building one from
scratch was judged disproportionate effort for this pass. Adding it is a reasonable, bounded
follow-up — not blocked by anything.

## Related decisions

ADR-0104 (Canonical Post-Match Learning Pipeline) — delivered the backend unification this ARR's
"Intended architecture" extends to the UI layer.

## Related implementation

- `src/app/(app)/o/[orgSlug]/matches/[matchId]/post-match/page.tsx` (League)
- `src/components/assistant/post-match-page.tsx`, `src/components/opponents/observation-section.tsx`,
  `src/components/player-development/football-observation-section.tsx`,
  `src/components/matches/legacy-match-feedback-section.tsx`,
  `src/components/matches/team-reflection-section.tsx`,
  `src/components/matches/match-combination-evidence-panel.tsx` (League report sections)
- `src/app/(app)/events/[eventId]/event-match-report-panel.tsx`,
  `src/app/(app)/events/[eventId]/event-matches-tab.tsx` (Event)
- `src/app/(app)/matches/[matchId]/post-match/actions.ts` (League actions),
  `src/app/(app)/events/event-post-match-actions.ts` (Event actions)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-28

Identified while completing the Event Evidence Parity, Shared Post-Match Reporting, and
Historical Opponent Learning Catch-Up programme. Initially recorded assuming browser-based
verification wasn't available in this environment — that assumption was wrong and was corrected
later the same day (see "Verification note" above): a working local Playwright setup was found
and used to actually verify both pages, fix three real bugs it surfaced, and add one permanent
League E2E regression test. The full shell consolidation remains deferred, now explicitly on
effort/risk grounds rather than a verification blocker.
