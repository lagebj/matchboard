# ADR-0086: Live match realtime coordination runs on Cloudflare Durable Objects

## Status

Accepted

## Date

2026-08-23

## Context

Live match reporting (`src/lib/live-match/`) is currently local-first and HTTP-only: the
browser writes to IndexedDB immediately, then syncs to Vercel/Neon over ordinary HTTP
requests/server actions. This works, but gives coaches no shared, low-latency view of a match
that a second connected device (an assistant coach, a parent's read-only view, a future
scoreboard display) could observe live. The maintainer specified a 45-section technical
design (`.matchboard-work/live-match-realtime-programme/SPEC.md`, gitignored working
document, not part of this diff) for a typed WebSocket RPC protocol coordinated by a
Cloudflare Durable Object per active match, landing as 7 sequential stages. Stages 1–2
(protocol types, browser realtime client, ticket-issuing auth endpoint) are ordinary
Next.js application code and already shipped (#340) without needing this ADR — they
introduce no new runtime or trust boundary by themselves.

Stage 3 is different: it introduces Cloudflare Workers/Durable Objects as a new deployment
target outside Vercel/Neon, and a new authenticated trust boundary between them. Per
`AGENTS.md`'s `adr-governance` triggers ("deployment or runtime changes",
"cross-module or cross-service boundary changes"), this requires a decision record before
implementation starts, not after.

### Why not extend the existing Vercel/Neon stack instead

The alternatives available inside the current stack were considered and rejected:

- **Vercel serverless/Edge Functions holding the WebSocket directly.** Vercel Functions are
  request-scoped; they do not provide a long-lived, single-actor process that can hold
  in-memory ordering/connection state for the duration of a match. Every reconnect or
  concurrent request would need to re-derive coordination state from Postgres, which is
  exactly the coordination problem being solved, not an implementation detail to route
  around.
- **Neon Postgres `LISTEN`/`NOTIFY` fan-out.** This still needs a persistent process holding
  the listening connection to fan out to browser WebSockets — the same requirement as above,
  and Neon's serverless/pooled connection model is not designed for long-lived `LISTEN`
  sessions at this granularity (per-match).
- **A dedicated always-on Node process (Fly.io/Railway/similar) running Socket.io.** This is
  also a new deployment target, but with strictly more operational burden than a Durable
  Object: the team would own patching, scaling, and availability of a always-running server
  process, rather than a managed, hibernating, edge-scheduled actor. It does not reduce the
  "new runtime" ADR trigger at all, and adds more surface than Cloudflare's offering for the
  same requirement.
- **A third-party managed realtime service (Pusher/Ably/Supabase Realtime).** These solve
  fan-out but not the per-match single-actor ordering/coordination semantics SPEC.md §3
  requires (`MatchSessionObject` as the one actor "who was connected, in what order actions
  were accepted, what session version") — that logic would still need to live somewhere, and
  introduces a fourth vendor relationship instead of using infrastructure this account
  already has.

Cloudflare Durable Objects provide the needed single-actor-per-match consistency guarantee
natively (`env.MATCH_SESSIONS.idFromName(matchId)`, SPEC.md §3), hibernate when idle (no
always-on cost), and the Cloudflare account/DNS zone (`matchboard.football`) already exists
for unrelated DNS management — this is incremental use of an existing vendor relationship,
not a net-new one.

### Trust boundary

Two new secrets are introduced, neither reusing `AUTH_SECRET` (SPEC.md §11, §18):

- `LIVE_MATCH_REALTIME_SECRET` — Vercel issues short-lived (60–120s) signed connection
  tickets (`POST /api/live-match/[matchId]/realtime-ticket`, shipped in Stage 2, gated by
  the same `requireActorContext()`/`requireMutationRole()`/match-ownership checks as every
  other live-match mutation); the Worker verifies them. The ticket never carries player
  names, squad details, event history, or email addresses — only IDs, capabilities, and
  expiry (SPEC.md §11).
- `LIVE_MATCH_INTERNAL_SECRET` — signs Worker→Vercel HTTP calls with HMAC-SHA256 over
  `<timestamp>.<raw body>`, carried in `x-matchboard-signature`/`x-matchboard-timestamp`/
  `x-matchboard-request-id` headers, with a 60-second timestamp tolerance (SPEC.md §18).
  Vercel's internal endpoint calls a new `recordEventForActor()` (extracted from the
  existing `recordEvent()`) only after HMAC verification, live-session lookup, and
  match/session/org consistency checks — never an unchecked Prisma insert (SPEC.md §19).

The WebSocket connection itself starts unauthenticated; the first RPC must be
`session.authenticate(...)`, verified against the ticket before any other call is accepted
(SPEC.md §12). Authenticating the socket establishes *who* issued a command; it does not
bypass Matchboard's existing authorization model — canonical persistence still re-validates
session/organisation state server-side, and RPC-supplied `organisationId`/`userId`/
`sessionId`/`matchId` are never trusted as authoritative, only the authenticated
connection's own attached metadata is (SPEC.md §13).

### What "system of record" still means

Neon remains the only system of record (SPEC.md §2.3, §45): "what actually happened,"
"which events are canonical," and everything that must outlive the realtime session live
there. The Durable Object is deliberately not a second database — it answers only "who is
connected, what order were actions accepted in, what is still waiting for canonical
persistence" for the currently active match, and is designed to hold minimal, short-lived
state (SPEC.md §15 explicitly forbids duplicating match history into Cloudflare storage).
IndexedDB remains the device-safety layer, protecting the coach from device/network failure
independent of both. Cloudflare Durable Objects are the first distributed *runtime* for the
`MatchSession` actor abstraction, not a redefinition of where truth lives (SPEC.md §45).

### Rollback / kill-switch story

Realtime is additive, not a replacement for the existing HTTP/local-first path, and that
path is never deleted (SPEC.md §28). `recordEventLocallyFirst()`'s decision flow is: save to
IndexedDB first, then use the realtime RPC path only if currently connected, otherwise fall
straight back to the existing HTTP sync — with no special-casing required to "turn realtime
off," since an unreachable/misbehaving Worker simply presents as "not connected" from the
browser client's perspective. SPEC.md §37's failure acceptance criteria are explicit for
every relevant failure mode (WebSocket failure, Vercel/Neon outage, browser crash, duplicate
retry, Durable Object hibernation/restart, version gap, protocol incompatibility, match end)
that no match data is lost and reporting continues through the existing path. The governing
invariant (SPEC.md §38): **"Realtime failure changes collaboration quality, not the coach's
ability to report the match."** No separate feature flag is being introduced to disable
realtime at the application layer — the natural degrade-to-HTTP path already is the kill
switch. If a harder kill switch is ever needed, `NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL` being
unset/unreachable already produces the same degraded-but-functional behaviour, so no new
mechanism is required for Stage 3.

### Free-plan decision (D-004)

`MatchSessionObject` uses SQLite-backed Durable Object storage explicitly
(`new_sqlite_classes` in `wrangler.jsonc`, not the legacy `new_classes`/KV-backed API), and
the design targets the Cloudflare Workers/Durable Objects **Free** plan, not Paid — an
explicit maintainer instruction, not a cost assumption discovered after the fact.
SQLite-backed Durable Object storage has been available on Free since 2025-04-07; only the
legacy KV-backed backend requires Paid, and SPEC.md never specified KV-backed storage.

Sourced Free-plan limits (Cloudflare docs, fetched 2026-08-23):

| Dimension | Free plan | Relevance here |
|---|---|---|
| Durable Object requests | 100,000/day, account-wide | Hard-fails on exceed, no overage |
| Durable Object duration | 13,000 GB-s/day | Billed only while active — Hibernation (§16) keeps this low |
| Storage per account | 5 GB total | Forces the already-mandated minimal-retention design (§15) |
| Storage per object | 10 GB | Same on Free/Paid |
| Key+value size | 2 MB combined | Same on Free/Paid |
| Durable Object classes/account | 100 | This programme needs exactly 1 |
| CPU time per request | 30s default (configurable to 5 min) | Same on Free/Paid |
| Simultaneous outgoing connections/object | 6 | Same on Free/Paid — bounds Stage 4/6 outbox concurrency regardless of plan |
| Incoming WebSocket message billing | 20:1 | Outgoing messages/pings are free |
| Behaviour on exceeding a daily limit | Hard fail, no automatic overage | A designed-for failure mode, not an unhandled one |

Free-plan quota exhaustion is accepted as a designed-for failure mode: it degrades to the
same HTTP/local-first fallback path described above (SPEC.md §37's "WebSocket failure"
criterion applies identically whether the Worker is down, unreachable, or quota-exhausted) —
it does not corrupt data or block reporting, only removes the live-collaboration layer until
quota resets. This is why the mandatory Hibernation API (§16) and minimal-retention storage
(§15) are load-bearing architecture, not implementation nice-to-haves: they are what keeps
this workload's expected usage well inside Free-plan limits in the first place. If usage
ever approaches these limits in practice, upgrading to Paid is a config/billing change, not
an architecture change — the Durable Object design itself does not need to differ.

### External provider state (verified 2026-08-23, not assumed)

- The Cloudflare account behind `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_ZONE_ID` (previously
  provisioned for DNS management of `matchboard.football` only) has the Workers product
  active — confirmed by the maintainer creating two "Hello World" placeholder Workers
  through the dashboard's Workers & Pages flow.
- Two subdomains under the existing `matchboard.football` zone are attached as custom
  domains to those two placeholder Workers, mirroring the existing `app.`/`test.` Vercel
  project split: **`realtime.matchboard.football`** (production) and
  **`realtime-test.matchboard.football`** (test). These will become `NEXT_PUBLIC_LIVE_MATCH_
  REALTIME_URL`'s two environment values. Stage 3 implements this as one Worker codebase in
  `workers/live-match/` deployed via two Wrangler environments (`[env.production]`/
  `[env.test]`), not two independently-maintained codebases — the placeholder Workers exist
  only to prove domain/activation and will be replaced by the real deployment.
- Deliberately kept as two separate deployed Workers (not one Worker serving both
  hostnames): isolates Durable Object storage/quota and blast radius between test and
  production traffic, matching the existing `matchboard`/`matchboard-test` Vercel project
  separation — a bad test-slot deploy must not consume production's Free-plan quota or
  corrupt production match coordination state.
- `LIVE_MATCH_REALTIME_SECRET` and `LIVE_MATCH_INTERNAL_SECRET` will be distributed the same
  way `AUTH_SECRET` already is (`docs/security/secret-rotation-procedures.md`): generated
  once locally (e.g. `openssl rand -base64 32`), pasted into Vercel's environment variables
  (Production + Preview), and pasted into each Worker's secrets (`wrangler secret put
  <NAME>` or the dashboard's Settings → Variables and Secrets) — no external vault is in use
  for this repository, and none is being introduced for this feature. Both secrets are
  generated fresh, never derived from `AUTH_SECRET` or each other, and never committed,
  written to `.env.example` as anything but a placeholder, or prefixed `NEXT_PUBLIC_*`.

## Decision

Stage 3 onward implements live match realtime coordination as a single `MatchSessionObject`
Cloudflare Durable Object (SQLite-backed storage) per active Matchboard match, fronted by a
Cloudflare Worker, deployed to `realtime.matchboard.football` (production) and
`realtime-test.matchboard.football` (test) as two separately-deployed environments of one
Worker codebase (`workers/live-match/`). Neon remains the sole system of record; the Durable
Object coordinates only the currently-active session and is designed for minimal, short-lived
state within Cloudflare's Free-plan limits. The existing HTTP/local-first reporting path is
preserved unchanged as the permanent fallback and de facto kill switch — no new feature flag
is introduced. Two new secrets (`LIVE_MATCH_REALTIME_SECRET`, `LIVE_MATCH_INTERNAL_SECRET`)
establish the Vercel↔Worker trust boundary, distributed manually the same way `AUTH_SECRET`
already is, via Vercel's dashboard and Wrangler/Cloudflare's dashboard — no vault is
introduced.

### Amendment: "Follow live" read-only viewer capability

Maintainer-directed scope beyond the original SPEC.md (see History): a second coach with
group-level access to a match, distinct from the coach actually reporting it, can open a
read-only "Follow live" view and see the match update as it happens. This reuses the
existing `FootballGroup`/`GroupAccess` authorization model — `GROUP_COACH` (mutation) vs
`GROUP_VIEWER` (read-only) — rather than introducing a new one, and reuses the ticket's
already-generic `capabilities: string[]` field (left deliberately unrefined in Stage 2 for
exactly this kind of later branching):

- `POST /api/live-match/[matchId]/realtime-ticket` accepts `{ mode: "report" | "view" }`
  (defaults to `"report"` for backward compatibility). `"report"` requires org-level
  mutation role plus `GROUP_COACH` specifically on the match's group (new
  `requireMatchGroupMutationRole()` — see the authorization fix below) and issues
  `capabilities: ["report"]`. `"view"` requires only `GROUP_COACH`-or-`GROUP_VIEWER` group
  access (existing `requireMatchGroupAccess()`) and issues `capabilities: ["view"]`.
- `MatchSessionObject` now persists a connection's `capabilities` in its hibernation-safe
  attachment and rejects `recordEvent`/`endSession` (`FORBIDDEN`) from any connection whose
  capabilities don't include `"report"` — previously nothing checked capabilities at all,
  so any authenticated connection could mutate regardless of which ticket mode issued it.
  `authenticate`/`getSnapshot`/`syncPending` remain available to any authenticated
  connection; broadcasts (`applyEvent`/`presenceChanged`/`sessionEnded`) already reached
  every connection and needed no change.
- The reporting coach's page (`league-live-match-client.tsx`) now also opens a `"report"`-
  mode realtime connection and best-effort broadcasts each recorded event to the Worker,
  purely so "Follow live" viewers see it — this is **not** Stage 4's signed Worker→Vercel
  persistence path. Neon persistence continues exactly as today via the existing HTTP
  action (`recordLiveEventAction`); the realtime broadcast is a strictly additive
  side-channel that silently no-ops if the connection is unavailable, matching this ADR's
  kill-switch principle. A future Stage 4 implementation must not mistake this fire-and-
  forget call for the real persistence integration.
- PWA push notifications (surfacing a "Follow live" update when the app isn't open) were
  explicitly considered and deferred — this remains an in-browser-only capability, no
  service worker, no Web Push, per `AGENTS.md`'s PWA section's existing v1 scope boundary.

### Authorization fix: group-role was not checked for live match mutation

Discovered while scoping the above, not introduced by it: `requireMatchGroupAccess()` (used
by every live-match mutation action) only checks whether a membership has *any*
`GroupAccess` row for the match's group — it never distinguished `GROUP_COACH` from
`GROUP_VIEWER`. A membership with org role COACH (a mutation-capable org role) but only
`GROUP_VIEWER` access to a specific group could therefore start/record/end live sessions
for that group, which defeats the point of the `GROUP_VIEWER` role. Fixed by adding
`requireMatchGroupMutationRole(ctx, matchId)` (`src/lib/auth/actor-context.ts`), called
alongside the existing check (not replacing it) in every live-match mutation action and in
the ticket route's `"report"` path. `endLiveSessionAction` additionally had an
authorize-after-mutate ordering bug (it called `endLiveSession()` before either group check
ran) — fixed by resolving the session's `matchId` and authorizing first.

### Stage 4: signed internal persistence API

Implements the trust boundary this ADR already specified (see "Trust boundary" above) —
`persistenceStatus` no longer stays `"pending"` forever (Stage 3's documented limitation).
`MatchSessionObject.handleRecordEvent`'s "accepted" branch now signs and sends the event to a
new `POST /api/internal/live-match/events` endpoint, awaited within the same RPC call (no
`waitUntil`-equivalent exists for a Durable Object past when its event handler returns, so an
un-awaited persistence call could be interrupted before completing — this is why it's
synchronous rather than fire-and-forget). Both internal endpoints
(`/api/internal/live-match/events`, `/api/internal/live-match/snapshot`) are HMAC-only —
no session-cookie/actor-context authentication, never exposed as browser APIs.

Key implementation choices:
- HMAC signing/verification is one shared module
  (`src/lib/live-match/realtime/internal-signature.ts`) used by both the Worker (signs) and
  Vercel (verifies), built on Web Crypto's `crypto.subtle` rather than Node's `crypto` module
  — `crypto.subtle` is the only HMAC primitive available in both the Workers runtime and
  Node, so both sides are provably computing the exact same signature over the exact same
  input rather than two independently-written implementations that could silently drift.
- `recordEventForActor()` (`src/lib/live-match/live-match-event-store.ts`) is the single
  owning implementation of event persistence (AGENTS.md: "One business operation, one owning
  implementation, multiple adapters") — both the browser-facing `recordEvent()` wrapper and
  the internal endpoint call it, so match/session/org consistency checks and `clientEventId`
  deduplication exist in exactly one place, not duplicated in the route handler.
- On persistence failure, `handleRecordEvent` leaves `persistenceStatus: "pending"` exactly
  as Stage 3 already did — no retry/backoff/alarms yet (explicitly Stage 6's outbox scope).
  `applyEvent` still broadcasts immediately on acceptance regardless of persistence outcome
  (preserving "goal appears immediately"); `eventPersistenceChanged` only broadcasts once
  persistence actually succeeds.
- Evaluated adopting `@cloudflare/vitest-pool-workers`/Miniflare for this stage (deferred at
  Stage 3 pending exactly this trigger) and judged it still not worth the toolchain
  complexity: the new security-critical logic (HMAC sign/verify) is 100% covered by
  Workers-runtime-independent pure-function tests, the Vercel-side domain logic needs no
  Workers-specific behaviour to test, and the remaining orchestration glue in
  `handleRecordEvent` (call persistEvent, branch on success/failure) is straightforward
  enough that a full Miniflare Durable Object harness would add substantial setup cost for
  modest additional confidence. Revisit at Stage 6, which introduces genuinely
  hard-to-pure-function-test Durable Object–native behaviour (alarms, retry state machines).

### Stage 5: realtime event path integration

Flips the reporting coach's own write path from what PR #344 ("Follow live") shipped — HTTP
unconditionally, realtime as a pure best-effort broadcast side-channel — to what SPEC.md §28
actually specifies: realtime becomes the *primary* write when connected, HTTP is the
*fallback* used specifically when realtime is unavailable. Stage 4's synchronous
persist-then-reply behavior is what makes trusting the realtime path's own result safe to do
here — before Stage 4, `recordEvent()`'s RPC response could never mean "canonically
persisted," only "durably accepted by this object."

Key implementation choices:
- `LeagueLiveMatchClient`'s `useLiveBroadcast()` (renamed `useLiveRealtime()`) now exposes
  `tryRecordEvent()`, tried first by `createLeagueActions.recordEvent`; the existing HTTP call
  (`recordLiveEventAction`, byte-for-byte unchanged) only runs when `tryRecordEvent` returns
  `null` (not connected, or the RPC threw/rejected — including a `STALE_STATE` rejection) *or*
  the realtime result is `persistenceStatus: "pending"`. Falling through to HTTP on `"pending"`
  is a deliberate choice beyond SPEC.md §28's literal "leave event unsynced": it's safe (the
  same `clientEventId` dedup that makes racing HTTP-and-realtime safe elsewhere, SPEC.md §22
  Case E) and gives an immediate, self-healing corrective write rather than waiting on Stage
  6's alarm-based retry, which may not fire for tens of seconds under backoff.
- A `STALE_STATE` rejection's `currentVersion` field realigns the client's tracked
  `baseVersion` immediately, so a state-sensitive event type doesn't keep failing every
  subsequent attempt — the same self-heal principle the original best-effort broadcast already
  used for its own hardcoded-`baseVersion` bug (fixed during Stage 3/Follow-Live review).
- `applyEvent`/`presenceChanged`/`sessionEnded` broadcasts now feed a new
  `LiveMatchActions.onLiveUpdate` subscription, so a *second* reporter's action (SPEC.md §44
  scenario 2) refreshes this client immediately rather than waiting up to 5s for the existing
  poll — `LiveMatchClient` already polled `getRecentEvents` every 5s before this stage, so the
  two reporters were never actually stuck needing a manual refresh, just slower than the spec's
  "both clients show identical state without refresh" implies literally.
- `LiveMatchActions.reconnectRealtime` lets the existing `online`/`visibilitychange` handlers
  (which already drove HTTP's own `syncUnsyncedEvents()` before this stage) also force an
  immediate realtime reconnect attempt, rather than waiting on the client's own backoff timer
  (SPEC.md §27's "on browser online... reconnect" — a passive timer could otherwise leave a
  coach on HTTP-only for up to ~30s after connectivity actually returns).
- No changes to `RealtimeMatchClient` itself (Stage 1) — its reconnect/backoff/jitter,
  fresh-ticket-per-attempt, and RPC reject-on-`ok:false` behavior were already correct and are
  reused as-is; `connect()` is safely re-callable to force an immediate attempt.
- "Replay unsynced local events" on reconnect (SPEC.md §27 step 5) needed no new code: the
  existing `syncUnsyncedEvents()` already calls `actions.recordEvent(...)` for each unsynced
  IndexedDB event, which now goes through the same realtime-primary/HTTP-fallback path as any
  other recording — reconnecting and then replaying was already wired, it just started
  benefiting from realtime once this stage made `recordEvent` realtime-aware.

### Stage 6: reliability

Closes Stage 4's two explicitly-deferred gaps: a canonical-persistence failure retries itself
rather than staying `"pending"` forever, and a Durable Object can discover events the HTTP
fallback wrote while it was disconnected (or before it ever existed).

Key implementation choices:
- **Terminal vs. retryable classification is a new distinction, not previously possible.**
  Before this stage, `/api/internal/live-match/events` returned 422 for *every* failure
  (`recordEventForActor` throwing a plain `Error`), whether the cause was "this session
  doesn't exist" (permanent) or "Neon connection timed out" (transient) — both looked
  identical to a caller. Added `LiveMatchDomainError` (`live-match-event-store.ts`) so
  `recordEventForActor`'s intentional validation rejections are a distinct type from an
  unexpected failure; the route now returns 422 for the former, 503 for the latter
  (`classifyPersistenceFailure`, `workers/live-match/src/state.ts`, treats *exactly* 422 as
  terminal and everything else — 401, other 4xx, 5xx, or no response — as retryable; see the
  History entry below for why this is narrower than "any 4xx"). Without this, Stage 6 could
  not have told "never retry this" apart from "keep retrying this" using only the HTTP status
  it already had access to.
- **One alarm slot per object, not one per event.** Cloudflare Durable Objects have exactly
  one alarm slot; `refreshAlarm()` recomputes it as the minimum `nextRetryAt` across every
  still-pending event (`nextAlarmTime`) after any state change, so a single firing
  (`alarm()`) sweeps every currently-due event in one pass. This is what makes the alarm
  handler naturally idempotent (Cloudflare's own stated requirement, since alarms "may be
  retried"): it only ever touches events still in `"pending"` state, so a duplicate firing
  for already-resolved events is a no-op, and `recordEventForActor`'s `clientEventId` dedup
  (Stage 4) means even a genuinely-duplicated persistence attempt can't create a second
  canonical row.
- **Reconciliation runs once per session initialization, not on every reconnect.**
  `evaluateAuthenticate`'s `"initialize"` outcome (a fresh object, or re-arming for a new
  `LiveMatchSession` after the previous one ended) is the trigger — a plain `"attach"` (a
  second connection to an already-initialized session) does not re-reconcile, since that
  session's canonical history was already folded in the one time it mattered. A snapshot
  fetch failure during reconciliation does not block authentication — reconciliation is an
  enhancement, not a dependency, matching this ADR's own additive-realtime principle.
- **`handleGetSnapshot` now reads its own storage, not a second network call.** Because
  reconciliation already happened during `authenticate` (which always precedes `getSnapshot`
  per SPEC.md §27's connection sequence), the snapshot response can be assembled entirely from
  local Durable Object storage — no extra round-trip to the internal endpoint per
  `getSnapshot` call.
- **Testing without Miniflare, a third time.** `workers/live-match/test/
  match-session-object.test.ts` mocks the unresolvable `cloudflare:workers` module with a
  minimal `DurableObject` base class and hand-rolled in-memory storage/WebSocket fakes,
  exercising the *real* class's `webSocketMessage`/`handleAuthenticate`/`handleRecordEvent`/
  `alarm()` methods rather than a parallel reimplementation. This is a step beyond Stages
  3-5's pure-function-only approach (genuinely testing the orchestration, not just the
  decisions it makes) without adopting the full `@cloudflare/vitest-pool-workers` toolchain —
  judged sufficient because the one thing it still can't cover (`WebSocketPair`/hibernation
  platform mechanics themselves) has no meaningful Node equivalent to fake credibly anyway;
  `wrangler deploy --dry-run` plus manual `dev:realtime` verification remain the substitute
  for that specific residual gap.

### Stage 7: production hardening

Mostly confirmation, not new mechanism: message size limits (64 KiB) and protocol-version
rejection (`PROTOCOL_UNSUPPORTED`) were already built and tested in Stage 1
(`protocol-schemas.ts`) — re-verified here that both are still correctly wired into
`webSocketMessage` and that the browser client's generic RPC-rejection fallback
(`tryRecordEvent`'s catch-all, Stage 5) already covers `PROTOCOL_UNSUPPORTED` without needing
special-casing, with a test added to prove it explicitly rather than leave it merely implied.
Structured logging (SPEC.md §32) extended on both sides: the Worker's previously-plain
`console.error` string interpolation is now a JSON object (queryable in `wrangler tail`);
the internal Vercel routes log `latencyMs`/`errorCode` alongside their existing correlation
ids. `docs/development/live-match-realtime.md`'s "Architecture walkthrough" section is the
SPEC.md §42 documentation deliverable (Match/LiveMatchSession/MatchSessionObject/
MatchClientCapability relationships, responsibility boundaries, a Mermaid sequence diagram of
the full event-persistence flow, and an explicit "why the Durable Object is not another
source of business truth" — referencing this ADR's own "What system of record still means"
section rather than re-arguing it).

**Final security review findings**: reconciliation's `fetchSnapshot` call always uses the
object's own `meta.matchId`/`meta.sessionId` (server-established at authenticate time from a
verified ticket), never anything the browser could influence per-call — no cross-organisation
data-pull path exists. Alarm/retry cannot be amplified into a denial-of-service vector beyond
what the existing rate limit on ticket issuance already bounds: the one-alarm-per-object
design means N pending events produce one scheduled alarm, not N, and a client that spams
distinct `clientEventId`s just produces more pending records to eventually retry or terminate,
not more alarm slots. `npm run security:check-sql`/`security:check-supply-chain` both pass
(this stage touches no SQL and adds no dependencies).

## Consequences

- Matchboard gains a second deployment target (Cloudflare Workers) alongside Vercel/Neon,
  with its own dashboard, CLI (`wrangler`), and secret store to operate and document —
  `AGENTS.md`'s "Stack" section must be updated once the Worker exists (tracked in
  `AGENT-BOOTSTRAP.md` §6, not done as part of this ADR since no Worker code exists yet).
- Two new secrets must be kept in sync by hand across two systems (Vercel + Cloudflare) on
  rotation, since no vault unifies them — the same manual-parity burden `AUTH_SECRET`
  rotation already carries, now doubled. `docs/security/secret-rotation-procedures.md` must
  gain entries for both once Stage 3 ships.
- Running on the Free plan means a real, accepted possibility of hard failure once
  Cloudflare's daily quotas are hit (100,000 DO requests/day, 13,000 GB-s/day duration, 5 GB
  account storage) with no automatic overage — accepted because it degrades to the existing
  HTTP path rather than losing data, and because Hibernation + minimal retention are
  designed specifically to stay well under these limits for this workload.
- Two independent Workers (production/test) must each be kept configured consistently
  (domains, secrets, wrangler environment bindings) — drift between them is a real
  operational risk the same way Vercel's `matchboard`/`matchboard-test` project pair already
  carries, not a new category of risk.
- Nothing about existing live-match reporting behaviour changes for a coach who never has a
  second device connected — realtime is purely additive collaboration on top of behaviour
  that already works over HTTP.

## Related

- `.matchboard-work/live-match-realtime-programme/SPEC.md` — binding technical specification
  (gitignored working document, not part of this repository's tracked history)
- `.matchboard-work/live-match-realtime-programme/DECISIONS.md` (D-004) — Free-plan targeting
  instruction
- `.matchboard-work/live-match-realtime-programme/EXTERNAL-STATE.md` — sourced Free-plan
  limits table and Cloudflare account verification
- PR #340 — Stage 1 (protocol types, browser realtime client) + Stage 2 (realtime ticket
  auth endpoint), which did not require this ADR
- `docs/security/secret-rotation-procedures.md` — existing `AUTH_SECRET` rotation pattern
  this ADR's secret-distribution decision mirrors
- `AGENTS.md` — "Live Match Reporting" file table and "Stack" section, to be updated when
  Stage 3 code lands
- `.github/workflows/deploy-live-match-worker.yml` — automates `wrangler deploy` to both
  environments after CI success on `main`

## History

- 2026-08-23: Accepted. Cloudflare account/DNS zone confirmed pre-existing (provisioned for
  `matchboard.football` DNS management, unrelated to this feature); Workers product
  activation, both `realtime.`/`realtime-test.` custom domains, and the Free-plan-vs-Paid
  question were the three items this ADR was blocked on — all three verified directly by the
  maintainer (two placeholder Workers created via the dashboard, each with its custom domain
  attached) rather than assumed, per this programme's standing rule against guessing at
  external provider state. No Worker/Durable Object code exists yet; this ADR unblocks Stage
  3 implementation, it is not a record of that implementation having happened.
- 2026-08-23: Stage 3 code merged (PR #342). Two follow-up corrections, both same day:
  (1) `wrangler.jsonc`'s `env.production.name`/`env.test.name` originally guessed at chosen
  names (`matchboard-live-match-realtime-production`/`-test`); the actual two Workers created
  via the dashboard's "Hello World" flow carry Cloudflare's own auto-generated adjective-noun
  names (`noisy-snowflake-faf0`, `gentle-rice-ba83`) instead. Corrected to the real names so
  `wrangler deploy` replaces the existing Workers (keeping their already-attached custom
  domains) rather than creating new, domain-less ones. (2) The maintainer flagged that a
  manual, human-run `wrangler deploy` for every future code change was not sustainable.
  Added `.github/workflows/deploy-live-match-worker.yml`, deploying both environments
  automatically after every CI-green push to `main` (no approval gate — see the workflow's
  own header comment for why, mirroring `test-db-migrate.yml`'s reasoning), authenticated via
  `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` repository secrets rather than a local
  `.env`. That Cloudflare API token was separately upgraded from DNS-only scope to include
  Workers Scripts:Edit — confirmed necessary directly: `wrangler deployments list` 403'd with
  "Authentication error [code: 10000]" against the original DNS-scoped token.
- 2026-08-23: Amended to add the "Follow live" read-only viewer capability and fix the
  group-role authorization gap described above — both maintainer-directed, beyond the
  original SPEC.md's 7-stage scope. PWA push notifications were discussed and explicitly
  deferred in the same conversation (in-browser viewing only for now).
- 2026-08-23: Stage 4 ("signed internal persistence API") implemented — see the Decision
  section's own Stage 4 subsection above for the full design. `LIVE_MATCH_INTERNAL_SECRET`
  provisioned the same way `LIVE_MATCH_REALTIME_SECRET` was: generated by the maintainer,
  set in Vercel (both projects) and as two new GitHub Actions secrets
  (`LIVE_MATCH_INTERNAL_SECRET_PRODUCTION`/`_TEST`) that `deploy-live-match-worker.yml` now
  reads and pushes to each Worker automatically via `wrangler secret put` on every deploy —
  no manual `wrangler secret put` needed for this one, unlike `LIVE_MATCH_REALTIME_SECRET`.
  Found and fixed during review, same day: the snapshot endpoint's GET request originally
  signed a fixed empty string regardless of the `matchId`/`sessionId` query parameters it
  carried — meaning a valid signature+timestamp pair from one legitimate request would still
  verify if replayed with *different* query parameters within the 60-second tolerance window,
  since the signature never actually bound to which match's data was being requested. Fixed
  by signing the query string itself (`internal-auth.ts`/`internal-client.ts`'s
  `fetchSnapshot`) instead of an empty body for GET requests, with a regression test proving
  a signature issued for one matchId/sessionId is rejected against another.
- 2026-08-23: Stage 5 ("realtime event path integration") implemented — see the Decision
  section's own Stage 5 subsection above. The reporting coach's write path now tries realtime
  first and falls back to HTTP, rather than running HTTP unconditionally alongside a
  best-effort broadcast. No new external configuration — reuses the same
  `NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL`/`LIVE_MATCH_REALTIME_SECRET` already provisioned for
  "Follow live."
- 2026-08-23: Stages 6 ("reliability") and 7 ("production hardening") implemented — see the
  Decision section's own subsections above. This completes all 7 stages of the original
  programme spec plus the maintainer-directed "Follow live" addition. No new external
  configuration — reuses the same secrets/domains already provisioned. All 7 stages landed
  as one final PR (per the maintainer's standing "minimize PRs, Vercel rate limits"
  instruction) covering Stages 4-7, since Stages 1-3 plus "Follow live" had already merged
  separately.
- 2026-08-23: Found and fixed during review, same day: `classifyPersistenceFailure`
  originally treated *any* 4xx status as terminal, not just 422 — meaning a 401 (HMAC
  verification failure, `verifyInternalRequest`) would permanently mark an event
  `"failed_terminal"` and stop retrying it. A 401 says the *request* wasn't verified, not
  that the *event's data* is invalid — it can result from a momentary clock-skew edge case
  against the 60-second timestamp tolerance, or a secret briefly out of sync during rotation,
  either of which a fresh retry (re-signed with a newly-computed timestamp) could plausibly
  resolve. Treating it as terminal would give up during exactly the kind of transient
  infrastructure hiccup retries exist to survive, and would broadcast a misleading
  permanent-failure signal to connected clients for an event the browser's own HTTP fallback
  (never subject to this signing boundary) might persist successfully moments later. Narrowed
  to classify exactly 422 as terminal, matching what `/api/internal/live-match/events` itself
  actually documents (422 for a known `LiveMatchDomainError`, 503 for anything else) — 401,
  other 4xx, 5xx, and no-response are all retryable. Added a regression test at both the pure
  `classifyPersistenceFailure` level and the class-orchestration level
  (`match-session-object.test.ts`) proving a 401 stays `"pending"` and schedules a retry
  alarm rather than being marked terminal.
- 2026-08-23: Found and fixed during the same review pass: `AcceptedEventRecord` stored only
  `eventType`, not the rest of the browser's original event payload (`playerId`,
  `matchSeconds`, `period`, `secondaryPlayerId`, `payload`, `correctionType`,
  `correctsEventId`). `handleRecordEvent`'s first synchronous attempt built its persistence
  request from the live `params.event` object, but `alarm()`'s retry could only reconstruct a
  request from what was actually in storage — meaning if the first attempt failed
  retryably and only the alarm ever succeeded, the canonical Neon event would be created with
  `eventType` alone, silently missing which player, what match minute, and every other
  contextual field the coach actually recorded. In practice this was a race rather than a
  certainty (Stage 5's client-side "pending -> also call HTTP" fallback normally wins this
  race within milliseconds, well before the alarm's earliest possible firing one second
  later), but a browser tab closing immediately after receiving a `"pending"` response would
  leave the alarm as the sole remaining path, and it would have lost the data. Fixed by adding
  `eventFields?: Record<string, unknown>` to `AcceptedEventRecord`, threading the original
  payload through `evaluateRecordEvent`, and extracting a shared `buildPersistEventFields()`
  helper so `handleRecordEvent`'s first attempt and `alarm()`'s retry construct their
  persistence request from the exact same logic instead of two independently-maintained
  (and, as found, silently diverging) versions. Added regression tests at both the pure
  `evaluateRecordEvent` level and the class-orchestration level proving a retried event
  resends its full original fields, not just `eventType`.
- 2026-08-24: Deploy-auth incident (opened 2026-08-23, see the entry above about upgrading the
  token to Workers Scripts:Edit) resolved — that earlier fix was necessary but not sufficient.
  Root-caused directly against the Cloudflare API with `curl` (bypassing wrangler) rather than
  guessing at permission names: the "Unable to get membership roles... `User->Memberships->Read`"
  message wrangler prints is a generic footer on *any* auth error, not a real diagnosis. The
  actual finding was that the **Account-owned** API token — correctly scoped to "Entire Account",
  with `Workers Scripts:Edit` confirmed present — still 403'd (`code: 10000`) on the single most
  basic Workers Scripts call (`GET /accounts/{id}/workers/scripts`, a plain list, no per-script
  scoping involved), and did so identically across 7+ distinct fresh tokens and permission
  combinations. That pattern (every variation failing identically) pointed away from "wrong
  permission checkbox" and toward something systemic to Account-owned tokens on this account.
  Switching to a **User-owned** API token (same Cloudflare user, `My Profile -> API Tokens`
  rather than the account's own token page) resolved it immediately — proven first with the same
  raw `curl` calls (200 OK across the board) before touching CI. The underlying Cloudflare-side
  reason Account-owned tokens failed here was not established (not a documented, reproducible
  Cloudflare bug found in public trackers); the fix is empirical, not fully explained. Separately,
  once the Worker script itself deployed with the User token, `wrangler deploy` still failed on
  `GET /zones/{zoneId}/workers/routes` (403) while resolving the `custom_domain: true` route —
  a genuinely different, well-understood gap (zone-scoped operation, account-scoped token
  permissions), fixed by adding `Zone: Workers Routes:Edit` to the same token. Also found and
  fixed in the same investigation: `LIVE_MATCH_REALTIME_SECRET` was confirmed via `wrangler
  secret list` to be **absent from both Workers** despite an earlier dashboard check reporting it
  present as an encrypted Secret — meaning realtime ticket verification had been silently broken
  on both live Workers since Stage 3/"Follow live" shipped. Pushed via `wrangler versions secret
  put` + `wrangler versions deploy ...@100` (required because Gradual Deployments/Versions is
  active on this account, which makes the classic `wrangler secret put` refuse to auto-deploy on
  top of an undeployed version) after confirming the values matched Vercel's on both sides. With
  both fixes applied, `deploy-live-match-worker.yml` succeeded end-to-end for the first time
  (run `32700681745`) — Stages 3-7's Worker code is now genuinely live on both
  `realtime.matchboard.football` and `realtime-test.matchboard.football`, not the placeholder
  "Hello World" script referenced in the CRITICAL note above. The exposed-secret incident's
  outstanding item (test-environment `LIVE_MATCH_REALTIME_SECRET` rotation/sync) was also closed
  out in the same session: both the production and test values were re-confirmed matching Vercel
  before being pushed to their respective Workers.
- 2026-08-24: Enabled Workers Logs (`observability.logs.enabled: true`) on both environments in
  `workers/live-match/wrangler.jsonc`, to support diagnosing "Follow live" connectivity issues
  without needing a live `wrangler tail` session running at the exact moment of a repro.
  Confirmed against Cloudflare's own pricing documentation before enabling: Workers Logs is
  included on the Free plan (200,000 events/day, 3-day retention) — not a paid-tier feature, and
  does not conflict with D-004's Free-plan constraint. This Worker's traffic (a handful of live
  matches per week) is far below the daily cap.
- 2026-08-24: **Root cause found and fixed for the "Follow live" `Connection problem` issue**
  (open since the amendment above) — and for reporting-coach events occasionally getting stuck
  in `Sync issue — data saved locally`. Both were the same bug: `src/lib/security/csp.ts`'s
  `connect-src` directive never listed the Cloudflare Worker's WebSocket origins
  (`wss://realtime.matchboard.football`, `wss://realtime-test.matchboard.football`) when this
  programme shipped, so the *browser itself* silently blocked every `RealtimeMatchClient`
  connection attempt via Content-Security-Policy — a client-side block that never reaches the
  network, invisible to every server-side check (Worker deploy status, secrets, Origin allowlist,
  ticket verification) done earlier while diagnosing this. All of those were independently
  confirmed correct and remain correct; none of them was the actual cause. Found via a Playwright
  `page.on("console", ...)` listener during new E2E test development (`e2e/live-reporting.spec.ts`,
  `e2e/follow-live.spec.ts` — see `docs/development/browser-acceptance-testing.md`), which
  surfaced the literal browser CSP violation message on first repro — the fix followed
  immediately once the actual error was visible, after none of the server-side hypotheses in the
  amendment above had panned out. Fixed by adding both origins to `connect-src`; both are
  allowed unconditionally rather than branching per environment (harmless either way). Not yet
  deployed/verified end-to-end at the time of this entry — the new E2E specs are expected to go
  green once this reaches the Test slot; re-run them after deploy to confirm.
- 2026-08-24: **Real Cloudflare Durable Object round trip confirmed working in CI** (ticket
  issuance, WebSocket upgrade, Worker auth) — a CI run reached `follow-live.spec.ts`'s "Live"
  connected-state check and it passed, proving the CSP fix above resolves the connectivity issue
  end-to-end, not just in theory. That run still failed, but only on a trivial wrong text
  assertion further down the same test (fixed same day: `follow-live-client.tsx` renders
  `"goal for"`, not `"goal for us"`). A second bug found the same way: `live-reporting.spec.ts`'s
  sync wait only checked that "syncing…" text had disappeared, a false positive when an attempt
  instead lands in the terminal `Sync issue` state (fixed via `waitForEventsToSync()` in
  `live-match-fixtures.ts`, which actively nudges a retry). A third, unrelated bug then surfaced
  under CI's parallel workers once those two were fixed: the shared fixture's round lookup assumed
  "first card in the list" — not safe once multiple specs create matches concurrently against the
  same shared org (also fixed). See `docs/development/browser-acceptance-testing.md` for detail.
  Awaiting a fully green CI run with all three fixes applied together to close out the "Follow
  live" connectivity work opened by the amendment above.
- 2026-08-29: **Root cause found and fixed for the confirmed "Cloudflare DO exhaustion" issue**
  (previously mitigated only indirectly, via `follow-live.spec.ts`'s try/finally session-closure
  fix, which did not address why sessions were being exhausted in the first place). Confirmed
  live via Vercel runtime logs during a PR's own Test-slot E2E run: 1000+ rejected calls to
  `/api/internal/live-match/events` in a single ~12-minute run, every one a 403 "Preview
  deployment access restricted" — not a 401 from `verifyInternalRequest()`'s own HMAC check (the
  route's only intended gate), but from `middleware.ts`'s separate, unrelated preview-allowlist
  gate (`isVercelPreview() && path.startsWith("/api/")`), which requires a session email for
  every `/api/*` route on a Preview deployment and has no session to check for a machine-to-
  machine HMAC-signed request. Every PR's Test-slot deployment is a genuine Vercel Preview
  deployment (ADR-0075), so this made the Stage 4 internal persistence path unreachable from the
  Cloudflare Worker for the entire lifetime of this feature whenever exercised against a PR's own
  Test slot (the baseline `test.matchboard.football` alias, pointed at `main`'s `target:
  "production"` deployment, was never affected). `classifyPersistenceFailure()`
  (`workers/live-match/src/state.ts`) has no way to distinguish this from a transient failure —
  it only special-cases 422 as terminal — so the Durable Object retried with exponential backoff
  indefinitely for the life of every live-match session run against a PR's Test slot, generating
  sustained background load against the same shared deployment other E2E specs (round-mutation,
  accessibility) were concurrently hitting in the same CI run. Fixed by excluding
  `/api/internal/**` from the preview-allowlist gate in `middleware.ts` (those routes
  authenticate via HMAC signature, never a session cookie, by design) — not by loosening
  `classifyPersistenceFailure()`'s existing, deliberately-reasoned 401-is-retryable behavior,
  which was never the actual problem. Regression test: `requiresPreviewAllowlistCheck()`
  (exported from `middleware.ts`), asserted in `src/test/security-audit.test.ts`.
