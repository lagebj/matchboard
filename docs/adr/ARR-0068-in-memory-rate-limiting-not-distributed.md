# ARR-0068: In-memory rate limiting is not distributed

## State

Confirmed

## Identified

2026-08-19

## Residue

The rate limiter (`src/lib/rate-limit.ts`) uses an in-process `Map<string, RateLimitEntry>` that is not shared across serverless function instances. In a serverless deployment (Vercel), each function invocation may run in a separate process, so rate limits are per-instance rather than per-client across the deployment.

AGENTS.md explicitly acknowledges this: "Rate limiting is in-memory only — document this limitation for production."

ADR-0063 (invitation token hardening) specifies "Rate limiting on accept/decline endpoints: 10 requests per minute per IP" but the implementation is in-memory only.

The in-memory limiter is used by 14+ API routes and server actions, protecting invitation acceptance, draft generation, simulation, admin endpoints, and data exports.

## Intended architecture

Rate limiting must be effective across all deployment instances to prevent brute-force attacks, abuse, and resource exhaustion. A client that exceeds the rate limit on one instance should not be able to bypass it by hitting a different instance.

## Evidence

- `src/lib/rate-limit.ts`: in-memory `Map<string, RateLimitEntry>` with no external store
- `src/app/(app)/organisations/actions.ts`: imports `rateLimit` for invitation creation
- `src/app/api/auth/token/route.ts`: imports `rateLimit` for token endpoint
- `src/app/api/generate-round/route.ts`: imports `rateLimit` for round generation
- `src/app/api/clear-draft/route.ts`: imports `rateLimit` for draft clearing
- `src/app/api/admin/audit/route.ts`: imports `rateLimit` for admin audit
- `src/app/api/admin/reconcile/route.ts`: imports `rateLimit` for reconciliation
- `src/app/api/admin/migrate/route.ts`: imports `rateLimit` for migration
- `src/app/api/simulation/run/route.ts`: imports `rateLimit` for simulation
- `src/app/api/simulation/apply/route.ts`: imports `rateLimit` for simulation apply
- `src/app/api/populate-all/route.ts`: imports `rateLimit` for populate-all
- `src/app/api/season/export/route.ts`: imports `rateLimit` for season export
- `src/app/api/workbench/run/route.ts`: imports `rateLimit` for workbench
- `src/app/api/draft-selection/route.ts`: imports `rateLimit` for manual selection edits
- AGENTS.md: "Rate limiting is in-memory only — document this limitation for production"

## Impact

- **Brute-force token probing**: An attacker can probe invitation tokens by distributing requests across function instances, each seeing a fresh rate limit counter.
- **Resource exhaustion**: Generation, export, and admin endpoints are not protected against distributed abuse.
- **Operational risk**: Rate limits are per-process, not per-deployment. Burst traffic that exceeds limits on one instance may be allowed on another.
- **This is architectural residue** rather than a code smell because the rate limiter interface is embedded in 14+ call sites, and replacing it with a distributed store requires an infrastructure decision (Redis, Upstash, Neon-based counter, or similar) that affects deployment topology and cost.

## Containment

- Do not add new rate limit calls that assume per-deployment effectiveness without documenting the in-memory limitation.
- Do not remove the in-memory rate limiter without a replacement that provides per-deployment effectiveness.
- All new rate-limited endpoints must use the existing `rateLimit()` function interface so that a future distributed replacement can be swapped in without changing call sites.
- Any security documentation or ADR referencing rate limiting must note that it is in-memory only until a distributed implementation is deployed.

## Resolution criteria

- A distributed rate limiter (e.g., Redis, Upstash, Neon-backed counter) is deployed and replaces the in-memory `Map`.
- Rate limits are effective across all serverless function instances.
- Existing `rateLimit()` call sites continue to work with the distributed implementation (interface compatibility or migration).
- Tests verify that rate limiting is effective across simulated concurrent instances.

## Disposition

Accepted risk for current deployment scale. ADR-0063 documents this as a known limitation. Upgrade to distributed rate limiting when deployment scale, threat model, or compliance requirements demand it.

## Related decisions

- ADR-0063: Hash invitation tokens and enforce single-use acceptance (documents in-memory rate limiting as a risk mitigation dependency)

## Related implementation

- `src/lib/rate-limit.ts`: in-memory rate limiter
- 14+ call sites importing `rateLimit`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-19

Record created. Confirmed in-memory rate limiter as architectural residue. Accepted as documented risk per ADR-0063.