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

## Group-scoped live reporting authorization

Organisation mutation role alone is not sufficient authority for group-scoped live match
reporting by a non-admin coach: League and Event report-mode mutation both require
`GROUP_COACH` authority on the match's football group in addition to organisation mutation
role (`OWNER`/`ADMIN` retain an administrative bypass). `GROUP_VIEWER` must remain read-only
for live reporting, exactly as it is for planning. See ADR-0140 and
`docs/development/live-match-realtime.md`.

## Tenant isolation and provider configuration

The app must keep tenant data isolated, audit logs sanitized, and provider configuration explicit and documented rather than implicit. When a change touches Vercel, Neon, GitHub, or other provider configuration, update the durable repository guidance and avoid pure-implicit production actions.

## AI Advisor credential and data boundary

AI Advisor (ADR-0148) is optional, disabled by default, and org-controlled. Provider API
credentials never reach the main Matchboard database — enrollment goes browser-direct to a
separate credential-security service, and server-side AI execution retrieves a credential only
just-in-time per call. Provider payloads carry only pseudonymized, minimum-necessary structured
football data (stable temporary references, never names/emails/internal IDs/free-text notes).
See `SECURITY.md`'s "AI Advisor credential security" section and ADR-0148 for the full
architecture before touching any `src/lib/ai/` or `/api/ai/` code.

## Security workflow

Use the repository's existing security review workflow. Treat scanner output as evidence, not proof. Reproduce and regression-test credible findings before closing a fix.

## Relevant references

- `SECURITY.md`
- `docs/agents/data-architecture-and-operations.md`
- `docs/adr/` and `docs/arr/` for security-relevant decisions
- `features/matchboard.feature` where security-related behavior is described
