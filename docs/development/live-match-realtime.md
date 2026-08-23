# Live match realtime (Cloudflare Durable Objects)

Live match reporting is normally local-first and HTTP-only (`src/lib/live-match/`). The
live-match-realtime programme adds an optional, additive realtime coordination layer on top
of that using a Cloudflare Worker + Durable Object per active match. See
`docs/adr/0086-live-match-realtime-cloudflare-durable-objects.md` for the architecture
decision (why Cloudflare Durable Objects, the trust boundary, the Free-plan design, and the
HTTP-fallback rollback story) before changing anything here.

## Current status: Stage 3 + "Follow live" viewer

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
  connection and best-effort broadcasts each event to the Worker purely so viewers see it —
  Neon persistence is unaffected, still happening via the existing HTTP action. The viewer
  itself is `src/components/live-match/follow-live-client.tsx`, reached via "Follow live" on
  the match detail page (shown only when a session is `ACTIVE` and the coach has at least
  `GROUP_VIEWER` access — enforced server-side, not just hidden in the UI).
- **Not yet implemented**: canonical event persistence. `recordEvent` durably accepts an
  event and assigns it a realtime version, but nothing ever reaches Neon through the realtime
  path — `persistenceStatus` stays `"pending"` forever until a future stage adds the signed
  Worker→Vercel internal API. A direct, intentional consequence: `endSession` can only
  succeed today for a session that recorded zero events. This does not affect "Follow live"
  or the reporting coach's actual persistence, both of which are already independently
  described above.
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
default, with `MATCHBOARD_APP_ORIGINS` set to `http://localhost:3333`. The Worker also needs
`LIVE_MATCH_REALTIME_SECRET` set locally to the same value as the Next.js app's own
`.env` — Wrangler reads Worker secrets from a local `.dev.vars` file
(`workers/live-match/.dev.vars`, gitignored) for `wrangler dev`, not from the repository's
root `.env`:

```text
# workers/live-match/.dev.vars (not committed)
LIVE_MATCH_REALTIME_SECRET=same-value-as-root-.env
```

## Deployed environments

Two separately-deployed Workers, matching the existing `matchboard`/`matchboard-test` Vercel
project split (ADR-0086):

| Environment | Worker name | Custom domain |
|---|---|---|
| Production | `matchboard-live-match-realtime-production` | `realtime.matchboard.football` |
| Test | `matchboard-live-match-realtime-test` | `realtime-test.matchboard.football` |

Both custom domains and their placeholder Workers already exist in the real Cloudflare
account (ADR-0086's History) — deploying real code to them is a future action, not something
this change performs. `LIVE_MATCH_REALTIME_SECRET` must be set per environment via
`wrangler secret put LIVE_MATCH_REALTIME_SECRET --config workers/live-match/wrangler.jsonc
--env production` (and again with `--env test`), mirroring how `AUTH_SECRET` is already set
by hand in Vercel's dashboard (`docs/security/secret-rotation-procedures.md`) — no vault is
in use for either.

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
        worker-types.ts          # Env bindings
    test/
        state.test.ts
        auth.test.ts
        rpc.test.ts
```

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
- **Not covered by an automated integration test**: the real `MatchSessionObject` class
  running inside an actual Workers runtime — WebSocket upgrade handling, hibernation
  survival, `ctx.getWebSockets()` behaviour. This repository does not yet have
  `@cloudflare/vitest-pool-workers`/Miniflare wired up, and adding it was judged to add
  meaningful new toolchain complexity for a first Worker with uncertain return, given that
  every actual *decision* the object makes is already exercised via `state.ts`'s tests. What
  substitutes for it today: `npx wrangler deploy --dry-run` (bundles and validates bindings
  without touching Cloudflare) and manual verification via `npm run dev:realtime` against a
  real local Worker runtime. This gap should be revisited once a later stage's own tests
  (e.g. Stage 4's actual persistence round-trip) make Workers-runtime-level integration
  testing worth the setup cost.
