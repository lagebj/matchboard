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

## History

- 2026-08-23: Accepted. Cloudflare account/DNS zone confirmed pre-existing (provisioned for
  `matchboard.football` DNS management, unrelated to this feature); Workers product
  activation, both `realtime.`/`realtime-test.` custom domains, and the Free-plan-vs-Paid
  question were the three items this ADR was blocked on — all three verified directly by the
  maintainer (two placeholder Workers created via the dashboard, each with its custom domain
  attached) rather than assumed, per this programme's standing rule against guessing at
  external provider state. No Worker/Durable Object code exists yet; this ADR unblocks Stage
  3 implementation, it is not a record of that implementation having happened.
