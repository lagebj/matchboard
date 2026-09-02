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
- Uses `auth` from `@/auth` (the Node.js Auth.js config with JWT + PrismaAdapter) instead of `edgeAuth` from `@/auth-edge`
- Runs on the Node.js runtime by default (no `runtime = 'edge'` export)
- Contains identical request-boundary logic: auth redirect, public route bypass, preview allowlist, security headers
- No business logic was moved into or out of the proxy; server-side authorization (`requireActorContext`, `requireCoachAccess`) remains the authoritative auth boundary

## Consequences

- The Edge Runtime constraint is removed; `auth-edge.ts` is no longer needed
- All auth configuration now flows through a single `src/auth.ts`
- Security audit and validation tests reference `src/proxy.ts` instead of `src/middleware.ts`
- ADRs 0031, 0032, 0034, 0061, 0062, 0065, 0086, 0103 and the threat model updated to reference the new file
- No functional or security boundary changes — this is a structural migration only