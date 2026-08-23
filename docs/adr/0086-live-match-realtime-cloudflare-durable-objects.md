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
