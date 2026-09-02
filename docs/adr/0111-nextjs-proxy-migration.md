# ADR-0111: Migrate from middleware.ts to proxy.ts (Next.js 16)

**Date**: 2026-09-02

**Status**: Accepted

## Context

Next.js 16 deprecates the `middleware.ts` file convention in favour of `proxy.ts`. The new proxy convention defaults to the Node.js runtime instead of the Edge Runtime, which removes the constraint that required a separate Edge-only Auth.js configuration (`auth-edge.ts`).

The existing `src/middleware.ts` and `src/auth-edge.ts` were fully functional, but:
- `middleware.ts` ran on the Edge Runtime, which could not use PrismaAdapter or other Node.js-only modules
- `auth-edge.ts` was a separate Auth.js config limited to JWT-only session strategy (no PrismaAdapter)
- The deprecation warning appeared in builds

## Decision

Migrate `src/middleware.ts` → `src/proxy.ts` and delete `src/auth-edge.ts`.

The proxy file:
- Uses `proxyAuth` from a new `src/auth-proxy.ts` — a lightweight JWT-only Auth.js instance without PrismaAdapter or database imports, purpose-built for the proxy layer
- Runs on the Node.js runtime by default (no `runtime = 'edge'` export — Next.js 16 prohibits runtime config in proxy files)
- Contains identical request-boundary logic: auth redirect, public route bypass, preview allowlist, security headers
- No business logic was moved into or out of the proxy; server-side authorization (`requireActorContext`, `requireCoachAccess`) remains the authoritative auth boundary

### Proxy auth separation (`src/auth-proxy.ts`)

The old Edge-only `auth-edge.ts` had no database imports — it was lean by necessity (Edge Runtime cannot use Prisma). The initial migration used `auth` from `@/auth` directly, but this imports `PrismaAdapter(db)` and the full Prisma module graph at the proxy layer, adding significant cold-start latency on Vercel serverless. The Node.js runtime proxy runs on every matching request; its module-import chain must stay lean.

`src/auth-proxy.ts` is a dedicated JWT-only Auth.js instance that:
- Shares the same JWT session configuration as `src/auth.ts` (same secret, same maxAge/updateAge, same callbacks) — tokens created by either instance are mutually verifiable
- Has no PrismaAdapter — the proxy only verifies JWT sessions, never creates or updates users
- Has a lightweight test-agent `authorize` that returns a synthetic user (no `db.user.upsert`) — sign-in goes through `@/auth`'s handlers route (which has PrismaAdapter), not through the proxy's authorize
- Imports no database modules (`@/lib/db`, `@auth/prisma-adapter`, PrismaClient)

`src/auth.ts` (full Auth.js config with PrismaAdapter and test-agent user upsert) continues to be used by all route handlers and server actions for sign-in flows and user management.

## Consequences

- The Edge Runtime constraint is removed; `auth-edge.ts` is no longer needed
- Auth configuration is split: proxy uses `auth-proxy.ts` (JWT-only, no DB), route handlers use `auth.ts` (full config with PrismaAdapter)
- Security audit and validation tests reference `src/proxy.ts` instead of `src/middleware.ts`
- ADRs 0031, 0032, 0034, 0061, 0062, 0065, 0086, 0103 and the threat model updated to reference the new file
- No functional or security boundary changes — this is a structural migration only
- E2E test reliability restored: the proxy no longer imports PrismaClient, eliminating cold-start latency that caused `seed-draft-match` timeouts on Vercel serverless