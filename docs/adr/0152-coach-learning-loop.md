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
