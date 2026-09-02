# ADR-0034: Preview deployment API protection and forbidden SQL methods

## Status

Accepted

## Date

2026-07-29

## Context

SEC-4 requires edge and abuse protection including preview deployment protection and targeted rate limits. SEC-5 requires safe query practices.

Preview deployments on Vercel (VERCEL_ENV=preview) are accessible to anyone with the URL. Before this change, any authenticated coach could access all API routes on preview deployments, potentially exposing test or staging data.

Application code must not use `$queryRawUnsafe` or `$executeRawUnsafe` Prisma methods, which accept raw string queries and bypass parameterized query safety. All raw SQL in the application must use tagged template literal syntax (`$queryRaw` / `$executeRaw`).

## Decision

1. **Preview deployment API route protection**: On Vercel preview deployments, API routes (paths starting with `/api/`) are restricted to coaches in the `PREVIEW_ALLOWLIST_EMAILS` environment variable. When this variable is empty or unset, all authenticated coaches can access. Page routes remain accessible to all authenticated coaches for testing UI changes.

2. **Forbidden SQL methods static check**: Added `scripts/check-forbidden-sql.ts` and `npm run security:check-sql` that scans all application source files for `$queryRawUnsafe` and `$executeRawUnsafe`. Integrated into the `validate` npm script. All existing raw queries use safe tagged template literals.

3. **Security audit test**: Added automated test that scans application source for forbidden SQL methods, complementing the static check script.

## Consequences

- Preview deployments have an additional access control layer for API routes
- `PREVIEW_ALLOWLIST_EMAILS` is optional — when unset, preview behaves like production
- Application code has zero violations of forbidden SQL methods
- The static check runs in CI/verify pipeline and will fail if forbidden methods are introduced
- Rate limiting per organisation and per operation requires multitenancy support (MT-0+)

## References

- SEC-4: Edge, WAF, and abuse protection
- SEC-5: Secrets, environments, and supply chain
- `src/proxy.ts` — preview deployment protection (formerly `src/middleware.ts`)
- `scripts/check-forbidden-sql.ts` — forbidden SQL methods scanner
- `src/test/security-audit.test.ts` — forbidden SQL methods test