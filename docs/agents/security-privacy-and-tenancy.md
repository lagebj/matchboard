# Security, privacy, and tenancy

This module captures the repository's non-negotiable security and tenancy constraints.

## Core rules

- Authentication is not authorization.
- Authorization is server-side and deny-by-default.
- Tenant-owned operations require trusted context.
- Sensitive operations must re-check current membership and role.
- Input schemas and bounds are required on every mutation.
- Output is minimized and encoded for its destination.
- Unsafe raw SQL is forbidden in application code.
- Secrets must never be committed to Git or logged in clear text.

## Tenant isolation and provider configuration

The app must keep tenant data isolated, audit logs sanitized, and provider configuration explicit and documented rather than implicit. When a change touches Vercel, Neon, GitHub, or other provider configuration, update the durable repository guidance and avoid pure-implicit production actions.

## Security workflow

Use the repository's existing security review workflow. Treat scanner output as evidence, not proof. Reproduce and regression-test credible findings before closing a fix.

## Relevant references

- `SECURITY.md`
- `docs/agents/data-architecture-and-operations.md`
- `docs/adr/` and `docs/arr/` for security-relevant decisions
- `features/matchboard.feature` where security-related behavior is described
