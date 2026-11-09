# Gate B W5 — Blockers / Open Questions (B08)

Status: implementation complete (all 9 original spec steps), PLUS FOUR remediation passes against
independent reviews of the merged PR (2026-11-08) — see the four "Remediation" sections below —
PLUS one acceptance-pipeline CI/test-config fix (2026-11-09, see below) found while running real
ADR-0153 acceptance deployment, unrelated to B08's own behavior. All items are resolved or
disclosed as permanent, deliberate scope boundaries; none block the PR — see `REVIEW_RECORD.md` for
the real current status.

## Acceptance-pipeline fix (not a remediation pass, 2026-11-09)

Not a B08 defect — a CI/test-infrastructure regression this PR's own `ui-lab-b08` Playwright
project addition exposed in the two *other* workflows that share `playwright.config.ts` and
`package.json`'s `test:e2e` script. Found while running real ADR-0153 label-gated acceptance
(`gh pr edit 822 --add-label acceptance`) against the deployed `pr-822` Test slot, this PR's own
first real exercise of that pipeline.

- **Symptom:** `test-acceptance.yml`'s "Functional acceptance" step (workflow run 42571569930, job
  129009897286) failed every test with `page.goto: net::ERR_CONNECTION_REFUSED at
  http://localhost:3333/dev/ui-lab/...` — the deploy itself (Neon branch, Vercel Test-slot alias,
  Worker, secrets) succeeded; only the Playwright step failed.
- **Root cause:** `npm run test:e2e` was a bare `playwright test`, which runs every project in
  `playwright.config.ts` by default — including this PR's own new `ui-lab-b08` project, which is
  deliberately, intentionally pointed at a local `next dev` server (`localhost:3333`) that only
  `ui-lab-visual-review.yml` starts. Neither `test-acceptance.yml`'s acceptance job nor
  `ci-checks.yml`'s post-merge `e2e` job starts a local dev server — both deploy/test against a
  real Vercel Test-slot URL instead. `ci-checks.yml`'s own `e2e` job never caught this because it is
  `push`-only (post-merge), so it has never run for this still-open PR.
- **Fix:** `package.json`'s `test:e2e` script now passes an explicit `--project` list covering every
  project except `ui-lab-b08` (`setup`, `chromium`, `chromium-viewer`, `accessibility-phone`,
  `accessibility-tablet`, `mobile-critical-chromium`, `mobile-critical-webkit`), matching the
  existing pattern where `ui-lab-b08` is already excluded from the `chromium` project's own
  `testIgnore` list. `ui-lab-visual-review.yml` is unaffected — it already invokes
  `ui-lab-b08` directly via `npx playwright test --project=ui-lab-b08`, never through the
  `test:e2e` script. A matching comment was added next to the `ui-lab-b08` project definition in
  `playwright.config.ts` so this doesn't regress again. Verified locally: bare `playwright test
  --list` resolves 104 tests/13 files; `npm run test:e2e -- --list` now resolves 50 tests/12 files,
  with `ui-lab-b08` absent from the second list.
- **Scope:** `package.json` and `playwright.config.ts` only — no B08 page, component, fixture, or
  production code touched. This is the one change to a file outside
  `src/app/dev/ui-lab/gate-b/b08-information-ownership/` and `e2e/ui-lab-b08.spec.ts` this PR makes,
  and it is a shared-CI-config correctness fix, not a B08 behavior change.

## Fourth remediation ("final source-of-truth remediation", independent review, 2026-11-08)

The third remediation introduced `historyOrigin` and `resolveB08EffectiveHistory()`, correctly
restoring the reference match's canonical event chronology for a reference-origin persisted
report. Two real defects remained in that same provenance system:

1. **FIXED — a reference-origin persisted report lost its real reflection/observations in Match
   Details.** `deriveB08AfterDataFromReport()` still returned `reflection`/`footballObservations`/
   `opponentObservation`/`combinationEvidence`/`shapeChangeRows`/`firstTimeCanonicalPositions`
   empty/null UNCONDITIONALLY for every persisted report — so AFTER could report "reflection not
   recorded" for the same reference match whose REPORT-DRAFT Reflection tab correctly showed the
   real, already-submitted debrief. Fixed by extending `resolveB08EffectiveHistory()`'s own output
   (`B08EffectiveHistory`) with these fields, resolved by `historyOrigin` exactly like `teamNote`
   already was: the real canonical values for `"REFERENCE"`, empty/null for `"LIVE_JOURNEY"`.
   `combinationEvidence` is additionally gated in `deriveB08AfterDataFromReport()` on
   `report.status === "LOCKED"` — matching `b08AfterData()`'s own existing, real "a draft never
   sees it" rule — never exposed in DRAFT merely because the canonical fixture has it.
2. **FIXED — a reference-origin persisted report could silently become a LIVE_JOURNEY report.**
   `saveB08JourneyEvents()`/`markB08JourneyFinished()` always wrote `historyOrigin: "LIVE_JOURNEY"`
   unconditionally, even when a `"REFERENCE"`-origin report was ALREADY persisted — recording a
   real LIVE event after editing the reference report would flip the origin while RETAINING the old
   reference-derived report, leaving the event ledger and the report grounded in two different
   match histories. Fixed: both write functions now REJECT (`{accepted: false, reason}`) this
   transition at the storage boundary itself, not just in the UI. `safe-transition-controller.ts`'s
   `recordEvent()`/`endSession()` translate a rejection into the real `LiveMatchActions` contract's
   own existing `conflict`/`error` fields (never a false `success: true`) — `recordEvent()` uses
   `conflict` (routes to the real "Needs review" panel, a genuine non-silently-retried condition),
   `endSession()` uses `error` (that action's own contract has no `conflict` field; `LiveMatchClient`'s
   unmodified `handleEndSession()` already surfaces `result.error` via its visible error state). The
   existing "Reset journey" control remains the one deliberate way to recover — no new UI invented.

Full detail: `DATA_TRUTH_AND_FIXTURES.md`, `TRANSITION_AND_NAVIGATION_CONTRACT.md`,
`SOURCE_RECONCILIATION.md`, `INTERACTION_AND_STATE_AUDIT.md`, `CHANGED_FILES.md`.

## Third remediation ("final data-integrity remediation", independent review, 2026-11-08)

The second remediation's shared projection fixed cross-page consistency, but four real defects
remained, plus an explicit requirement to finally verify LIVE's own Undo through a real browser
interaction (the second remediation had deliberately declined to, citing a timing risk — now
closed at the fixture's own write boundary, see item 5 below).

1. **FIXED — editing the reference report directly could discard the match's canonical event
   history.** `saveB08JourneyReport()` on a reference-mode edit (no LIVE journey at all) used to
   write `events: []` with no record of why — AFTER then derived an EMPTY timeline from it. Fixed
   with `historyOrigin` (`b08-journey.ts` v3: `"REFERENCE"` vs `"LIVE_JOURNEY"`) and a single
   resolver, `shared/b08-projection.ts`'s `resolveB08EffectiveHistory()`, that every page now calls
   instead of deriving from a raw, ambiguous event array. `safe-transition-controller.ts`'s own
   `initialLiveEvents()` had the identical blind spot in reverse (opening LIVE after a reference
   edit looked like a resumed, empty LIVE session) — fixed the same way.
2. **FIXED — reference-only debrief/observation/combination content could appear in interactive
   reports.** `report-draft/page.tsx` and `report-completed/page.tsx` were passing the fixed
   `b08DebriefAnswers`/`b08FootballObservations`/`b08CombinationEvidence` literals to
   `SafePostMatchReportShell` UNCONDITIONALLY — `staticAfterData`'s own already-correct null/empty
   narrative fields never reached these three props at all. Fixed: both pages now choose between
   the real reference content and the real empty-state equivalents (`EMPTY_DEBRIEF_ANSWERS.answers`
   with `debriefStatus="DRAFT"`, `[]`) based on the SAME `historyOrigin`-derived
   `isInteractiveJourney` flag the rest of the cascade uses — never inferred from mere journey
   existence (a reference-origin edit keeps its own real narrative; see the next item for why that
   distinction matters).
3. **FIXED — fixture-local live-event recording was not idempotent.** `recordEvent()` in
   `safe-transition-controller.ts` always generated a fresh id and appended a new row, with no check
   against an already-accepted `clientEventId` — a genuine retry (reconnect, reload mid-send, a
   resent command) would have silently double-counted a goal/correction/reversal. Fixed by mirroring
   production's own real contract exactly (`clientEventId`-keyed dedup, confirmed against
   `LiveMatchClient`'s own `reconcileOutboxWithServer()` doc comment: "a resend is dedup-safe
   server-side by clientEventId") — an identical retry is a no-op, a conflicting one is rejected,
   never silently appended or overwritten. The previous projection-level "duplicate delivery" test
   was renamed to stop implying this was already proven elsewhere; the real claim is now proven
   directly against the write boundary in `safe-transition-controller.test.tsx`.
4. **FIXED — the shared report shell still contained B05-specific data when used by B08.**
   `SafePostMatchReportShell` hardcoded B05's own `b05MinutesByParticipant`/
   `b05ObservationCountByParticipant` maps, a literal `"report-gate-b-05"` report id, a literal
   `"debrief-gate-b-05"` debrief id, and a B05-specific "Follow up on positional shape..." team note
   — unconditionally, for every caller. Fixed with five new optional props
   (`reportId`/`debriefId`/`minutesByParticipant`/`observationCountByParticipant`/`teamNote`), all
   defaulting to B05's exact existing values (every B05 call site is byte-for-byte unaffected); B08
   now passes its own real equivalents.
5. **FIXED — LIVE Undo is now verified through a real browser interaction (Journey C).** The second
   remediation declined to test this, having found a real timing characteristic in
   `LiveMatchClient`'s own event-reconciliation display: `handleUndo(eventId)` can be invoked against
   a Recent Events row still on the local overlay (not yet reconciled into `recentEvents`), whose own
   `id` is its `clientEventId`, not the eventual real stored id — and `EVENT_REVERSED.correctsEventId`
   is in the REAL-id namespace. Investigating further this pass found this is closable, not merely
   avoidable: `recordEvent()` now normalizes an `EVENT_REVERSED`'s `correctsEventId` to the real
   target id even when submitted against a `clientEventId` (the same write-boundary normalization a
   real server would need to perform), proven directly in `safe-transition-controller.test.tsx`. With
   that fixed, Journey C (`e2e/ui-lab-b08.spec.ts`) records a goal, Undoes it through the real mounted
   `LiveMatchClient`'s own Recent Events panel, and verifies reporter/follower agreement and downstream
   non-resurfacing through REPORT-DRAFT/AFTER/REPORT-COMPLETED/reload — no longer a disclosed gap.

Journey D (a direct reference-report edit, end-to-end through REPORT-DRAFT/AFTER/REPORT-COMPLETED)
was also added to `e2e/ui-lab-b08.spec.ts`, proving defect #1's fix in a real browser, not only at
the unit level.

Full detail: `DATA_TRUTH_AND_FIXTURES.md`, `TRANSITION_AND_NAVIGATION_CONTRACT.md`,
`SOURCE_RECONCILIATION.md`, `INTERACTION_AND_STATE_AUDIT.md`, `CHANGED_FILES.md`.

## Second remediation ("lifecycle data consistency", independent review, 2026-11-08)

The first remediation pass fixed the clock/overflow/navigation defects below but left a real,
deeper one: AFTER and REPORT-COMPLETED still read the static reference fixture while REPORT-DRAFT
only partially read the interactive journey — a coach could finish LIVE with one result and see a
DIFFERENT one in Match Details. Fixed with one shared projection (`shared/b08-projection.ts`) and
an extended journey store (`shared/b08-journey.ts` v2, now also persisting the reconciled report) —
full detail in `DATA_TRUTH_AND_FIXTURES.md`'s "The shared projection" section and
`TRANSITION_AND_NAVIGATION_CONTRACT.md`'s "The shared data-consistency cascade" section. Summary:

1. **FIXED — AFTER/REPORT-COMPLETED disagreed with REPORT-DRAFT about the same interactive
   match.** All three now read the same three-tier priority cascade (persisted report >
   journey-derived seed > reference fixture).
2. **FIXED — goal reversal (`Undo`) was not applied anywhere in B08's own derivations.**
   `computeEffectiveLiveEvents()` mirrors the real production reversal-filtering algorithm exactly.
3. **FIXED — reference-only narrative (reflection, observations, combination evidence, the
   Assistant Coach insight) could have leaked into an interactive projection claiming a different
   match history.** `deriveB08AfterDataFromReport()` returns these fields empty/null in interactive
   mode; the Assistant Coach panel uses the real `{status: "unavailable"}` state instead.
4. **FIXED — a real test-isolation bug found while re-verifying:** `onStateChange`'s own mount-time
   fire would have silently started a persisted journey on a bare page visit; a skip-first-render
   guard was added. A SEPARATE, already-landed bug (jsdom's shared `sessionStorage` leaking between
   tests in the same file) was also found and fixed in the test suite itself.
5. **DISCLOSED, not attempted as a browser test — Journey C (goal reversal end-to-end in a real
   browser).** Investigating `LiveMatchClient`'s own event-reconciliation timing
   (`getRecentEvents()` is only re-fetched during specific reconciliation moments — e.g. right
   before "Finish live reporting" — not after every action) surfaced a real risk: a newly-recorded
   event can be transiently absent from the "Recent events" panel before the next reconcile, since
   `overlayPendingCommands()` excludes any command once its status reaches `PERSISTED` (which B08's
   own synchronous fixture `recordEvent` reaches almost immediately). Clicking that event's own
   "Undo" button in a Playwright test would therefore race a real, pre-existing production display
   characteristic I cannot verify without running Playwright locally (this devcontainer's
   documented HMR blocker). The exact same claim — a goal followed by a reversal returns to the
   original score and excludes the reversed goal from the report — is instead proven
   deterministically, with literal expected values, in
   `shared/__tests__/b08-projection.test.ts` — stronger evidence than a timing-sensitive browser
   click would be, and explicitly permitted by the review's own "where an interaction is better
   verified through assertions than screenshots, retain the assertion and document the
   corresponding test." A genuine, bounded fidelity improvement was made alongside this
   investigation regardless of whether C ships as a browser test: `getRecentEvents()` now marks
   `isReversed` on an already-undone event (`markReversedEvents()`), matching what real production
   computes server-side.
6. **Journey D ("duplicate and correction behavior") is explicitly scoped by the review itself to
   "the fixture projection level,"** not a browser requirement — satisfied by the projection unit
   tests' own duplicate-delivery case.

## Remediation (independent review of PR #822, 2026-11-08)

The independent review found real defects the original implementation's own tests did not catch
(clock-math/unit bugs a unit test compared only against itself, a navigation contradiction, a
layout overflow, and insufficient end-to-end proof of LIVE-to-report continuity). All are now
FIXED, not merely disclosed:

1. **FIXED — LIVE clock showed ~45:00 instead of the real 15:00** (and a spurious over-duration
   warning). `elapsedBeforeStartMs` was double-counting the completed first half on top of the
   second half's own elapsed time. See `DATA_TRUTH_AND_FIXTURES.md`.
2. **FIXED — live-event timestamps rendered as ~0:00.** `matchSeconds` is real milliseconds despite
   its legacy name; the fixture's own conversion function stored seconds. See
   `DATA_TRUTH_AND_FIXTURES.md`.
3. **FIXED — mobile horizontal page overflow** (up to 527px rendered at a requested 320px).
   `TabRail`'s pill variant had no width cap/overflow handling. See `SOURCE_RECONCILIATION.md`'s
   own TabRail section.
4. **FIXED — a completed report returning to Match Details still said "incomplete."**
   REPORT-COMPLETED's back-links now carry `?report=completed`; AFTER reads it. See
   `TRANSITION_AND_NAVIGATION_CONTRACT.md`.
5. **FIXED — LIVE-to-report continuity was not real.** A recorded live event previously had no
   effect on the subsequent Report (five matching static snapshots, not genuine dependency). A real,
   bounded, sessionStorage-backed journey (`shared/b08-journey.ts`) now carries it through. See
   `TRANSITION_AND_NAVIGATION_CONTRACT.md` and `DATA_TRUTH_AND_FIXTURES.md`.
6. **FIXED — the `MatchAfterMatchPanel` secondary report link** resolved to a production-shaped URL
   outside the UI Lab. Now an additive `reportHrefOverride` prop. See item 3 below (superseded) and
   `TRANSITION_AND_NAVIGATION_CONTRACT.md`.
7. **FIXED — the reporter/follower score could silently disagree.** The follower summary is now
   derived from the same event ledger as the reporter. See `SOURCE_RECONCILIATION.md`.
8. **CORRECTED (documentation only, no code change needed) — "LIVE Finish reporting does not
   auto-navigate to AFTER."** This file's own prior claim (item 4 below) was stale/incorrect:
   `handleEndSession()` already navigates via `actions.reportUrl()`, and B08's fixture already
   supplies both a `reportId` and a working `reportUrl()`. See
   `TRANSITION_AND_NAVIGATION_CONTRACT.md`'s "RESOLVED" section.
9. **ADDED — real browser (Playwright) coverage**, since unit/component tests alone were correctly
   judged insufficient proof for navigation/continuity/layout claims. 50/50 tests passed in this
   PR's own CI (workflow run 42473958417) — the full 5×8 overflow matrix, the real LIVE-to-report
   journey (via `window.location.href` navigation and real sessionStorage persistence), and
   navigation/back-link correctness. See `e2e/ui-lab-b08.spec.ts` and
   `INTERACTION_AND_STATE_AUDIT.md`.
10. **RESOLVED — real post-remediation capture + attestation.** The capture run accompanying this
    remediation (workflow run 42473958417, commit d81c3800) produced 72 real screenshots, all
    independently re-hashed with zero mismatches, replacing the pre-remediation attestation. See
    `capture-attestation.json`.

The sections below are the ORIGINAL implementation's own blockers/decisions record, left in place
for history; superseded claims are marked inline rather than deleted, so the record stays honest
about what changed and why.

## Resolved during this audit (recorded here so Step 4 doesn't re-derive them)

- **Tab sets**: the task brief's §3 table was checked against `src/lib/matches/
  match-detail-tabs.ts` directly and matches exactly, including the DRAFT-defaults-to-`players`
  rule and the "Debrief" label / `reflection` URL-key split. No mismatch to flag.
- **The flagship duplication finding** (Overview's own "Post-match report" status widget vs. the
  dedicated "After match" tab's status/integrity surface) is fully verified field-by-field — see
  `INFORMATION_OWNERSHIP_MATRIX.md` §3. Not speculative.
- **SafePostMatchReportShell location**: `src/app/dev/ui-lab/gate-b/b05-post-match-report/shared/
  safe-post-match-report-shell.tsx` + `use-safe-report-lifecycle.ts` (same dir). Confirmed reusable
  pattern for B08-REPORT-DRAFT/-COMPLETED (parameterize with a new B08 fixture, do not reuse B05's
  match identity).
- **Gate B index page**: `src/app/dev/ui-lab/gate-b/page.tsx` — flat `SCENARIOS` array; already
  contains a line stating B08 "remains deferred, not deleted from scope" that must be updated once
  B08 lands, plus 15 new entries (5 primary + any companion/nav-origin stand-ins) need adding.
- **Event has no dedicated Match Details route** — confirmed, zero file exists. B08's "Event-origin
  parity" requirement (brief §7) must reuse B06's existing comparison scaffold
  (`b06-league-event-parity/{league,event}/{before,after}` + the two nav-origin stand-in pages),
  not invent a new Event Match Details page (explicitly forbidden by brief §19's non-goals).

## Resolved during Step 4 implementation

1. **RESOLVED — Overview report-status widget correction shape.** Implemented as a 2-column grid
   (the degraded third cell was dropped, not kept as a visibly empty slot) — status pill + single
   "Continue report"/"View full report" link, full detail removed. See `after/page.tsx` and the
   directly-asserting test in `INTERACTION_AND_STATE_AUDIT.md`.
2. **RESOLVED — the §3 correction is visibly demonstrated, not just documented**, with an on-page
   disclosure callout noting the intentional difference from current production (`VISUAL_VS_CURRENT.md`).
3. **SUPERSEDED — now FIXED, not just disclosed (see "Remediation" section above, item 6).** A new,
   real gap found while building `after/page.tsx`: the reused, unmodified `MatchAfterMatchPanel`
   rendered its own secondary "Continue report"/"View full report" link via the real `orgUrl()`
   helper, which resolved to a production-shaped `/o/.../matches/.../post-match` URL rather than
   this candidate's own `/report-draft` route. The original entry below is left for history; the
   independent review correctly rejected "threading a new prop... beyond this wave's scope" as an
   acceptable outcome for a visibly broken link — `MatchAfterMatchPanel` now has an additive,
   backward-compatible `reportHrefOverride` prop, and every visible report link on B08-AFTER
   resolves inside the UI Lab.
4. **RESOLVED — LIVE scenario's production-component mounting risk.** Decision: **mount the real
   `LiveMatchClient`** (`src/components/live-match/live-match-client.tsx`), not a hand-built
   imitation. Verified by reading the full component: it has zero server-only imports and zero
   hardcoded network calls of its own — every production side effect (`startSession`,
   `endSession`, `heartbeat`, `persistClock`, `recordEvent`, `getRecentEvents`,
   `getPreMatchPackage`, `reconnectRealtime`, `onLiveUpdate`, `onPersistenceChanged`) is reached
   exclusively through the injected `actions: LiveMatchActions` prop (a plain interface, line 90).
   `useLiveRealtime` (`use-live-realtime.ts`) is **not** called by `LiveMatchClient` itself — it's
   only wired in by the two production adapters (`createLeagueActions`/`createEventActions` in
   `league-live-match-client.tsx`/`event-live-match-client.tsx`), and even there it never connects
   on mount: `ensureConnected()` only runs from a successful real `startSession` call or an
   explicit `reconnectNow()`. So the risk is entirely in *which actions object* gets passed in, not
   in the shared component itself.

   **Implementation approach for B08-LIVE:** write a fixture-local `LiveMatchActions` object (new
   file, e.g. `shared/fixture-live-actions.ts`) that satisfies the real `LiveMatchActions`
   interface with in-memory/Promise-resolved fixture data and never imports
   `use-live-realtime.ts`, `live-actions.ts`/`event-live-actions.ts`, or either production adapter.
   Concretely: `getPreMatchPackage`/`getRecentEvents` resolve the shared B08 fixture's squad/event
   history; `recordEvent` appends to local component state and returns
   `{ success: true, data: { persistenceStatus: "persisted" } }` synchronously (no coordinator);
   `startSession`/`endSession`/`heartbeat`/`persistClock` are no-op-success stubs;
   `reportUrl`/`onLiveUpdate`/`onPersistenceChanged` can be omitted (all optional) or no-op.
   `registerLiveServiceWorker()` and the IndexedDB local-outbox calls
   (`saveSessionLocally`/`saveCommandLocally`/etc., from `live-local-store.ts`) run as real
   browser-local side effects regardless of the actions object — harmless (no production reach),
   but use a clearly synthetic, namespaced `matchId` (e.g. prefixed `b08-fixture-`) so fixture
   session/command rows can never collide with a real match's IndexedDB rows on the same browser
   profile. Mount via `<LiveMatchClient matchId={FIXTURE_ID} teamName=... opponentName=...
   periodConfig={...} actions={fixtureActions} subjectType="LEAGUE" />` directly — not through
   either adapter. Disclose in `VISUAL_VS_CURRENT.md` that the League/Event adapters and the real
   coordinator/`useLiveRealtime` connection are the one production layer intentionally not
   mounted; everything else (`LiveMatchClient` itself, its clock/period logic, its event-entry UI,
   `NeedsReviewPanel`, `LiveReportingWarningBanner`) is the real, unmodified production component.

   **Read-only follower companion:** `follow-live-client.tsx` exists as a separate real component
   (confirms the spec's optional "read-only Follow Live companion" is backed by a real production
   piece, not invented) — reuse it the same way (fixture-local data, no real polling target) if the
   companion page is built.

   **B08-BEFORE's live-entry CTA, confirmed NOT inside `before-match-overview.tsx`:** the actual
   "Start live reporting" / "Open Live Reporting" primary action and the read-only
   `/matches/[matchId]/live/follow` link are rendered by `match-detail-shell.tsx` (lines ~226-240,
   `livePrimaryAction`/`describeLiveReportingEntryPointLabel()`), not by `BeforeMatchOverview`
   itself, which only receives `liveReportingStarted` as a boolean flag for its own planning-state
   messaging. B08-BEFORE's candidate must reproduce the shell-level CTA (a real link construction
   using the same label function), not expect `BeforeMatchOverview` alone to contain it — a one-file
   assumption correction `CURRENT_STATE_AUDIT.md` didn't make explicit.
5. **RESOLVED — Debrief URL key regression.** `?tab=review` is only a real tab in Post-Match Report
   DRAFT, not COMPLETED (`combinations` replaces it). Production's real
   `resolvePostMatchReportTab()` fallback already handles this (`CURRENT_STATE_AUDIT.md` §2); B08
   reuses it verbatim via the shared shell and asserts the fallback directly in
   `report-completed/__tests__/page.test.tsx` ("`?tab=review` is invalid once locked..."). Not
   registered as a separate browser-capture scenario — see `VISUAL_VS_CURRENT.md` for why.
6. **RESOLVED — Combination evidence for REPORT-COMPLETED.** Built as a hand-written literal,
   independently verified against the real `deriveCombinationsFromSegments()` output in
   `shared/__tests__/combination-evidence.test.ts`, mirroring B05's own precedent exactly.

## Permanent, deliberate scope boundaries (not gaps to close later)

- `match-flow-panel.tsx`, `plan-vs-reality-panel.tsx`, `what-this-match-added-panel.tsx`,
  `match-opponent-memory.tsx` were reused by import/composition, not read line-by-line in the Step
  1-2 audit; their single-owner verdicts rest on their doc comments and call sites. Low risk (none
  appear duplicated elsewhere in the ownership matrix) but not a complete independent verification —
  acceptable residual, not blocking.
- `before-match-overview.tsx`'s full body was never read; B08-BEFORE instead composes its own page
  directly from the real constituent components (`MatchIdentityCard`, `MatchPreparationWidget`,
  `TouchlinePlanningPitch`) rather than mounting `BeforeMatchOverview` itself. This is a deliberate
  compositional choice (consistent with B01/B06's own established pattern), not an oversight.
- `PlanVsRealityPanel`/`MatchTacticsPanel` are not mounted on B08-AFTER — both self-fetch via real
  server actions/DB against a real `matchId`/`teamId` and are not fixture-injectable (same
  disclosed gap B01 already carries). Tactics/Opponent context/History tab bodies are disclosed
  placeholders on B08-AFTER, the same discipline B05's own "Review" tab uses.
- `FollowLiveClient` is not mounted on B08-LIVE (performs a real realtime-ticket fetch/Durable
  Object connection on mount) — the reporter-vs-follower distinction is demonstrated with a
  read-only summary panel built from the real `MatchScoreHeader` instead (now derived from the same
  live event ledger as the reporter — see the "Remediation" section's item 7).
- **Disclosed, out of this wave's scope**: B05's own `globalMinuteToPeriodRelative()`
  (`b05-post-match-report/shared/report-data.ts`) carries the identical `matchSeconds`-as-seconds
  bug B08's own copy was found and fixed for (remediation item 2). It stays dormant/invisible in
  B05 because B05 never mounts the real `LiveMatchClient`/`formatElapsedMs` consumer that would
  surface it. Not fixed here — B05 is out of this wave's scope (independent review's own hard
  boundary: "Do not rebuild B01-B07") — but disclosed so it isn't mistaken for unknown.
- **CORRECTED (was stale/incorrect, not a real gap):** this line previously claimed LIVE's "Finish
  reporting" does not auto-navigate anywhere. That was wrong — `handleEndSession()` already
  navigates via `actions.reportUrl()` once `endSession()` returns a `reportId`, and B08's fixture
  already supplies both. See `TRANSITION_AND_NAVIGATION_CONTRACT.md`'s "RESOLVED" section.
- RESOLVED: `capture-attestation.json`'s placeholder has been replaced with the real attestation
  from this PR's own "Capture fixture-backed UI Lab views" CI run (workflow run 42412296463, commit
  4a28a6f) — 72 real screenshots, all independently re-hashed and verified against the artifact's
  own manifest.json with zero mismatches, the same two-commit pattern every prior Gate A/B wave has
  used. Still gated on the owner's own Visual Authority review before any approval.
