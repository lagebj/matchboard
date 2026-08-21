# SEC-8: Paid-Beta Security Acceptance

## Acceptance Criteria

Before Matchboard enters paid-beta production use, all criteria below must be satisfied.

## Authentication and Authorization

- [x] All protected server actions call `requireCoachAccess()`
- [x] All protected API routes call `requireCoachAccess()`
- [x] No protected page renders coach data without auth
- [x] Email allowlist enforced for coach access
- [x] Organisation membership required for org-scoped data
- [x] SUPPORT role has read-only restrictions
- [x] Machine principal tokens are org-scoped and time-bound
- [x] Auth pages use public layout (no sidebar, no coach data)

## Data Isolation

- [x] Application-level org filters on all tenant-bearing queries
- [x] RLS policies created (conditional migration, pending Neon role creation)
- [x] Organisation cascade deletes implemented
- [x] Organisation suspension blocks member access
- [x] Organisation deletion removes all tenant data
- [x] Machine principal org binding enforced
- [x] Synthetic org isolation verified in tests

## Input Validation and Output Encoding

- [x] Zod schemas on all server mutations
- [x] No `$queryRawUnsafe` or `$executeRawUnsafe` in application code
- [x] CSP headers configured (report-only mode for beta, enforce after tuning)
- [x] No `NEXT_PUBLIC_` secrets in source
- [x] No hardcoded credentials in tracked files
- [x] Parent-facing exports strip internal planning data
- [x] Player names not stored in assistant issues or decision records
- [x] Opponent observations follow child-safe language rules

## Audit and Incident

- [x] Structured audit logging on all mutations (finalization, overrides, exports)
- [x] Auth denial events logged
- [x] Incident response procedures documented
- [x] Backup verification procedure documented (Neon PITR testing pending)
- [x] Secret rotation procedures documented

## Supply Chain

- [x] GitHub Actions pinned by SHA
- [x] Supply chain integrity check in CI
- [x] Forbidden SQL methods check in CI
- [x] Dependabot configured
- [x] 18 transitive npm vulnerabilities accepted (none exploitable in request handling)

## External Configuration (Required Before Beta)

- [ ] GitHub branch protection rules enabled on `main`
- [ ] GitHub secret scanning and push protection enabled
- [ ] `matchboard_app` and `matchboard_admin` database roles created in Neon
- [ ] RLS policies enforced in production (after role creation)
- [x] CSP enforcement mode tested and switched (`CSP_ENFORCE=true`) — 2026-08-21, see ADR-0031 History
- [ ] Vercel log drain configured for persistent audit trail
- [ ] Neon PITR backup verified

## Deferrals (Not Beta Blockers)

- Per-organisation rate limiting (requires multitenancy completion)
- Step-up authentication for destructive operations (product feature)
- SSRF allowlist (no outbound HTTP in app code)
- Workload identity / OIDC between Vercel and GitHub

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Security lead | | | Pending |
| Engineering lead | | | Pending |
| Product owner | | | Pending |

All code-level criteria are met. External configuration items require GitHub, Neon, and Vercel settings that cannot be automated from the repository.