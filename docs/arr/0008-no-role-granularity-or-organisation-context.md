# ARR-0008: requireCoachAccess() provides no role granularity or organisation context

## Status

Active

## Discovered

2026-07-30

## Residue

The current `requireCoachAccess()` function in `src/lib/auth.ts` returns a single coach object with no role, no organisation context, and no team delegation. Every server action treats the authenticated user identically — as a full-access coach.

Per ADR-0035, the target model has four roles (OWNER, ADMIN, COACH, VIEWER) with organisation membership and team-level delegation. Until MT-1 is implemented, there is no database-backed membership, no role differentiation, and no team access scoping.

## Containment

- `requireCoachAccess()` is the single authorisation gate for all protected operations
- The middleware allowlist provides edge-level access control
- Preview deployment API routes are restricted to `PREVIEW_ALLOWLIST_EMAILS`
- No resource-level authorisation (IDOR) protection exists — acknowledged gap in threat model (G-03, G-04)

## Resolution criteria

- `requireOrganisationAccess()` replaces `requireCoachAccess()` for all protected routes
- User → OrganizationMembership → role resolution is mandatory
- COACH and VIEWER roles have explicit team delegation via TeamAccess
- OWNER and ADMIN roles have organisation-wide access
- Every mutation validates the user's role and permitted teams before executing

## Affected ADRs

- ADR-0032 (authentication, session and authorisation baseline — deferred database-backed membership)
- ADR-0035 (multitenancy architecture and product decisions)

## Related

- `src/lib/auth.ts` — current auth implementation
- Threat model gaps G-03 (no resource-level authorisation) and G-04 (no role granularity)