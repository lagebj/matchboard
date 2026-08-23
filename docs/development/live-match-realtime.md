# Live match realtime (Cloudflare Durable Objects)

Live match reporting is normally local-first and HTTP-only (`src/lib/live-match/`). The
live-match-realtime programme adds an optional, additive realtime coordination layer on top
of that using a Cloudflare Worker + Durable Object per active match. See
`docs/adr/0086-live-match-realtime-cloudflare-durable-objects.md` for the architecture
decision (why Cloudflare Durable Objects, the trust boundary, the Free-plan design, and the
HTTP-fallback rollback story) before changing anything here.

## Current status: Stage 5 + "Follow live" viewer

This is being delivered in stages (see the ADR's linked programme spec), plus one
maintainer-directed addition beyond the original stage plan. As of this document:

- **Shipped**: Stage 1 (protocol types, browser realtime client abstraction — `src/lib/
  live-match/realtime/`) and Stage 2 (`/api/live-match/[matchId]/realtime-ticket`, short-lived
  connection tickets).
- **Shipped**: Stage 3 — the Cloudflare Worker and `MatchSessionObject` Durable Object
  (`workers/live-match/`). One object per match, WebSocket Hibernation API,
  `authenticate`/`getSnapshot`/`recordEvent`/`syncPending`/`endSession` RPC handling, session
  versioning, minimal presence.
- **Shipped in this change**: "Follow live" — a read-only viewer capability (ADR-0086's
  amendment), beyond Stage 3's original scope. A ticket is now issued in one of two modes:
  - `mode: "report"` (default, existing behavior) — the coach actually running the match.
    Requires org mutation role **and** `GROUP_COACH` role on the match's `FootballGroup`
    (`requireMatchGroupMutationRole()`, new — closes a gap where a `GROUP_VIEWER`-role coach
    with an org-mutation-capable role could otherwise report). Capability: `["report"]`.
  - `mode: "view"` — a second coach following along read-only. Requires only group access
    (`GROUP_COACH` or `GROUP_VIEWER`, no org-mutation-role requirement). Capability:
    `["view"]`.
  `MatchSessionObject` now enforces capabilities server-side: `recordEvent`/`endSession`
  reject any connection without `"report"` (previously unenforced — any authenticated
  connection could mutate). The reporting page
  (`src/components/live-match/league-live-match-client.tsx`) opens a `"report"`-mode
  connection so viewers see live updates; at the time this capability shipped, that connection
  was a best-effort broadcast alongside an unconditional HTTP write — Stage 5 (below) later
  made it the primary write path instead. The viewer itself is
  `src/components/live-match/follow-live-client.tsx`, reached via "Follow live" on the match
  detail page (shown only when a session is `ACTIVE` and the coach has at least `GROUP_VIEWER`
  access — enforced server-side, not just hidden in the UI).
- **Shipped**: Stage 4 — signed internal persistence API (SPEC.md §17-19). The Durable
  Object's `handleRecordEvent` now signs and sends accepted events to a new
  `POST /api/internal/live-match/events` (HMAC-only, never a browser-facing API), which calls
  the same `recordEventForActor()` the browser-facing `recordEvent()` wrapper uses, writing
  the canonical event to Neon and deduplicating by `clientEventId`. On success,
  `persistenceStatus` becomes `"persisted"` and `eventPersistenceChanged` broadcasts to all
  connections; on failure it stays `"pending"` (retry/backoff is Stage 6's outbox, not built
  yet). A `GET /api/internal/live-match/snapshot` endpoint also exists (returns canonical
  session status + events for a match/session) — built now per SPEC.md §17, but nothing calls
  it yet; the Durable Object *consuming* it for reconciliation is Stage 6 (§23). A direct,
  now-resolved consequence of Stage 4 landing: `endSession` can succeed for a session whose
  events have actually persisted, which was structurally impossible before this stage.
- **Shipped**: Stage 5 — realtime event path integration (SPEC.md §5, §20, §22, §27, §28).
  The reporting coach's own write path (`createLeagueActions.recordEvent` in
  `league-live-match-client.tsx`) now tries realtime first via `tryRecordEvent()` and only
  falls through to the existing, byte-for-byte-unchanged HTTP path
  (`recordLiveEventAction`) when realtime is unavailable, the RPC throws/rejects, or
  persistence comes back `"pending"` (a deliberate immediate corrective write, safe due to
  `clientEventId` dedup — see ADR-0086's Stage 5 subsection for the full reasoning). A second
  reporter's `applyEvent`/`presenceChanged`/`sessionEnded` broadcasts now trigger an immediate
  refresh via a new `LiveMatchActions.onLiveUpdate` subscription instead of waiting up to 5s
  for the existing poll, and the browser `online`/`visibilitychange` handlers now also force
  an immediate realtime reconnect (`LiveMatchActions.reconnectRealtime`) rather than waiting on
  the client's own backoff timer. No changes to `RealtimeMatchClient` itself (Stage 1) or to
  the HTTP fallback path's own behavior.
- **Not yet implemented**: retry/backoff for failed persistence (Stage 6's outbox/alarms), and
  the Durable Object consuming the snapshot endpoint for reconciliation after an HTTP-fallback
  write it never saw (Stage 6, §23).
- **Explicitly out of scope**: PWA push notifications (service worker, Web Push) — discussed
  and deferred; "Follow live" is in-browser only for now, per `AGENTS.md`'s PWA section's
  existing v1 scope boundary.

## Local development

```bash
npm run dev:realtime   # wrangler dev --config workers/live-match/wrangler.jsonc --port 8787
```

This does not replace `npm run dev` — run both side by side:

```text
Next.js            http://localhost:3333
Realtime Worker     ws://localhost:8787
```

`workers/live-match/wrangler.jsonc`'s top-level (no `--env`) config is the local-dev
default, with `MATCHBOARD_APP_ORIGINS`/`MATCHBOARD_API_BASE_URL` both set to
`http://localhost:3333`. The Worker also needs `LIVE_MATCH_REALTIME_SECRET` and (Stage 4)
`LIVE_MATCH_INTERNAL_SECRET` set locally to the same values as the Next.js app's own `.env` —
Wrangler reads Worker secrets from a local `.dev.vars` file
(`workers/live-match/.dev.vars`, gitignored) for `wrangler dev`, not from the repository's
root `.env`:

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
- `LIVE_MATCH_INTERNAL_SECRET` (Stage 4) is different: `deploy-live-match-worker.yml` reads it
  from two GitHub Actions secrets (`LIVE_MATCH_INTERNAL_SECRET_PRODUCTION`/`_TEST`) and pushes
  it to each Worker via `wrangler secret put` automatically on every deploy — no manual
  `wrangler secret put` needed for this one. The two GitHub secrets themselves are still a
  one-time human-set step (same as any repository secret), and must match the corresponding
  Vercel `LIVE_MATCH_INTERNAL_SECRET` env var exactly, per environment.

## Project layout and why it's separate from the main app

```text
workers/live-match/
    wrangler.jsonc
    tsconfig.json        # separate from the root tsconfig — Workers runtime types, not DOM
    vitest.config.ts      # separate from the root vitest config — no TEST_DATABASE_URL needed
    src/
        index.ts               # routing/validation only: Origin allowlist, matchId shape, WS upgrade
        match-session-object.ts # the Durable Object: all session/protocol logic
        state.ts                # pure decision functions (no Workers runtime dependency)
        rpc.ts                   # RPC envelope construction helpers
        auth.ts                  # ticket verification + Origin/matchId validation
        internal-client.ts       # Stage 4: signs + sends persistence/snapshot requests to Vercel
        worker-types.ts          # Env bindings
    test/
        state.test.ts
        auth.test.ts
        rpc.test.ts
        internal-client.test.ts
```

Stage 4 also added, on the main Next.js side:

| File | Purpose |
|------|---------|
| `src/lib/live-match/realtime/internal-signature.ts` | Shared HMAC sign/verify (Web Crypto, used by both the Worker and Vercel) |
| `src/lib/live-match/realtime/internal-auth.ts` | Vercel-side `verifyInternalRequest()` — raw-body HMAC verification |
| `src/app/api/internal/live-match/events/route.ts` | `POST` — HMAC-only internal endpoint, calls `recordEventForActor()` |
| `src/app/api/internal/live-match/snapshot/route.ts` | `GET` — HMAC-only internal endpoint, canonical session/events for reconciliation |

The root `tsconfig.json` excludes `workers/` entirely — Workers runtime types
(`@cloudflare/workers-types`) are not compatible with the main app's `dom` lib, so they are
type-checked as a fully separate TypeScript project (`npm run typecheck:workers`). The root
`vitest.config.ts` only includes `src/**/*.test.ts`, so this Worker's own tests run via a
separate config (`npm run test:workers`) rather than the main `npm test` gate — the same
pattern already used for `vitest.config.components.ts`.

Shared application protocol code (`src/lib/live-match/realtime/protocol.ts`,
`protocol-schemas.ts`, `realtime-messages.ts`, `realtime-ticket.ts`) is imported directly by
relative path from `workers/live-match/`, not duplicated — none of it depends on Next.js,
React, or a running Prisma client (the one Prisma-derived type it touches,
`MatchPeriod`, is a type-only import, erased at build time).

## Test coverage — what is and isn't covered

- **Covered by plain Vitest** (`npm run test:workers`): every decision `state.ts` makes
  (event classification, authenticate/re-arm/mismatch outcomes, record-event idempotency and
  version assignment, stale-state rejection, end-session pending-persistence gating), the
  Worker's Origin/matchId validation helpers, and RPC envelope construction. These need zero
  Workers runtime and are the highest-value tests for this stage's actual logic.
- **Stage 4 additions**: HMAC sign/verify round-trip (including tampered-body, wrong-secret,
  stale-timestamp, and boundary-timestamp cases) — `internal-signature.test.ts`, zero Workers
  runtime needed (`crypto.subtle` works identically in Node). Both internal routes have full
  request-level tests including a real end-to-end signature computed and verified through the
  actual route handler, not just mocked-away. `recordEventForActor()` has direct integration
  tests against a real test database (session/match/org consistency, dedup, explicit-actor
  usage with no `requireActorContext()` call) alongside the pre-existing `recordEvent()`
  tests, proving the refactor didn't change browser-facing behavior.
- **Stage 5 additions** (`src/components/live-match/__tests__/`, plain Vitest against jsdom
  via `vitest.config.components.ts` — no real WebSocket needed, `RealtimeMatchClient` is
  faked): the primary/fallback decision in `createLeagueActions.recordEvent` (persisted skips
  HTTP; pending, unavailable, and thrown-rejection cases all fall through to HTTP), the
  `STALE_STATE` self-heal in `useLiveRealtime.tryRecordEvent`, `onLiveUpdate` firing for
  `applyEvent`/`presenceChanged`/`sessionEnded` and stopping after unsubscribe,
  `getSnapshot`-driven version re-derivation on reconnect, `reconnectNow`'s no-new-client
  behavior, and `LiveMatchClient`'s own wiring of `onLiveUpdate`/`reconnectRealtime` (immediate
  refresh on broadcast, immediate reconnect attempt on the browser `online` event).
- **Not covered by an automated integration test**: the real `MatchSessionObject` class
  running inside an actual Workers runtime — WebSocket upgrade handling, hibernation
  survival, `ctx.getWebSockets()` behaviour, and the actual `handleRecordEvent` → sign → POST
  → mark-persisted orchestration end-to-end. This repository does not yet have
  `@cloudflare/vitest-pool-workers`/Miniflare wired up. Re-evaluated at Stage 4 (the trigger
  Stage 3 named for revisiting this) and still judged not worth the toolchain complexity: the
  new security-critical logic (HMAC) is 100% covered by pure-function tests, the Vercel-side
  domain logic needs no Workers-specific behaviour to test, and the remaining orchestration
  glue is straightforward branch-on-success/failure logic. What substitutes for it today:
  `npx wrangler deploy --dry-run` (bundles and validates bindings without touching
  Cloudflare) and manual verification via `npm run dev:realtime` against a real local Worker
  runtime. Revisit at Stage 6, which introduces genuinely hard-to-pure-function-test
  Durable-Object-native behaviour (alarms, retry state machines).
