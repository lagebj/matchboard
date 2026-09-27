# ADR-0152: Coach learning loop — lifecycle next action, guided debrief, qualitative evidence, and plan-versus-reality Assistant Coach

## Status

Accepted (programme — delivered incrementally, following ADR-0146's precedent; see "Delivery" below)

## Context

Matchboard's `plan -> play` side is strong: round planning, Match Insights, Live Reporting with
persisted clock and ADR-0146 guardrails (180/240/270-minute thresholds, shared
`finishLiveReporting`, five-minute reconciliation, `MatchPeriodTimingResolution` review gate), and
five opt-in AI Advisor capabilities (ADR-0148). The `observe -> learn -> change the next plan`
side is weak:

- Live Reporting has no single canonical "what should I do next" resolver. Live, Today, and Match
  Details each infer state; normal live events can be recorded while the clock is before kickoff,
  in a break, or after full time, producing zero-minute or ambiguous timestamps; there is no
  recovery path for a forgotten period start.
- Post-match qualitative capture is fragmented across Team Reflection, opponent observation,
  player development observation, and legacy match feedback sections. A coach bounces between
  them and there is no explicit "not observed / nothing to add" answer, so the only way to
  finish is to invent prose or leave fields silently empty.
- Coach free text (team notes, reflections, opponent notes) is stored but never reused as
  evidence. Every AI prompt either ignores it or would have to resend all historical raw text.
- `POST_MATCH_REVIEW` summarises a match but never compares it against the pre-match
  expectation that existed before kickoff; weekly review has no recurring-theme aggregate; there
  is no longer learning cycle.

This ADR implements the "Matchboard Coach Learning Loop" implementation bundle
(`.matchboard-work/matchboard_coach_learning_implementation_bundle_2026-09-25/`, gitignored
working documents — decisions normatively sourced from there; not linked further since the
directory is not part of the durable repository).

## Decision

### 1. One canonical live-reporting next-action resolver

A pure resolver under `src/lib/live-match/` returns one `LiveReportingPrimaryAction`
(`START_LIVE_REPORTING`, `START_PERIOD`, `END_PERIOD`, `RESUME_PERIOD`, `FINISH_LIVE_REPORTING`,
`OPEN_POST_MATCH_REPORT`, `WAIT_FOR_RECONCILIATION`). Live Reporting (League and Event), Today,
and Match Details consume it; presentation components never infer lifecycle state themselves.
`Finish live reporting` stays a visible secondary action throughout an active session and becomes
primary once the final configured period has ended. The client never introduces a second timeout
state: at >= 270 minutes it shows `WAIT_FOR_RECONCILIATION` and the ADR-0146 server
reconciliation remains the only authority.

### 2. Normal live events require a running playable period (server-enforced)

One shared domain guard rejects normal live-event mutations with the typed error
`LIVE_PERIOD_NOT_RUNNING` unless the session is ACTIVE, the current period is playable, and the
persisted clock is running. Client disabling is a convenience only. Explicit correction/edit keeps
its existing path. Recovery from a forgotten period start is coach-confirmed only (`Start now` /
`It started earlier` with 1–30 minutes elapsed / `Still in break`) and reuses the persisted clock
semantics (`clockElapsedBeforeMs`, `clockPeriodStartedAt`). `lastClockTransitionAt` (nullable, both
League and Event sessions) is written on every clock transition and never on heartbeat or event
creation; it only drives a UX prompt threshold (break duration + 5 minutes), never an automatic
transition. ADR-0146's timing authority is unchanged.

### 3. The guided debrief is the one normal draft qualitative capture surface

A `PostMatchDebrief` (exactly one of League/Event report, SQL CHECK-enforced) holds a
Zod-validated, versioned JSON answer document. Question definitions are versioned TypeScript
(`v1`), never database-configured. Every required prompt accepts an explicit no-evidence answer
(`NOT_OBSERVED`, `NOTHING_TO_ADD`, `NO_MEANINGFUL_CHANGE`); a report may require that the debrief
was reviewed, never that positive or negative prose was written. Submitting the debrief maps
deterministically, in one transaction, onto the existing canonical models (TeamReflection,
OpponentEncounterObservation, PlayerDevelopmentObservation via its existing mutation, and the
report team note) — the debrief does not replace them. Event reports have no structured
TeamReflection/OpponentEncounterObservation (both are keyed to League `Match`); their existing
equivalents are `EventPostMatchReport.teamReflection` (team note), `.opponentObservation`
(opponent memory), and `.notes` (anything else), and for Event the debrief JSON itself is the
structured team-execution record. Player observations use the shared
`createFootballObservations` path for both. New/edited draft reports require a
`SUBMITTED` debrief to complete; old locked reports stay valid without one. The debrief never
owns result, attendance, goals/assists, live events, minutes, or timing corrections.

### 4. Reusable qualitative evidence with provenance

`QualitativeEvidenceExtractionRun` + `QualitativeEvidenceObservation` store coach language as
structured evidence. Origin is always coach-reported; derivation is either `DETERMINISTIC`
(debrief structure already supplies scope/phase/polarity) or `AI_STRUCTURED` (genuinely
unstructured text, processed asynchronously by the existing `/api/cron/ai` scheduler, never in a
request path). Runs are keyed by a normalized source fingerprint: unchanged source never re-runs;
a successful replacement supersedes the prior run (retained for audit); a failed replacement never
hides the prior successful evidence. Guest players never acquire persistent evidence. AI inference
stays in `AiAdvisorInsight` and never becomes coach evidence.

### 5. AI contract v2 and plan-versus-reality post-match review

`AI_CONTRACT_VERSION` becomes `"2"`, keeping `summary`/`insights` and max 10 insights, adding
nullable per-insight `analysisRole` (`SUPPORTED`, `CONTRADICTED`, `UNRESOLVED`, `SURPRISING`,
`RECURRING_PATTERN`, `NEXT_FOCUS`, `EVIDENCE_GAP`) and `clarificationPrompt` (only on the single
permitted `EVIDENCE_GAP`), and persisting `displayOrder`. `POST_MATCH_REVIEW` compares the latest
successful `MATCH_PREP`/`LINEUP_REVIEW` that existed at or before the live session's `startedAt`
(or report creation when no session exists) against actual match evidence; it never generates a
retrospective "pre-match" review. An answered clarification (`AiInsightClarification`) becomes
deterministic coach-reported evidence and changes the post-match fingerprint through normal
fingerprinting. No numeric confidence score.

### 6. Longitudinal learning without player scoring

Exact-opponent memory aggregates opponent-scoped qualitative evidence over at most five previous
encounters with deterministic `CONSISTENT`/`MIXED`/`SINGLE_OBSERVATION` labels, reusing Match
Insights' exact-opponent semantics (no fuzzy matching, no opponent master data). Weekly review
adds a deterministic 42-day/max-eight-match recurring-theme aggregate and at most two coaching
focuses with one small training constraint each. A sixth capability, `DEVELOPMENT_CYCLE_REVIEW`
(scope `TEAM_WINDOW`), runs per team every 35 days only when at least three completed matches
occurred since the previous successful cycle; it is disabled by default for every organisation,
including already-AI-enabled ones. Player-specific outcomes are limited to Improving / Unresolved
/ Insufficient evidence — no numeric development score, personality, potential, or permanent
position label.

### 7. AI stays subordinate and non-blocking

ADR-0148 §4 is reaffirmed: no provider call from a report submit, debrief save, live action, or
page view; no call on keystroke, clock tick, or unchanged fingerprint; AI outage never blocks a
football-domain write. No new provider, credential stack, queue platform, cron, or generic chat.

### 8. Coach free text becomes eligible AI input — pseudonymized, bounded, attributed

ADR-0148 §5 excluded arbitrary free-text notes from provider payloads (ADR-0149 Decision 3 made a
narrow exact-opponent exception). This programme deliberately widens that exception for two
uses only: (a) the one-per-fingerprint qualitative extraction of a single source text, and (b)
`POST_MATCH_REVIEW`'s current-match debrief text. Historical text is represented by structured
observations, not re-sent raw. Before any coach text leaves the process it passes through one
deterministic pseudonymizer that replaces known player and guest names in the match's
participant set (full, first, and last names, case-insensitive, word-bounded) with that
payload's ephemeral refs, and is truncated to the documented bounds. Text is always labelled as
a coach observation. Raw coach text never enters routine structured logs.

## Alternatives considered

- **A new post-match report type for the debrief.** Rejected: it would create a second report
  system and split canonical evidence. The debrief is a state object on the existing report.
- **A database-configurable survey builder.** Rejected: question semantics drive deterministic
  evidence mapping; they must change through reviewed, versioned code.
- **Send all historical raw coach text to every prompt.** Rejected: unbounded cost and repeated
  interpretation of the same text; structured once-per-fingerprint extraction is reused instead.
- **Client-side auto-start/auto-end of periods.** Rejected: ADR-0146 makes configured duration an
  expectation, not a whistle; ambiguous timing is always coach-confirmed.

## Consequences

### Positive

- One lifecycle vocabulary across Live Reporting, Today, and Match Details, for League and Event.
- No new zero-minute or ambiguous live events.
- A reviewable, resumable, no-invention debrief that feeds existing canonical models.
- Coach language becomes durable, provenance-labelled evidence usable by later AI work.

### Negative

- Five new tables and one additive column per live-session model; AI contract bump means old v1
  reviews are rendered with null v2 fields.
- The draft post-match workflow changes shape (Reflection → Debrief); legacy sections remain only
  as read models for historical data.

## Migration

Additive only (ADR-0105 expand/contract satisfied without a split): new nullable
`lastClockTransitionAt` on both live-session models (no backfill); new enums and the
`PostMatchDebrief`, `QualitativeEvidenceExtractionRun`, `QualitativeEvidenceObservation`,
`AiInsightClarification` tables with the repository's organisation RLS policy pattern; nullable
`AiAdvisorInsight.analysisRole`/`clarificationQuestion`/`clarificationOptions` and
`displayOrder` default 0; new enum values `DEVELOPMENT_CYCLE_REVIEW` and `TEAM_WINDOW`;
`OrganisationAiSettings.developmentCycleReviewEnabled` default `false`. No existing locked report
is reopened or retroactively required to have a debrief; old drafts get a prefilled `DRAFT`
debrief on first open. No unbounded historical AI backfill runs at deployment.

## Supersedes

None. Extends ADR-0146 (live lifecycle UX on top of its timing authority), ADR-0147 (post-match
surface lifecycle), ADR-0148 (a sixth capability and contract v2 within its provider/credential
architecture), and ADR-0149 (opponent memory inside Match Insights).

## Delivery

Delivered incrementally, one branch/PR/merge per slice (sequential-PR policy):

0. Additive schema, RLS, generated client, domain type skeletons. No behavior change.
1. Live Reporting operating surface: resolver, transition timestamp, action bar, event guard,
   forgotten-start recovery, Today/Match Details convergence, Event parity.
2. Debrief v1: schema, service, prefill, autosave, UI, deterministic mapping, completion gate,
   reopen, read-only view, retirement of fragmented draft capture.
3. Qualitative evidence: deterministic writer, extraction queue in `/api/cron/ai`, supersession,
   active queries, evidence labels.
4. Assistant Coach post-match v2: contract v2, pre-match cutoff, context v2, role presentation,
   clarification.
5. Opponent memory and weekly intelligence.
6. Five-week learning cycle.
7. Bounded backfill command and cleanup.

## History

### 2026-09-26

Record created with Slice 0 (additive schema baseline).

Slice 1a delivered (of Slice 1's larger scope — split for review, per this repository's
"keep changes scoped to one reviewable purpose" convention): the canonical
`resolveLiveReportingPrimaryAction` resolver (`src/lib/live-match/live-reporting-primary-action.ts`)
and `lastClockTransitionAt` writes on every persisted clock transition (League and Event,
never on heartbeat). The shared `LiveMatchClient` component (League and Event both render it —
so this lands with full parity in one change) now derives its period-button label/state from
the resolver instead of independently inferring it; visible copy is byte-identical (verified by
the existing component test suite passing unchanged). Remaining Slice 1 work — the
server-enforced `LIVE_PERIOD_NOT_RUNNING` event guard, the forgotten-period-start recovery
sheet, and Today/Match Details convergence onto the same resolver — follows as Slice
1b/1c/1d.

Slice 1b delivered: the shared server-side event guard (`checkNormalLiveEventGuard` /
`requiresRunningPeriod`, `src/lib/live-match/live-match-domain.ts`), wired into both
`recordEventForActor` (League) and `recordEventForActorEvent` (Event) — the exact chokepoint
every browser-originated live event already passes through via the internal HMAC-authenticated
persistence endpoint. A normal event (goal, rotation, fair-play, moment, position, the
SCORER_SET/ASSIST_SET annotations) is now rejected with the typed `LIVE_PERIOD_NOT_RUNNING`
code whenever the session's own persisted clock is not running a playable period; the
period-transition events themselves, `CLOCK_ADJUSTMENT`, and the explicit correction/reversal
path stay exempt. The client also disables the corresponding buttons (`normalEventsBlocked`,
derived from the same resolver used in Slice 1a) as the documented convenience layer — the
server rejection is the actual authority. This closes the bundle's own admission that "events
are accepted before kick-off, at half-time and at full time" today; several pre-existing tests
that recorded normal events without ever starting the clock were updated to reflect the
corrected (and now enforced) invariant. The forgotten-period-start recovery sheet and
Today/Match Details convergence remain as Slice 1c/1d.

The Test-slot Playwright acceptance run (real browser, real hosted preview) caught what the
unit/component suites could not: four e2e specs (`live-reporting.spec.ts`,
`follow-live.spec.ts`, `live-reporting-offline-continuation.spec.ts`,
`post-match-evidence-parity.spec.ts`) clicked "Goal for us" immediately after "Start live
reporting" — the exact production sequence this slice's guard now correctly rejects, since
"Start live reporting" alone only creates the session (clock stays at "before kickoff") and a
real coach still has to separately start the first period. Fixed by adding the missing "Start
first half" click to each spec, matching the real required coach flow — not by weakening the
guard.

That same e2e re-run then caught a second, genuinely pre-existing bug this slice's guard simply
made visible for the first time: the fully-offline continuation path (ADR-0138 Bundle 7)
rehydrates its `activeSession` from this device's own `LocalSession` IndexedDB record when no
server round trip is possible at all — and that record never carried the running clock, only
`{id, coachId, startedAt}`. A coach who started the first half, went offline, and reloaded
would have their clock silently revert to "before kickoff" — previously invisible (nothing
checked the clock before this slice), now correctly surfaced as a disabled "Goal for us"
button, and, had the guard not existed, would have recorded the offline goal against the wrong
period. Fixed by adding `LocalSession.clock` (mirrored on every clock transition, alongside the
existing server write) and threading it through `withOfflinePackage`'s synthesized
`activeSession` in `offline-live-shell-client.tsx`.

Slice 1c delivered: the forgotten-period-start recovery sheet (bundle §02.8/§08). Tapping a
normal event button (Goal/Rotation/Position/Fair play/Moment) while between periods (Trigger A)
opens `Has <next period> started?` instead of the button staying inertly disabled — `Start now`
starts the next period at the current server time; `It started earlier` opens a duration step
(`How long has this period been running?`, 1–30 minutes, pre-filled with a suggestion clamped
to 1–15 and never auto-submitted) that starts the period with that elapsed time backdated;
`Still in break` dismisses and suppresses the automatic re-prompt for five minutes in this
client session only, per the locked decision (no durable dismiss record, never auto-starts a
period). `lastClockTransitionAt` (persisted server-side since Slice 1a but not yet read by any
client) is now threaded through `getPreMatchPackage` (League and Event) and
`LiveSessionInfo`/`EventLiveSessionInfo`, and drives Trigger B: an actual configured break
(never "before kickoff", which has no configured break duration to compare against) that has
run breakDuration + 5 minutes past its own last transition prompts automatically. Paused
mid-period and full-time stay hard-disabled — the bundle defines no recovery flow for either.
`derivePeriodTransitionEventType` (`match-clock.ts`) replaces three copies of the same
period→event-type derivation (the two pre-existing period-advance paths, plus this new one)
with one.

Slice 1d delivered (closing Slice 1's remaining scope): League Today and League Match Details
now consume the same canonical resolver instead of independently inferring "what should the
coach do next" from a bare `isLive` boolean. `getTodayLiveMatchSummaries` resolves the match's
own period config and clock into a `primaryAction`, which the "Live Now" card renders as a real
CTA into the editable Live Reporting page (`Continue live reporting`/`Start <period>`/
`Resume <period>`/`Finish live reporting`) alongside the existing read-only `Follow live`.
League Match Details resolves the same `livePrimaryAction` and uses it for its own primary
button's label, replacing the binary `isLive ? "Open live reporting" : "Start live reporting"`.
`describeLiveReportingEntryPointLabel` (`live-reporting-primary-action.ts`) is the one shared
entry-point-label mapping both surfaces call, so the same lifecycle state reads identically on
Today and Match Details. Investigation surfaced that Event has no equivalent of either surface
at all (Today's live-now loader is League-only; Event's own match-detail surface,
`event-matches-tab.tsx`, has no active-session-awareness by the author's own existing comment)
— filed as [#686](https://github.com/lagebj/matchboard/issues/686) rather than built from
scratch in this slice, since it is a missing-feature gap, not two competing implementations.

### 2026-09-26 (continued) — Slice 2a: guided debrief domain and service (no UI yet)

Delivered the debrief's domain and service layer, deliberately without the mobile UI (Slice
2b) and without wiring the report-completion gate (also deferred to 2b): wiring the gate now,
before any surface ever calls `getOrCreateDebrief` on a normal report open, would have blocked
every report completion in the app, League and Event alike, with no way for a coach to clear
it. The gate and the UI ship together in the next slice.

- `src/lib/post-match/debrief/v1.ts`: the versioned Zod answer schema (bundle §03.3/§03.4),
  `findDebriefReviewGaps`/`isDebriefReadyToSubmit` (bundle §03.6 — a no-evidence choice on every
  required row counts as fully reviewed).
- `src/lib/post-match/debrief/map-to-canonical.ts`: pure deterministic mapping functions
  (`NOT_OBSERVED` -> `null` on `TeamReflection`; opponent memory appended, never silently
  overwriting existing distinct text; "anything else" maps straight onto the report's team
  note).
- `src/lib/post-match/debrief/service.ts`: `getOrCreateDebrief` (prefills a fresh `DRAFT` from
  whatever compatible legacy TeamReflection/teamNote/opponent-factual-summary already exists —
  Event's own free-text fields prefill the debrief's free-text slots, since Event has no
  structured TeamReflection to prefill ratings from), `saveDraftDebrief`, `submitDebrief`
  (validates completeness, then one transaction maps onto the canonical models and flips the
  debrief to `SUBMITTED` — a mapping failure rolls back and the debrief stays `DRAFT`, per the
  locked decision), `reopenDebrief`. One service, driven by a `DebriefReportRef` union, for both
  League and Event — not two parallel implementations.
- Converged two pre-existing duplicate writers onto one each (bundle §03.6's explicit
  instruction, verified against real code rather than deferred): `upsertOpponentEncounterObservation`
  (`src/lib/opponents/opponent-encounter-observation.ts`, now the only writer the standalone
  opponent-observation form and the debrief both call — every field but the three identity
  fields is optional, so the debrief's `factualSummary`-only write can never clobber fields only
  the fuller form knows about) and `upsertTeamReflection` (`src/lib/coaching/team-reflection.ts`,
  now also used by the standalone Team Reflection action instead of its own inline upsert).

Not yet built: the mobile guided-debrief UI, the report-completion gate, reopen-triggered
re-fingerprinting, and retirement of the fragmented draft Reflection/Opponent/Football-observation
capture flow — all Slice 2b.

### 2026-09-27 — Slice 2b: guided debrief UI, League-side (report-completion gate now live)

Delivered the mobile-first guided-debrief wizard and wired it in for League, closing the gap
Slice 2a deliberately left open. Event's own UI convergence (its report panel still shows three
plain free-text fields plus Football observations) is Slice 2c — Event's `completeEventReport()`
is untouched here for the same reason 2a deferred League's gate: wiring it before any Event
surface creates a debrief would block every Event report completion with no way to clear it.

- `src/components/post-match/debrief/post-match-debrief.tsx` (+ `debrief-steps-ui.tsx`,
  `debrief-read-only.tsx`): one stepped wizard component for League and Event alike, driven by
  `DebriefReportRef` exactly like the service layer — dynamically imports the matching
  League/Event action module per bundle's existing `TeamReflectionSection`-style convention, so
  no second component fork was needed for Event once its own page wires this in (2c).
- `src/lib/post-match/debrief/steps.ts`: pure step order/gating helpers (`isStepComplete`,
  `computeInitialStep`) built directly on `findDebriefReviewGaps` — the wizard's Continue button
  and the server's submit-time gap check can never disagree, because they're the same predicate.
- Per-step Continue gating enforces bundle §6's "explicit review" requirement in the UI itself
  (not just at submit time): the four required steps cannot be advanced past without a choice,
  including a no-evidence one; optional steps (opponent memory, player observations, anything
  else) never block progress. 600ms-debounced autosave (bundle §7) preserves unsaved input on a
  save failure and shows `Saving…`/`Saved automatically`/`Could not save. Retry.`.
- `completeReport()` (`report-mutations.ts`) now also requires `isDebriefSubmittedForReport`
  before locking (bundle §9). Safe to enforce unconditionally, not just for new reports, because
  `/post-match` (`o/[orgSlug]/matches/[matchId]/post-match/page.tsx`) now calls
  `getOrCreateDebrief` on every page load — the same page "Complete report" lives on — so a
  coach can never reach that button without a debrief row already existing to submit.
- `reopenReport()` now also reopens the debrief (bundle §10: SUBMITTED -> DRAFT, answers
  untouched) — the only place a debrief leaves `SUBMITTED`; there is no separate standalone
  "reopen debrief" UI action.
- Retired `TeamReflectionSection` and its actions (`setTeamReflectionAction`/
  `getTeamReflectionAction`) entirely — fully subsumed by the debrief's team-execution step and
  `upsertTeamReflection`, which was already the one canonical writer as of Slice 2a. The
  richer opponent-observation form and the Football-observations list are not subsumed (they
  capture fields/history the debrief's own schema deliberately doesn't) and remain reachable
  from the Post-Match Report's Debrief tab (renamed from "Reflection" — the `reflection` URL key
  is unchanged) behind an "Additional observations (optional)" disclosure, no longer part of the
  primary required flow.

Deferred to Slice 2c: Event's own UI wiring (`EventMatchReportPanel`) and Event's completion
gate; qualitative-evidence extraction queueing (Slice 3) is unaffected by this slice.

### 2026-09-27 (continued) — Slice 2c: guided debrief UI, Event-side (League/Event parity complete)

Closed the gap 2b deliberately left open, mirroring League's own sequencing exactly (build the
UI that creates the debrief, then add the completion/reopen gates in the same slice, never
before).

- `EventMatchReportPanel` (`events/[eventId]/event-match-report-panel.tsx`) fetches/creates the
  debrief via `getEventDebriefAction` in the same `useEffect` that already loads its other
  report data, and renders `PostMatchDebrief` in place of the three retired plain
  Team-reflection/Opponent-observation/Notes textareas. Football observations and (once locked)
  the combination-evidence panel are unchanged, matching League's "not subsumed, stays
  reachable" decision from 2b for the fields the debrief's schema doesn't own.
- `completeEventReport()` and `reopenEventMatchReportAction()` got the identical gate/reopen
  hook League's `report-mutations.ts` got in 2b (`isDebriefSubmittedForReport` /
  `getOrCreateDebrief`+`reopenDebrief`).
- One real difference from League worth recording: Event's "Complete" button
  (`event-matches-tab.tsx`) lives in the match list row itself, reachable **without** ever
  expanding that match's report panel — unlike League's `/post-match` page, where the debrief is
  always on-screen before "Complete report" is reachable. This is still safe (a debrief is
  always created the first time the panel is opened, and the coach must open it to submit
  before Complete can succeed — there is no dead end), but it does mean a coach can hit the new
  "submit the post-match debrief first" rejection without having seen why. Fixed the other real
  gap this exposed while here: `handleCompleteReport()` previously discarded
  `completeEventMatchReportAction`'s thrown error entirely (pre-existing, not previously
  consequential enough to notice) — it now surfaces the message instead of failing silently.
- League/Event parity for the guided debrief (ADR-0152 §3) is now complete. Slice 3
  (qualitative-evidence extraction) is unaffected by this slice.

### 2026-09-27 (continued) — Slice 3a: deterministic qualitative-evidence writer (League only)

Bundle `04_QUALITATIVE_EVIDENCE_MODEL.md`. The `QualitativeEvidenceExtractionRun`/
`QualitativeEvidenceObservation` schema (enums included) was already in place from Slice 0; this
slice is the first thing that actually writes to it.

- `src/lib/evidence/qualitative-evidence-service.ts`: `recordDeterministicExtraction` — the
  fingerprint-keyed idempotency/supersession writer (bundle §9/§11). Reuses the existing
  `computeSourceFingerprint`/`stableSerialize` helper (`src/lib/ai/fingerprints.ts`, built for AI
  review reuse) rather than inventing a second hashing scheme, per bundle §10's own instruction
  to "use current stable fingerprint helper where practical." Plus the four tenant-scoped read
  helpers bundle §16 asks for (`getQualitativeEvidenceForMatch/TeamWindow/Opponent/Player`), all
  filtering to `SUCCEEDED` + `supersededAt: null` only.
- `src/lib/post-match/debrief/map-to-qualitative-evidence.ts`: pure mapping for exactly the
  paths bundle §14 marks genuinely deterministic — Worked, Needs attention, and the
  WE_CHANGED/OPPONENT_CHANGED/NO_MEANINGFUL_CHANGE/UNSURE branches of What changed, and Opponent
  memory. BOTH_CHANGED ("one answer may need split scopes") and Anything else ("scope is
  open-ended") are AI_STRUCTURED per the bundle — deliberately produce nothing here; a later
  slice queues those through the existing AI cron infrastructure.
- Wired into `submitDebrief()`'s LEAGUE branch, inside the existing transaction, after the
  canonical-model writes and before commit (bundle §8 step 5). Verified end-to-end in
  `service.test.ts`, including that a resubmit-after-reopen with a changed answer supersedes the
  prior evidence rather than duplicating it.
- **Event is deliberately out of scope for this slice.** `QualitativeEvidenceObservation.teamId`
  is required, but Event has no relation to `Team` anywhere in its model tree (`EventMatch` ->
  `EventSquad` -> `Event` -> `footballGroupId`, never a `Team`), and this app supports
  multi-team organisations, so there is no safe default to fall back to. Filed as
  [#691](https://github.com/lagebj/matchboard/issues/691) rather than guessed at — routes
  through `adr-governance` once a direction is picked, since it changes either the schema's
  required-field shape or the query-helper contract. `submitDebrief()`'s EVENT branch has a
  comment pointing at the issue; Event debrief submissions are otherwise fully unaffected
  (unchanged canonical-model writes, same as Slice 2c).

Deferred to a later Slice 3 sub-slice: the AI_STRUCTURED extraction queue (BOTH_CHANGED,
Anything else, and the legacy free-text sources — `POST_MATCH_TEAM_NOTE`, `TEAM_REFLECTION_NOTE`,
`MATCH_NOTE`, `QUICK_OBSERVATION`, `OPPONENT_ENCOUNTER_TEXT`, `AI_CLARIFICATION`), processed via
the existing AI cron infrastructure per bundle §9. Slice 4 (Assistant Coach AI contract v2) is
unaffected by this slice.

### 2026-09-27 (continued) — Slice 3b: AI_STRUCTURED qualitative-evidence extraction (BOTH_CHANGED, Anything else)

Closes the gap 3a deliberately left open. Reuses the existing AI cron infrastructure's building
blocks (`getOrganisationAiSettings`, `getProviderConnection`, `getProviderAdapter`,
`withProviderCredential`, `fromPrismaAiProviderId`) exactly as bundle §9 asks, but as a genuinely
separate queue table and output contract from `AiAdvisorJob`/`AiAdvisorInsight` — the two models
have unrelated columns and response shapes, so sharing the cron *entrypoint*
(`/api/cron/ai/route.ts`, now with its own isolated try/catch step, matching this route's own
established "one step's failure must never block another" discipline) was the right level of
reuse, not sharing `ai/jobs/runner.ts`'s claim/persist internals.

- `src/lib/evidence/qualitative-evidence-extraction-contract.ts`: the strict Zod output contract
  (bundle §13) plus the stable prompt instructions (bundle §13's ten numbered rules) and a
  semantic-validation pass — every source this slice wires supplies zero player refs, so any
  PLAYER/PAIR-scoped observation is always ungroundable and rejects the whole response, matching
  `validateAdvisorResponse`'s own all-or-nothing philosophy for an unresolvable ref.
- `src/lib/evidence/qualitative-evidence-enqueue.ts`: `enqueueQualitativeExtraction` — idempotent
  per fingerprint (bundle §9), and deliberately does not enqueue at all when AI is disabled or
  has no active connection (bundle §10 "AI disabled": "Source text is preserved for future
  backfill" — an abandoned QUEUED row for unchanged text would otherwise block a fresh enqueue
  once AI is later re-enabled, since the unique index is keyed by fingerprint).
- `src/lib/evidence/qualitative-evidence-extraction-runner.ts`: claims due `AI_STRUCTURED` runs
  the same atomic way `ai/jobs/runner.ts` claims `AiAdvisorJob` rows, then rebuilds each run's
  source text fresh from the *current* debrief at process time (same "never trust the
  possibly-stale enqueue-time snapshot" discipline `ai/jobs/runner.ts` already established for
  its own context) before calling the provider. A zero-text source (the coach resubmitted away
  from BOTH_CHANGED, or cleared "Anything else") succeeds without ever calling the provider.
  Chunking (bundle "Extraction bounds": required only above 6,000 input chars) is inapplicable
  to both wired sources — the debrief schema caps free-text fields at 2,000 chars — so this
  slice does not implement it; revisit once a source that can exceed 6,000 chars is wired (the
  legacy/backfill sources, Slice 7).
- **Found and fixed a same-branch bug before it ever shipped**: the deterministic writer (3a)
  was calling `recordDeterministicExtraction` for `POST_MATCH_DEBRIEF_CHANGE` unconditionally,
  including for BOTH_CHANGED (with zero observations, since `buildChangeObservations` already
  excluded it) — which would have permanently occupied that exact `(sourceType, sourceId,
  sourceFingerprint)` slot with a `DETERMINISTIC` `SUCCEEDED` run, making this slice's own
  `enqueueQualitativeExtraction` see it as already-tracked and silently starve BOTH_CHANGED of AI
  extraction forever. Fixed by skipping the deterministic call entirely for BOTH_CHANGED,
  leaving that fingerprint's slot to the AI_STRUCTURED enqueue exclusively.
- Wired into `submitDebrief()`'s LEAGUE branch, after the transaction commits and after
  `writePlayerObservations` (bundle §8 step 7 — enqueueing itself never calls a provider, so it
  does not need to wait for a request/transaction boundary the way the actual provider call
  does).

Slice 3 (qualitative evidence) is now functionally complete for League. Event remains blocked on
issue #691. The remaining four `QualitativeEvidenceSourceType` values (legacy free-text sources)
have no resolver in `qualitative-evidence-extraction-runner.ts` yet — inert until Slice 7's
bounded backfill actually enqueues them, not a gap in this slice. Slice 4 (Assistant Coach AI
contract v2) is unaffected by this slice.

### 2026-09-27 (continued) — Slice 4a: AI contract v2 foundation (schema, validation, persistence)

Bundle §5 "Contract version 2". The persistence schema (`AiInsightAnalysisRole` enum,
`AiAdvisorInsight.analysisRole`/`clarificationQuestion`/`clarificationOptions`/`displayOrder`,
and the whole `AiInsightClarification` model) was already in place from Slice 0, unused until
now — this slice is the first thing that actually populates it.

- `AI_CONTRACT_VERSION` bumped `"1"` -> `"2"`. `advisorInsightSchema` gains `analysisRole`
  (nullable, the 7 locked plan-vs-reality roles) and `clarificationPrompt` (nullable, `{question,
  options}`), each enforced by a `.refine()`: `clarificationPrompt` is non-null if and only if
  `analysisRole` is `EVIDENCE_GAP` (bundle §3's rule holds in both directions — an EVIDENCE_GAP's
  whole purpose is asking its one clarifying question). `advisorResponseSchema` gains its own
  `.refine()` for bundle §14's "at most one active clarification per match review" (at most one
  EVIDENCE_GAP insight per response). Confirmed `z.toJSONSchema()` still introspects correctly
  through both `.refine()` wrappers (verified directly against this project's zod version before
  relying on it) — every provider's structured-output schema and Ollama's embedded-schema prompt
  text pick up the two new required fields automatically, with no adapter code changes.
- `ai/jobs/runner.ts`'s `persistSuccessfulReview()` now writes `analysisRole` (mapped through a
  new `toPrismaAnalysisRole()`, mirroring `toPrismaAiInsightKind()`), `clarificationQuestion`/
  `clarificationOptions` from `clarificationPrompt`, and `displayOrder` (the provider response
  array index, per bundle §4).
- Deliberately did **not** touch any of the 5 existing capability handlers
  (`context/match-prep.ts`, `lineup-review.ts`, `post-match-review.ts`, `weekly-team-review.ts`,
  `round-review.ts`) or their prompts. `analysisRole`/`clarificationPrompt` being required-but-
  nullable is exactly what makes every non-upgraded capability's response continue to validate
  with `analysisRole: null` — no capability needs new instructions merely to emit `null` for a
  field it was never told has any other meaning (bundle §3: "non-post-match capabilities may use
  null unless explicitly upgraded"). Structured-output enforcement (native JSON schema, or
  Ollama's embedded-schema-plus-repair-retry) makes the two new keys' *presence* automatic
  regardless; only Slice 4c/4d's post-match-specific prompt work teaches a capability to produce
  a genuinely non-null role.
- Updated every existing AI test fixture across 7 files that constructed a raw advisor-response
  literal (`contracts.test.ts`, `response-validation.test.ts`, `runner.test.ts`, and the 5
  provider adapters' own `probeModel`/`executeReview` fixtures) to include the two new fields
  and the new contract version — real, necessary migration work for a shared contract bump, not
  a weakened test.

Deferred to later Slice 4 sub-slices: pre-match-expectation selection (§5), the richer post-match
context builder and required reasoning sequence (§6-13), clarification end-to-end wiring (§14),
fingerprint materials (§15), Advisor presentation ordering/error states (§16-17), and the
weekly/round review role upgrades (§18-19). Nothing in this slice changes behavior a coach can
observe yet — every capability still produces exactly the insights it always did, just with two
new always-null (for now) fields persisted alongside them.

### 2026-09-27 (continued) — Slice 4b: pre-match-expectation selection

Bundle §5 "Select the actual pre-match expectation." `src/lib/ai/context/pre-match-expectations.ts`'s
`selectPreMatchExpectations(ref, organisationId)` — League/Event-generic via the same
`FootballMatchRef` every other evidence module already uses, not a second League/Event branch
scheme.

- Cutoff resolution exactly per §5's three-way rule: `LiveMatchSession.startedAt` (or
  `EventLiveMatchSession.startedAt`) if a live session exists, else `PostMatchReport.createdAt`
  (or `EventPostMatchReport.createdAt`), else `EMPTY_PRE_MATCH_EXPECTATIONS` — never a
  retrospectively-generated review.
- Selects the latest `SUCCEEDED` `MATCH_PREP`/`LINEUP_REVIEW` review for the same match scope
  (`scopeType: "MATCH"`, the same `scopeId` post_match_review itself uses) completed at or before
  that cutoff.
- Resolves each selected insight's subject through its already-persisted `subjectId` (a real,
  stable database ID `runner.ts` resolves and stores at the time that review succeeds) rather
  than through the review's ephemeral `P01`-style ref tokens. This is deliberately different
  from `resolve-insight-text.ts`'s UI-display pattern, which requires rebuilding the same
  capability's context and checking the fingerprint still matches *today*, falling back to a
  "stale" placeholder when it doesn't: a historical plan snapshot being stale relative to
  *today's* plan is expected and correct here (the match was played against whatever the plan
  was at the time, not today's edited version), so there is no freshness check to perform and no
  "stale" case to fall back from — `subjectId` alone gives an unambiguous real name regardless of
  whatever ref token still appears in the stored prose.
- Only `state: "ACTIVE"` insights are ever selected — a dismissed/superseded insight from the
  pre-match review is not a "genuine plan the coach was working from" any more.

Each returned review carries its own `sourceFingerprint` — the ingredient Slice 4c's context
builder needs to satisfy bundle §15's "selected pre-match review fingerprints" fingerprint-
material requirement; the full fingerprint-materials checklist is Slice 4c's job once the actual
`normalizedContext` shape is decided, not separately addressed here. Slices 1-3 are unaffected.

### 2026-09-27 (continued) — Slice 4c: post-match review context builder v2

Bundle §6-13: the `post_match_review` capability's context builder (`src/lib/ai/context/post-
match-review.ts`) is rewritten to assemble the full plan-vs-reality evidence surface, replacing
the v1 builder that only reported bare goals/assists/attendance/minutes/development-focus. The
top-level `normalizedContext` shape changes from a flat object to a nested one (`actual`, `match`,
`plan`, `playerContext`, `opponentHistory`, `recentTeamPatterns`, `currentQualitativeEvidence`,
`developmentFocus`) — a breaking shape change for this capability's own consumers, contained
entirely within this one context builder and its handler; no other capability is touched.

- **`actual`**: goals/assists/attendance/minutes (as v1), plus new bench-interval and
  substitution facts derived from the same `getActualPositionIntervalsForRef()` read that already
  powers minutes — no second query. Guest players are excluded "for free" (the same mechanism
  Slice 2's timeline evidence already relies on): only real playerIds ever get an ephemeral ref,
  so an interval keyed to an unresolved guest id is silently dropped rather than needing its own
  guest-detection branch.
- **`match.recoveredTiming`**: reuses `getMatchTimingReviewItems(ref)` (already League/Event-
  generic) verbatim — no new query logic, just a new fact built from an existing evidence read.
- **`plan`/`playerContext`/`opponentHistory`**: League-only. These come from the Match Insights
  domain layer (`buildCurrentPlanInput`/`buildMatchInsightFacts`, ADR-0149), which is itself
  League-only today (`buildCurrentPlanInput` queries `db.match` directly, with no Event
  equivalent). Rather than block this slice on building a parallel Event domain layer or silently
  shipping a degraded Event experience, this is a deliberate, documented scoping decision: Event
  matches get every section that genuinely is League/Event-generic (`actual`, recovered timing,
  `currentQualitativeEvidence`, `preMatchExpectations`) and `null`/`[]` for the three League-only
  sections. Tracked as issue #696 (this is the same root architectural gap as issue #691's
  Event-side qualitative-evidence limitation — Event simply has no `teamId`-equivalent concept
  yet for the domain layer to key off).
- **`plan.preMatchExpectations`**: calls Slice 4b's `selectPreMatchExpectations(ref,
  organisationId)` for *both* League and Event (it is already generic and degrades to `null`
  gracefully). Only `title`/`body`/`summary` are ever copied into `normalizedContext` —
  `subjectName`/`secondarySubjectName` (the real names `selectPreMatchExpectations` resolves for
  its own, different, UI-facing use) are deliberately never forwarded to the provider payload.
  This was a self-caught design check, not a fix: the pre-match review's own stored insight text
  never contained a real name to begin with (only that capability's own opaque `P01`-style
  tokens), so the actual risk was only ever "don't newly introduce a real name here" — satisfied
  by construction, not by redaction. `instructions` gained an explicit warning that ref tokens
  quoted inside this block belong to a different capability's own numbering and must never be
  treated as this review's refs.
- **`recentTeamPatterns`**: new. League-only (keyed off `raw.teamId`, which has no Event
  equivalent for the same reason as the three sections above). Considers the team's own prior
  *locked* matches within a rolling 42-day/8-match window (`RECENT_TEAM_PATTERN_WINDOW_DAYS`/
  `RECENT_TEAM_PATTERN_MAX_MATCHES`), pulls their active qualitative evidence via a new
  `getQualitativeEvidenceForMatches(matchIds, organisationId)` helper (`qualitative-evidence-
  service.ts` — the existing helpers either cap by count within a raw date window or take a
  single opponent; this one takes the caller's own already-decided bounded match set), then
  ranks per bundle §7's 4-tier priority (same exact opponent > same tactical theme as today's own
  debrief `worked`/`needs_attention` selections > same participating player > newest), dedupes
  exact statements case-insensitively keeping the newest, and caps at
  `RECENT_TEAM_PATTERN_MAX_OBSERVATIONS` (60). `PostMatchReport` has no `match` relation field
  (only a scalar, unique `matchId`), so "prior matches with a locked report" is necessarily two
  sequential queries (candidate matches by team+date range, then which of those have a `LOCKED`
  report), not one relational query — documented inline to save the next reader a Prisma-schema
  round-trip.
- **`currentQualitativeEvidence`**: League/Event-generic. Raw debrief answers (read once via a
  new shared `readCurrentDebriefAnswers()` helper — the original draft duplicated this query
  across two sections before being consolidated), explicit per-player observations from the
  debrief's own `player_observations` answer, this match's own active qualitative evidence rows
  (`getQualitativeEvidenceForMatch`), `TeamReflection`, the opponent-encounter factual summary,
  and the report's own team note (League: `PostMatchReport.teamNote`; Event:
  `EventPostMatchReport.notes`, discriminated structurally since the two report types don't share
  a field name).
- Two Prisma-shape bugs caught by typecheck before merge, not at runtime: `TrustedOpponentObservation
  .encounterDate` is a `Date`, not `JsonValue`-compatible, so it is serialized to an ISO string
  when copied into `opponentHistory.previousEncounters`; and the two-query restructuring above
  (there is no `PostMatchReport.match` relation to filter/order through directly).
- Test coverage added for every new section (bench/substitution facts, recovered timing, the
  full current-qualitative-evidence set, League Plan/PlayerContext/OpponentHistory populated
  end-to-end, Event parity — confirming the three League-only sections stay `null`/`[]` while the
  generic sections still populate — recent-team-patterns ranking/window/cap behaviour, and a
  privacy assertion that no real player name ever appears in the serialized `normalizedContext`
  even when a referenced pre-match insight's `subjectId` resolves to one internally).

This is the first slice in the programme where a shipped capability's actual AI-facing behavior
changes for a real coach (`post_match_review` responses will now reason over materially more
evidence) — versioned as a MINOR bump rather than the PATCH bumps used for 4a/4b, which changed
only unused persistence columns and an unconsumed selector. This slice's `instructions` string
also already teaches the model the full required reasoning sequence (bundle §8-13: SUPPORTED/
CONTRADICTED/UNRESOLVED/SURPRISING/RECURRING_PATTERN/NEXT_FOCUS/EVIDENCE_GAP) — so
`post_match_review` can, from this slice onward, actually populate a non-null `analysisRole`,
not just always emit `null` as every capability could since 4a. Deferred to 4d: the
`AiInsightClarification` answer-capture and evidence-gap-retrigger round trip an EVIDENCE_GAP
insight's clarifying question depends on. Deferred to 4e/4f: Advisor presentation ordering and
the weekly/round review role upgrades.

### 2026-09-27 (continued) — Slice 4d: clarification / evidence-gap round trip

Bundle §14: "Persist answer in AiInsightClarification. Convert answer into deterministic ...
qualitative evidence, then trigger [the capability] again through normal fingerprinting."
`src/lib/ai/insight-clarification.ts`'s `answerAiInsightClarification()`.

- A plain domain service, not a "use server" action — page-level authorization, audit logging,
  and `revalidatePath` belong to whichever route's own action wrapper eventually calls this
  (mirroring `runPostMatchLearning`/`recordDeterministicExtraction` themselves being plain
  services beneath their own page actions), matching how 4a/4b's own persistence/selection layer
  shipped ahead of any UI consuming it. No UI calls this yet — wiring an EVIDENCE_GAP insight's
  clarifying question into the Advisor's presentation is 4e's job (bundle §16-17), including
  showing "Clarify one thing if present" as the surface that would call this service.
- Validates defensively against a tampered/stale request even though contract v2's own
  `.refine()` already guarantees analysisRole/clarificationPrompt correlate at persistence time:
  the insight must be `state: "ACTIVE"`, `analysisRole === "EVIDENCE_GAP"`, and carry a
  `clarificationQuestion`; a `selectedOption` must be literally one of the insight's own
  persisted `clarificationOptions` (never trust a caller-supplied option string against the
  model's own generated set).
- Deliberately generic over whichever capability produced the EVIDENCE_GAP insight (retriggers
  via `review.capability`/`review.scopeType`/`review.scopeId`, never a hardcoded
  `POST_MATCH_REVIEW`) — today only `post_match_review`'s own prompt ever emits a non-null
  `analysisRole` (4c), but bundle §18 allows `weekly_team_review` the same role once 4f upgrades
  it, and this service will already work for that without changes.
- The deterministic evidence conversion (`recordDeterministicExtraction`, `sourceType:
  "AI_CLARIFICATION"`, `sourceId: insightId` — a stable, unique lineage since
  `AiInsightClarification.insightId` is itself unique) is League-only, for the same structural
  reason as every other deterministic writer in this domain (`qualitative-evidence-service.ts`'s
  own doc comment, issues #691/#696): an Event match has no `teamId` to key the write off. The
  answer is still persisted and the capability still retriggered regardless — only the
  evidence-derivation half is skipped for Event.
- Scope/phase/polarity are assigned structurally, not by asking a provider to classify free
  text (that would stop this being "deterministic" derivation): `scope` from the originating
  insight's own `subjectType` (`PLAYER`/`PLAYER_PAIR` → `PLAYER`/`PAIR` with the resolved
  player id(s), else `TEAM`), `phase: GENERAL` and `polarity: UNCERTAIN` always (a clarification
  answer resolves an ambiguity the model itself flagged — there is no structural signal for
  which tactical phase or which direction it points, unlike the debrief's own fixed
  worked/needs-attention theme selections), and `explicitness: EXPLICIT` when the coach chose
  one of the offered options versus `TENTATIVE` for open-ended free text.
- Re-answering the same insight is an upsert (`AiInsightClarification.insightId` is `@unique`) —
  a changed answer's new `fingerprintPayload` naturally supersedes the prior `AI_CLARIFICATION`
  extraction run through `recordDeterministicExtraction`'s existing supersession logic; no new
  supersession mechanism was needed.
- No new fingerprint-material wiring was needed in `post-match-review.ts` itself: the converted
  observation lands in the same `QualitativeEvidenceObservation` table, keyed to the same
  `matchId`, that `currentQualitativeEvidence.activeQualitativeObservations`
  (`getQualitativeEvidenceForMatch`) already reads with no `sourceType` filter — so answering a
  clarification automatically changes the next context build's fingerprint (bundle §15's
  "active qualitative evidence" material) purely as a consequence of 4c's existing read path,
  confirmed by this slice's own retrigger test.

Slice 4 is now functionally complete end-to-end for `post_match_review` (contract v2 schema,
pre-match-expectation selection, the full v2 context builder, and the clarification round trip)
with no UI surface yet — 4e is exclusively presentation (ordering, hide-empty-sections,
show-first-five, evidence-source labels, error states) and 4f is the weekly/round review role
upgrades. No coach-observable behavior changes in this slice on its own (there is still no UI
that can produce an EVIDENCE_GAP clarification for a coach to answer) — versioned as a PATCH
bump, matching 4a/4b's own reasoning.

### 2026-09-27 (continued) — Slice 4e: Advisor presentation (ordering, evidence labels, error states)

Bundle §16-17. `getCompletedMatchAdvisorViewModel()` (`completed-match-advisor.ts`) rewritten to
surface everything 4a-4d built and persisted but never exposed to a coach; the "completed match"
Advisor panel and its supporting server action are the first real UI/action consumers of
contract v2's `analysisRole`/`clarificationPrompt` and of `AiInsightClarification`.

- **Two small, contained corrections to 4c's own work, found while implementing this slice's
  ordering**, both fixed here rather than deferred:
  - `post-match-review.ts`'s reasoning-sequence instructions told the model to use a
    `RECURRING_PATTERN` role for a recurrence found via `recentTeamPatterns` — but bundle §16's
    post-match presentation order has no slot for that role at all, and §18 reserves it for
    `weekly_team_review` only. Corrected the instruction to route a recurrence finding through
    SUPPORTED/CONTRADICTED/SURPRISING instead (whichever the evidence actually supports), never
    a role this capability's own presentation cannot render.
  - `plan.preMatchExpectations` had no `evidenceRef` at all — every other context section does,
    but this one was missed — so the model had no way to literally satisfy §16's "Previous
    Assistant Coach expectation" evidence-source label; nothing could ever be classified into
    that bucket. Added `fact:pre-match-expectation:MATCH_PREP:{matchRef}` /
    `..._LINEUP_REVIEW:...` evidence refs (the quoted `summary`/`insights` text itself is
    unchanged — still opaque foreign prose, never resolved, per 4c's own doctrine).
- **Presentation order** (§16 steps 1-7, `SECTION_ORDER`): Summary (the review's own `summary`
  field, persisted since 4a but never previously read by this view model) → Supported →
  Contradicted → Still unresolved → Unexpected → Next focus → Clarify. A `null` `analysisRole`
  (every pre-4c/contract-v1 row) or an unexpected value falls back to a catch-all "Observations"
  bucket at the end rather than being silently dropped — cheap defensive handling for whatever
  legacy/edge-case data already exists, not a bundle requirement.
- **Show first five, show all**: the service returns the *full* ordered insight list (no
  server-side truncation — `MAX_INSIGHTS`'s old DB-level `take: 5` is gone); the client component
  (`completed-match-advisor-panel.tsx`) slices to `VISIBLE_INSIGHT_COUNT` and reveals the rest on
  "Show all". Kept client-side deliberately — the model already produced a small, bounded set
  (contract v2 caps NEXT_FOCUS at two and EVIDENCE_GAP at one; nothing enforces a hard cap on
  SUPPORTED/CONTRADICTED/UNRESOLVED/SURPRISING today, but real counts stay small in practice) —
  so no pagination round-trip is needed to reveal the rest.
- **Evidence source labels**: a small prefix-to-label table
  (`fact:score:`/`fact:goal:`/... → "Match data", `fact:debrief`/`fact:active-qualitative-
  evidence:`/... → "Coach observation", `fact:pre-match-expectation:` → "Previous Assistant
  Coach expectation", `fact:player-context:`/`fact:development-focus:` → "Development
  evidence") classifies each insight's own persisted `evidenceRefs`, deduplicated and shown in a
  fixed order under the insight — no new schema, no new persistence, purely a read-time
  classification of data the response-validation stage already checked at write time.
- **Error states** (§17), two new tiny presentational components (`AdvisorPanelReviewing`,
  `AdvisorPanelUnavailable`) alongside the existing `AdvisorPanelStale`: the view-model builder
  now falls through to an `AiAdvisorJob` lookup keyed to the *current* fingerprint whenever no
  usable `SUCCEEDED` review exists yet — `QUEUED`/`RUNNING` → "Assistant Coach is reviewing this
  match.", `FAILED` → "Assistant Coach analysis is unavailable right now. Your match report and
  evidence are saved." A `stale`-but-successful review's content is always preferred over either
  banner when both exist (a coach should never see a bare spinner when real, if outdated,
  content is sitting right there) — confirmed by this slice's own precedence test. AI-disabled
  still short-circuits to `null` before any of this is reached, so "no error banner when AI is
  disabled" needed no new code.
- **`stale` now carries content, not just a label** — a real behavior change from 4c/earlier:
  previously `{status: "stale"}` discarded the old review's insights entirely; now the same
  content renders with a "Based on an earlier version of this report" note (§17's literal
  wording) above it. This required resolving `resolve-insight-text.ts`'s own documented tension
  directly: that module's doc comment says a stale review "must never reach" ref-token
  resolution, because ref assignment is deterministic over *current* data and a mismatched
  fingerprint means the freshly-rebuilt `refMap` may not agree with the stale review's own
  numbering — resolving anyway risks attaching a *wrong* real name to old text. Resolved by never
  calling `resolveInsightText` for a stale review's `title`/`body`/`summary`/clarification text
  (left with any literal ref tokens exposed, a display degradation, not a correctness gap) while
  still resolving development-suggestion player names unconditionally (`actionPayload.playerId`
  is a real, stable DB id, independent of ref-token numbering, safe regardless of freshness).
- **Clarification UI**: a new `answerAiInsightClarificationAction` in `matches/[matchId]/ai-
  insight-actions.ts` (validates the insight is a live `EVIDENCE_GAP` the coach can access, then
  delegates to 4d's `answerAiInsightClarification()` for the actual persist/convert/retrigger,
  matching every other action in that file's own authorization/audit/revalidate-then-delegate
  shape) and a `ClarifyCard` in the panel (offered options as buttons, free text as a fallback,
  submit disabled until one is given). This is the first real caller of Slice 4d's service.
- Test coverage: 12 tests for the rewritten view model (ordering, the `OTHER` fallback bucket,
  evidence-source classification, clarification separation, show-all-returns-full-list, all three
  error states, and the stale-vs-in-flight precedence rule), reusing the existing 5 passing
  fresh/suggestion/disabled tests unchanged to confirm no regression.

This is the first coach-observable behavior change since 4c, and on reflection it is more than a
UI refinement: showing the richer sections is exposing data that already existed (a PATCH-shaped
change on its own), but **answering a clarifying question is a genuinely new coach-facing
interaction** — a new form, a new server action, and a new mutation path (persist the answer,
derive qualitative evidence from it, retrigger the AI review) that could not be reached by a
coach at all before this slice. That satisfies `docs/VERSIONING.md`'s "New user-facing feature"
MINOR criterion on its own merits, independent of 4c's earlier MINOR bump for the underlying
context/prompt change — so this slice is versioned MINOR (0.148.1 -> 0.149.0), not PATCH. 4f
(weekly/round review role upgrades) is the only remaining Slice 4 sub-slice.
