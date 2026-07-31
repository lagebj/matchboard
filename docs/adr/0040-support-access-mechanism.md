# ADR-0040: Support-Access Mechanism

## Status

Accepted

## Context

Matchboard is a private coaching app. When an organisation owner needs platform support, or when platform operators need to investigate an issue, there must be a mechanism for temporary, audited access to an organisation's data.

The support-access mechanism must:
- Be explicit and time-bound
- Require OWNER consent or platform operator authority
- Be fully audited
- Never bypass tenant isolation
- Never create a permanent backdoor
- Not expose data to other organisations

## Decision

Support access uses the existing membership model with a designated support role.

### Support membership model

- Add a `SUPPORT` role to `OrganisationRole` alongside OWNER, ADMIN, COACH, VIEWER.
- A SUPPORT member has read-only access to all organisation data, similar to VIEWER but with additional diagnostic context (audit logs, system health).
- SUPPORT membership is always time-bound with a mandatory expiry.
- SUPPORT membership is always created with an explicit reason.
- SUPPORT membership creation, access, and revocation are fully audited.

### Support access creation

1. An OWNER can invite a support user by email with role SUPPORT and a mandatory expiry (max 72 hours).
2. A platform operator (future) can create a SUPPORT membership directly with a mandatory reason.
3. SUPPORT membership cannot be self-granted.
4. SUPPORT membership cannot be upgraded to OWNER or ADMIN.

### Support access restrictions

- SUPPORT members cannot create, update, or delete any entity.
- SUPPORT members cannot export organisation data (export requires OWNER or ADMIN).
- SUPPORT members cannot manage memberships, invitations, or machine principals.
- SUPPORT members can view audit logs for their own support session only.

### Audit requirements

- Every SUPPORT membership creation records: who created it, for whom, reason, expiry.
- Every SUPPORT access to organisation data is logged with the support user's identity.
- SUPPORT membership expiry is enforced at the resolver level: expired SUPPORT members are denied access.
- SUPPORT membership is automatically cleaned up after expiry (background job or lazy evaluation).

### Deferral

The SUPPORT role implementation is deferred to MT-7 (verification, recovery, and cleanup). This ADR records the architectural decision now so that future implementation follows these constraints.

## Consequences

- Support access is explicit, time-bound, audited, and read-only.
- No permanent backdoor or cross-tenant bypass.
- Support membership follows the same isolation model as other roles.
- Implementation requires a migration to add SUPPORT to OrganisationRole and a background job for expiry cleanup.

## References

- ADR-0035: Multitenancy architecture and product decisions
- ADR-0036: Tenant context resolution and query scoping
- ADR-0039: Tenant, database and machine-identity assurance