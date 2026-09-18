# Live match realtime

Live match reporting is coordinated in real time by a Cloudflare Worker + Durable Object per
active match, backed by Neon/Postgres as the durable system of record and a browser-side
IndexedDB outbox for durability across disconnects. This document describes the architecture
as it exists today, after ADR-0086 (initial Durable Object coordination), ADR-0138 (canonical
operation stream, persisted sequence, scoped offline continuation), and ADR-0140 (Event
live-reporting group-mutation authorization) all shipped and the Production cutover completed.

Read `docs/adr/0086-live-match-realtime-cloudflare-durable-objects.md`,
`docs/adr/0138-canonical-live-operation-stream-persisted-sequence-and-scoped-offline-continuation.md`,
and `docs/adr/0140-event-live-reporting-group-mutation-authorization.md` for the full decision
records before changing anything here.

## Current architecture

- The Cloudflare Durable Object (`MatchSessionObject`, `workers/live-match/`) is the only
  normal canonical-ordering authority for new live operations, for both League and Event. A
  direct HTTP write to Neon is never a valid alternate canonical path while the coordinator is
  reachable — this replaces ADR-0086's original "HTTP is an equally-valid concurrent path"
  design, per ADR-0138.
- Neon/Postgres is the durable system of record. Every canonical event, regardless of which
  path accepted it, is written by the same owning persistence function
  (`recordEventForActor()`); nothing a coach or parent ultimately sees (season stats, match
  reports, fairness calculations) ever reads Durable Object storage directly.
- The browser uses a durable IndexedDB outbox, not a `synced: boolean` flag: every live action
  is persisted locally (`LOCAL_PENDING`) before any network attempt, then moves through
  `SENDING` → `ACCEPTED_PENDING_PERSISTENCE` → `PERSISTED`, with `NEEDS_REVIEW` and
  `FAILED_TERMINAL` as terminal-but-retained states. A browser crash after the local write
  never loses the action, and automated cleanup may only remove rows that are durably
  `PERSISTED` and past a short retention window.
- No direct browser HTTP fallback is allowed to create an independently-ordered canonical live
  event. When the coordinator is unavailable, the browser keeps the command in its local
  outbox and retries — it does not fall through to an alternate canonical write surface. The
  existing HTTP server action still exists, but only as an internal step the coordinator's own
  persistence flow uses (via the signed internal endpoint), not as a caller-facing canonical
  path.
- League and Event both use protocol v2 and the shared realtime coordinator — see "League and
  Event parity" below.
- Canonical sequence is persisted per session (see "Canonical operation ordering" below).
- A shared projection/reducer feeds both the reporter's own view and the read-only Follow Live
  viewer — no surface maintains an independently-calculated score, clock, on-field set, or
  position state.
- Conflicts are domain-aware: a state-sensitive operation whose precondition no longer holds
  becomes a structured, machine-readable conflict outcome and a browser-local `NEEDS_REVIEW`
  state — never last-write-wins, silent drop, or an invented equivalent operation.
- Prepared live sessions support scoped offline continuation (see "Offline continuation"
  below) — this is deliberately not broad offline Matchboard mode.

## League and Event parity

Both League and Event now share one behavioural contract for live reporting:

- both use coordinator ordering (protocol v2, the shared Durable Object model) — Event gained
  real Durable Object coordination in ADR-0138's migration, closing the gap where
  `event-live-match-client.tsx` previously called its record-event action unconditionally with
  no realtime client, no reconnect/presence wiring, and zero coordinator involvement;
- both have persisted session clocks — `EventLiveMatchSession` gained the same clock-persistence
  columns League's `LiveMatchSession` already had (ADR-0133 H2), closing the parity gap
  disclosed through Bundle 9 of the live-match-realtime programme;
- both can Follow Live — Event has its own read-only "Follow Live" viewer reading through the
  same shared canonical projection League's does;
- both report-mode paths require organisation mutation authority plus group mutation authority
  for non-admin users (ADR-0140 brought Event's authorization in line with League's — see
  "Reporter vs Follow Live authorization" below);
- Event planning outside live reporting (squad generation, lineup editing, and other Event
  planning actions) is unchanged by any of this — it remains outside the live-reporting
  authorization model described here.

Do not describe Event as lacking clock persistence, lacking Durable Object coordination, or
having org-only live-mutation authorization — all three were true historically (see ADR-0138's
Context and ADR-0140's Context for the specific pre-cutover findings) but are not true of the
current architecture.

## Live Reporting guardrails and match format (ADR-0146)

League and Event share one guardrails module
(`src/lib/live-match/live-reporting-guardrails.ts`) — no per-domain duplicate of any threshold:

- **Timestamp authority**: every guardrail is anchored ONLY to the session's actual `startedAt`
  (set once, server-side, at session creation). Scheduled kickoff (`Match.startsAt`/
  `EventMatch.startsAt`) is fixture/calendar context and is never an input to any warning or
  limit — a fixture moved in real life but not updated in Matchboard can neither trigger nor
  dodge a guardrail. A match rescheduled four real-world hours later than Matchboard's stored
  `startsAt`, with Live Reporting only actually started at the new time, still gets a full fresh
  240/270-minute window from that actual start — the stale scheduled `startsAt` is never read by
  any guardrail formula.
- **Configured period duration is an intended duration, not an automatic whistle.** No threshold
  stops a clock, ends a period, or changes player minutes by itself. An explicit coach "End
  period" always preserves the actual elapsed duration, however long — even one far longer than
  the recovery ceiling below, because an explicit end is a referee decision the system never
  overrides. Warnings exist only to catch forgotten clock state, never to enforce a duration.
- **Warnings** (all non-destructive, `LiveReportingWarningBanner`):
  - period overrun: active period past `intended + max(10m, 25% of intended)` (format snapshot
    required);
  - contextual whole-match: session past `expected wall-clock + max(30m, 50% of expected)`
    (format snapshot required);
  - legacy fallback: fixed 180 minutes when NO format snapshot exists — never a guessed format;
  - strong at 240 minutes: persistent, names the automatic finish;
  - expired presentation at 270 minutes: the client shows the expired status; the server-side
    reconciliation job (below) is the actual finish authority, not the client.
  - "Continue live reporting" is presentation-only — it never moves `startedAt`, the format
    snapshot, or any deadline; dismissing/continuing past any of these warnings changes no
    persisted timing state at all.
- **Match format freeze**: the effective format (Match override > Team override > LeagueSeason
  default, complete-or-inherit — each level is a complete definition, never a field-by-field
  merge) resolves once, at the same server transition that starts Live Reporting, onto
  `LiveMatchSession`/`EventLiveMatchSession` (`format*` + `formatSource` + `formatSnapshotAt`). A
  later Season/Team format change never reinterprets an already-live or completed match — only a
  match that has not yet started Live Reporting resolves current configuration, at its own
  future start. A Match-level override is editable only before Live Reporting starts; once live,
  the match detail shows the frozen format instead, read-only.
- **Follow Live** renders the same warning information warning-neutral and read-only — no
  Continue/Finish actions, no mutation controls (bundle §05.16).

### Finish Live Reporting — one shared operation

`finishLiveReporting(ref, trigger, context)` (`src/lib/live-match/finish-live-reporting.ts`) is
the *only* way a `LiveMatchSession`/`EventLiveMatchSession` completes, for both League and Event,
built on the `FootballMatchRef` discriminated union (ADR-0104). A manual "Finish Live Reporting"
click and the 270-minute server-side timeout below call this exact same function with a different
`trigger` (`"MANUAL"` | `"TIMEOUT"`) — `trigger` is audit/log metadata only. There is no separate
`AUTO_CLOSED`/`TIMED_OUT` business state anywhere in `LiveSessionStatus` or `MatchReportStatus`;
a timeout-completed session looks, in every persisted and rendered way, like a manually-completed
one, just with different audit metadata.

Sequence: atomic compare-and-set on `status: "ACTIVE"` (Prisma-native optimistic concurrency, the
operation's own concurrency lock — no raw SQL row lock) → the loser of a race observes the
winner's already-completed result instead of re-running the operation → resolve any still-active
period (below) → end the session → seed/merge the post-match report exactly once → recompute the
resolved timeline → return one result shape regardless of trigger. Recorded live data is always
preserved; the post-match report is never auto-submitted — it is created/ensured in `DRAFT`,
exactly as manual completion always produced.

### Active-period recovery

If a period is still running when `finishLiveReporting` runs (a coach forgot to end it, or the
device was lost before they could), the running clock is never trusted as-is and never simply
truncated at whatever the intended duration was — it is *resolved* against a recovery ceiling and
the result is written as a `MatchPeriodTimingResolution` row (below):

```text
recovery ceiling = intended period duration + max(10m, 25% of intended period duration)
legacy fallback  = 60m maximum trusted active-period duration, when no format snapshot exists
```

- raw elapsed ≤ ceiling: the raw elapsed time is used as-is, `resolutionSource:
  FINISH_LIVE_REPORTING`, `reviewStatus: NOT_REQUIRED` — nothing for the coach to review.
- raw elapsed > ceiling: resolved duration is clamped to the ceiling,
  `resolutionSource: RECOVERED_BOUNDED`, `reviewStatus: NEEDS_REVIEW`, and the original raw
  elapsed time is preserved on the row as a diagnostic — never discarded.

These are recovery bounds for a still-*active*, abandoned period at the moment Live Reporting
completes — not a football duration limit and not a replacement for a coach's own explicit
judgment, and only that one still-active period is ever examined: an explicitly-ended period (the
coach pressed "End period" themselves, at any elapsed time) has already moved the clock to a
break/next-period slot by the time finish runs, so it is no longer "the current period" and is
never resolved or clamped by this logic at all — its real, uncapped elapsed duration is simply
what it is, with no resolution row and nothing to review. `TimingResolutionSource` reserves an
`EXPLICIT_PERIOD_END` value for this case, but nothing writes it today — the one period that can
actually run away unbounded is structurally always the last, still-active one, so bounding only
that period already closes the "hours of player minutes" failure mode. Manual and `TIMEOUT`
triggers hit the identical recovery code path for that one period; there is no timeout-specific
formula.

### Resolved period timing and player minutes

`MatchPeriodTimingResolution` (one row per period that actually occurred, for either League
`Match` or Event `EventMatch`, never both on the same row) is the timeline player/position
minutes are derived from — `rebuildActualTimeline`/`rebuildEventActualTimeline`
(`src/lib/evidence/actual-timeline.ts`) cap each period's contribution at that period's
`resolvedDurationMs`, not at the old single static `Match.matchDurationMinutes` end-of-match
field (which is retained only as a last-resort fallback when no resolution row exists at all,
e.g. a match reported through a path other than Live Reporting). A period left running because a
coach forgot to end it can no longer generate hours of credited player minutes — it is bounded by
the recovery ceiling above the moment Live Reporting completes, regardless of how long the client
was actually left open.

### Server-side reconciliation (the 270-minute hard fail-safe)

`src/app/api/cron/live-reporting-reconciliation/route.ts`, on a five-minute Vercel Cron schedule
(`vercel.json`, `*/5 * * * *`), is the actual enforcement of the 270-minute absolute limit — not
the client. It authenticates the same way `notification-outbox`'s existing cron route does
(`CRON_SECRET` bearer auth, no new auth mechanism) and requires no browser to be open: eligibility
is `status = "ACTIVE" AND startedAt <= now() - 270 minutes` for both `LiveMatchSession` and
`EventLiveMatchSession` — `Match.startsAt`/`EventMatch.startsAt` never appears in this query, only
the session's own actual start. Each eligible session is completed independently via
`finishLiveReporting(ref, "TIMEOUT", systemContext)`; one session's failure is caught and logged
without blocking any other session in the same run. A failed session remains eligible for the
next run five minutes later — `finishLiveReporting` itself reverts the session back to `ACTIVE`
if any step after its own compare-and-set throws, since that compare-and-set already flipped the
row to `ENDED` before doing any of the report-seeding/timeline work; leaving it stranded `ENDED`
with no report would silently drop it from every future reconciliation run's `ACTIVE`-only
eligibility query. There is no separate retry queue or backoff — the next cron tick is the retry,
and every step it repeats (the period-resolution upsert, report-seeding's own duplicate-safe
handling, the timeline recompute) is already idempotent. An open client whose Live Reporting
session is finished this way transitions to the post-match view normally on its next interaction,
the same as after a manual finish.

### Post-match review and submission gate

A `MatchPeriodTimingResolution` row left `NEEDS_REVIEW` by active-period recovery surfaces on the
post-match report as a visible callout (`RecoveredTimingCallout`,
`src/components/matches/recovered-timing-callout.tsx`) — the resolved duration, a
"Confirm duration" action, and an "Edit duration" action that lets the coach supply a corrected
duration instead. Either action calls `reviewMatchPeriodTiming`
(`src/lib/live-match/timing-review.ts`), which marks the row `REVIEWED` and re-runs the same
resolved-timeline recompute `finishLiveReporting` itself uses — corrected timing recomputes
player/position minutes deterministically, it never patches derived minutes directly. A recorded
event whose period-relative timestamp now falls outside its period's *current* resolved duration
is never auto-shifted or deleted; it is counted (`getOutOfRangeEventCount`) and surfaced as its
own blocking notice, corrected only through the existing live-event editor. Final report
submission (`completeReport`/`completeEventReport`, the DRAFT/REPORTED → LOCKED transition) is
blocked — server-side, not just in the UI — while either any period is still `NEEDS_REVIEW` or
any event is out of range (`getTimingSubmissionBlockers`); normal post-match editing (everything
short of final submission) is never blocked by an unreviewed period.

### Live Reporting lifecycle

```text
Pre-match
   |
   | Start Live Reporting
   | - persist actual startedAt (LiveMatchSession/EventLiveMatchSession, unchanged thereafter)
   | - freeze effective match format (Match > Team > Season, or unconfigured legacy)
   v
LIVE_REPORTING
   |
   | periods start/end explicitly; intended format duration only drives warnings, never a clock
   |
   +-- Manual "Finish Live Reporting" ------+
   |                                        |
   +-- 270m reconciliation cron (TIMEOUT) --+
                                            |
                                            v
                             shared finishLiveReporting(ref, trigger, context)
                             - atomic compare-and-set completion (idempotent, race-safe)
                             - resolve any still-active period against the recovery ceiling
                             - recompute the resolved timeline
                             - preserve all recorded live data
                             - ensure exactly one post-match DRAFT report
                                            |
                                            v
                                      POST_MATCH (DRAFT)
                             - review/confirm/correct any NEEDS_REVIEW recovered timing
                             - correct any flagged out-of-range event through the event editor
                             - submit (LOCKED) once no timing blocker remains
```

## Canonical operation ordering

Every canonically accepted live operation receives an explicit per-session integer `sequence`
(starts at 1, increments by 1, unique per session, persisted in Neon, never reconstructed from
`createdAt`). `sequence` is acceptance order — a distinct concept from the existing `period` +
`matchSeconds` football-time fields, and from `capturedAtClientMs`/`acceptedAt` diagnostic
wall-clock timestamps. In particular, a late offline operation can carry an earlier football
time but a later canonical sequence, and replay always orders by sequence, never by wall-clock
time.

The single global `baseVersion` precondition (ADR-0086) has been replaced by domain revisions
(`clockRevision`, `lineupRevision`, `annotationRevision`) plus explicit semantic precondition
checks evaluated against current canonical projected state — e.g. `ROTATION_OUT` requires the
target participant to currently be on field; `EVENT_REVERSED` requires its target event to
exist and still be active. An additive goal no longer invalidates an unrelated pending
rotation, because only lineup operations touch `lineupRevision`, and the rotation's actual
precondition (is the player still on field) is what is checked — not "has anything changed
since I last saw canonical state."

Every `LiveMatchEventType` has an explicit, exhaustive append-safe/state-sensitive
classification; a new event type must fail a test or compile-time exhaustiveness check until
explicitly classified.

## Persistence and replay

`CanonicalLiveEvent` carries `sequence` and complete correction metadata (`correctionType`,
`correctsEventId`), so a consumer can replay exact observable truth without a further database
lookup. The shared projection's reversal handling resolves against target-event-id, and its own
replay/merge ordering compares `sequence`, never `createdAt`. The projection also produces
position-state output (not just score/clock/on-field state) and is the one pure function both
Live Reporting and Follow Live consume for every observable fact.

Legacy pre-sequence rows were backfilled deterministically (session, then `createdAt`, then row
id as tie-breaker) for replay compatibility during the v2 cutover — this establishes
deterministic *historical* replay order, not proof of original realtime acceptance order;
strong ordering guarantees begin at the v2 cutover itself. No replay may mutate a locked report
or retroactively change a player's profile attributes/positions as if replay were a new
observation.

## Clock persistence

Both League's `LiveMatchSession` and Event's `EventLiveMatchSession` persist the match clock
(period, running/paused state, and the timestamps needed to reconstruct elapsed time on
reload) rather than holding it only in browser memory — a page reload or reconnect always
recovers the actual clock state from Neon via the coordinator's snapshot/reconciliation path,
never a client-side guess. `persistClock` is wired through the same shared realtime coordinator
for both League and Event; there is no separate Event-only clock code path.

## Offline continuation

This is scoped offline continuation, not general offline mode — the existing "no offline
caching, no service worker" invariant (`features/matchboard.feature`'s "Progressive Web App
installation" feature; ADR-0123) is narrowed, not removed:

A device that has successfully established a live-reporting session and downloaded the
required match package while online can continue to record match operations when
connectivity disappears — through temporary network loss, WebSocket-only loss, full network
loss, page refresh, or an installed-PWA/browser restart on the same device. A never-prepared
device opening Matchboard for the first time without network access remains out of scope and
shows an explicit "connect to prepare this match" state, not stale or fabricated content.

Any service worker used for this purpose caches only the static shell/assets required to
render the established live route and a generic offline fallback — never arbitrary
authenticated SSR HTML, and never longitudinal player development data. The prepared match
package (roster, starting line-up/positions, period configuration, last canonical snapshot,
local outbox) lives in IndexedDB, not Cache Storage.

Session end (`MATCH_END`) ends the football clock and normal live-action mode, but does not
immediately destroy unsynchronized local intent or clear the local queue. During the bounded
window while the post-match report remains mutable, delayed append-safe operations may still
synchronize and delayed state-sensitive operations are evaluated normally (accept or
`NEEDS_REVIEW`). The canonical stream becomes sealed when the post-match report is
completed/locked (the existing report-lock boundary, not a new independent seal timestamp) —
after sealing, no new canonical live operations are accepted, and a locked report is never
mutated by a late-arriving local command.

## Reporter vs Follow Live authorization

A connection ticket is issued in one of two modes, and `MatchSessionObject` enforces the
resulting capability server-side (`recordEvent`/`endSession` reject any connection without
`"report"` capability):

**Report mode** (mutation) — requires organisation mutation authority (`OWNER`, `ADMIN`, or
`COACH`) **and**, for non-admin users, `GROUP_COACH` authority on the match's `FootballGroup`:

| Organisation role | Group role | Report allowed |
|---|---|---|
| `OWNER` / `ADMIN` | any | Yes (administrative bypass) |
| `COACH` | `GROUP_COACH` | Yes |
| `COACH` | `GROUP_VIEWER` | No |
| `COACH` | no group access | No |

This matrix is identical for League and Event as of ADR-0140 — Event live-reporting mutation
(start live session, report-mode realtime ticket issuance, live clock persistence,
heartbeat/session maintenance mutation, end live session, live-session-to-post-match-report
handoff) now requires the same group-mutation authority League already required. ADR-0140 does
not change the wider Event planning authorization model — Event squad generation, lineup
editing, and other Event planning actions are unaffected.

**View mode** (read-only, "Follow Live") — requires only group access, `GROUP_COACH` or
`GROUP_VIEWER`, no organisation-mutation-role requirement, subject to normal
organisation/tenant access. A view ticket never receives report capability, for either League
or Event.

## Worker and Vercel trust boundary

1. Browser calls `POST /api/live-match/[matchId]/realtime-ticket` (League) or the Event
   equivalent with `{ mode: "report" | "view" }` — authenticated via the normal session
   cookie, authorized via `requireMatchGroupMutationRole` (report) or
   `requireMatchGroupAccess` (view).
2. Vercel issues a short-lived (60-120s) JWT ticket (`LIVE_MATCH_REALTIME_SECRET`) carrying
   `userId`/`organisationId`/`matchId`/`sessionId`/`capabilities`.
3. Browser opens a WebSocket to the Worker; the connection starts **unauthenticated** — the
   only RPC it may call is `authenticate`.
4. `authenticate` verifies the ticket, checks it matches the object's own routed `matchId` and
   (if a session is already active) `sessionId`/`organisationId`, and — on first
   authentication for a session — runs reconciliation against Neon's canonical state.
5. Every subsequent RPC trusts only the connection's own server-attached identity
   (`ConnectionAttachment`, populated once at authenticate time), never anything the browser
   sends as RPC parameters.
6. The Worker→Vercel leg is a *separate* trust boundary: `LIVE_MATCH_INTERNAL_SECRET` (never
   the ticket secret) signs each request via HMAC-SHA256 over `<timestamp>.<raw body>` (or, for
   the snapshot `GET`, `<timestamp>.<query string>`) — binding the signature to exactly which
   match/session is being asked for, not just that *some* valid Worker request arrived.

The Durable Object's `version`/coordination metadata exists only so connected clients can
detect gaps and so state-sensitive actions can be rejected as stale — it is never a business
sequence number and is not the same thing as the persisted canonical `sequence` described
above.

## Local development

```bash
npm run dev:realtime   # wrangler dev --config workers/live-match/wrangler.jsonc --port 8787
```

This does not replace `npm run dev` — run both side by side:

```text
Next.js            http://localhost:3333
Realtime Worker     ws://localhost:8787
```

`workers/live-match/wrangler.jsonc`'s top-level (no `--env`) config is the local-dev default,
with `MATCHBOARD_APP_ORIGINS`/`MATCHBOARD_API_BASE_URL` both set to `http://localhost:3333`.
The Worker also needs `LIVE_MATCH_REALTIME_SECRET` and `LIVE_MATCH_INTERNAL_SECRET` set locally
to the same values as the Next.js app's own `.env` — Wrangler reads Worker secrets from a local
`.dev.vars` file (`workers/live-match/.dev.vars`, gitignored) for `wrangler dev`, not from the
repository's root `.env`:

```text
# workers/live-match/.dev.vars (not committed)
LIVE_MATCH_REALTIME_SECRET=same-value-as-root-.env
LIVE_MATCH_INTERNAL_SECRET=same-value-as-root-.env
```

## Deployed environments

Two separately-deployed Workers, matching the existing `matchboard`/`matchboard-test` Vercel
project split (ADR-0086):

| Environment | Worker name | Custom domain |
|---|---|---|
| Production | `noisy-snowflake-faf0` | `realtime.matchboard.football` |
| Test | `gentle-rice-ba83` | `realtime-test.matchboard.football` |

Both custom domains and their Workers already exist in the real Cloudflare account
(ADR-0086's History) — created via the dashboard's "Hello World" flow, which assigns
Cloudflare's own auto-generated adjective-noun name rather than a chosen one. `wrangler.jsonc`'s
`env.production.name`/`env.test.name` are pinned to these exact existing names so
`npx wrangler deploy --env <name>` replaces the Worker in place (keeping its already-attached
custom domain) instead of creating a new, unrelated Worker. Deploys run automatically via
`.github/workflows/deploy-live-match-worker.yml` after every CI-green push to `main` — no
manual `wrangler deploy` step.

Two Worker secrets, two different provisioning stories:
- `LIVE_MATCH_REALTIME_SECRET` must be set per environment via `wrangler secret put
  LIVE_MATCH_REALTIME_SECRET --config workers/live-match/wrangler.jsonc --env production`
  (and again with `--env test`) — a one-time, human-run step independent of code deploys,
  mirroring how `AUTH_SECRET` is already set by hand in Vercel's dashboard
  (`docs/security/secret-rotation-procedures.md`) — no vault is in use for either.
- `LIVE_MATCH_INTERNAL_SECRET` is different: `deploy-live-match-worker.yml` reads it from two
  GitHub Actions secrets (`LIVE_MATCH_INTERNAL_SECRET_PRODUCTION`/`_TEST`) and pushes it to
  each Worker via `wrangler secret put` automatically on every deploy — no manual `wrangler
  secret put` needed for this one. The two GitHub secrets themselves are still a one-time
  human-set step (same as any repository secret), and must match the corresponding Vercel
  `LIVE_MATCH_INTERNAL_SECRET` env var exactly, per environment.

## Production diagnostics and recovery

Three read-only/opt-in operational tools exist for diagnosing and, where necessary, repairing
canonical live-operation data. None of them run automatically — each is an explicit maintainer
action:

- `npm run check:live-diagnostics -- --cutover-check` — reports any `ACTIVE` live session that
  looks stale (no recent heartbeat), and reports whether the environment is safe to cut over
  to protocol v2 (`cutoverSafe: true/false`). Read-only.
- `scripts/backfill-live-event-sequence.ts` (`npm run backfill:live-event-sequence`, with a
  `--dry-run` flag) — assigns the deterministic legacy backfill `sequence` described in
  "Persistence and replay" above to any pre-v2 rows still missing one. Idempotent — running it
  again after a successful backfill reports zero remaining rows.
- A projection-divergence diagnostic — compares the shared projection's computed state against
  raw canonical events for a session, to catch a projection bug before it reaches a coach or
  parent.

All three are designed to run against `DATABASE_URL`/`DIRECT_URL` pointed at any environment
(local, Test, or Production), using `runWithTenantOrganisationId()` to iterate every
organisation the invoking role can see. Running any of them against Production requires
Production database credentials, obtained per that environment's own access process — never
committed to the repository, never left in a shell history file.

## Operational cutover status

The Production cutover described by ADR-0138 and the `matchboard_close_live_archaeology_docs_2026-09-14`
programme's Production Cutover Runbook completed on **2026-09-14**:

- ADR-0138 protocol-v2 cutover is complete — the Durable Object is the only normal
  canonical-ordering path in Production, for both League and Event.
- The legacy sequence backfill ran against Production: 506 rows across 8 League sessions and
  20 Event sessions were assigned a deterministic sequence.
- Post-backfill gap count is zero, confirmed by both a dry-run backfill re-check and
  `check:live-diagnostics --cutover-check`.
- The Production cutover check reports clean (`cutoverSafe: true`), with zero `ACTIVE` live
  sessions at time of verification (one genuinely stale, orphaned Event session from
  2026-09-05 was found and closed via the same transition `endEventLiveSession()` performs,
  before the backfill ran).
- See ADR-0138's History (2026-09-14 entry) for the full execution record.

## Relevant ADRs

- ADR-0086 — Live match realtime, Cloudflare Durable Objects (original architecture, trust
  boundary, Free-plan design, staged rollout).
- ADR-0104 — Canonical post-match learning pipeline (evidence pipeline consuming live-reported
  match facts).
- ADR-0109 — Planning boundary / report-lock model (the boundary session-end sealing reuses).
- ADR-0112 — Unified reporter and Follow Live projection.
- ADR-0123 — Progressive Web App installation scope (the "no general offline mode" invariant
  that ADR-0138 narrows, not removes).
- ADR-0133 — Clock persistence, score reconciliation, and keepalive hardening (League).
- ADR-0138 — Canonical live operation stream, persisted sequence, and scoped offline
  continuation (the migration this document primarily describes).
- ADR-0140 — Event live-reporting mutation is group-role-aware (resolves ARR-0048).
- ADR-0146 — League match-format domain, Live Reporting guardrails, the shared
  `finishLiveReporting` completion operation, active-period recovery, server-side reconciliation,
  and the post-match timing review gate described above.
