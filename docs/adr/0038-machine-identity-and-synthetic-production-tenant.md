# ADR-0038: Machine identity and synthetic production tenant

## Status

Proposed

## Date

2026-07-30

## Decision owners

- Matchboard engineering

## Context

Matchboard needs machine identities for automation (simulation, CI, smoke testing) that operate within tenant boundaries. Per ADR-0035 MT-4.11, automation uses synthetic organisations with synthetic data only. Per ADR-0035 MT-4.12, machine authentication uses short-lived tokens via token exchange, not long-lived API keys.

The existing auth system uses Auth.js with Google OAuth and an email allowlist. Machine principals need a separate authentication path that does not create fake Google users.

The MachinePrincipal model already exists in the Prisma schema with `organisationId`, `clientCredentialHash`, `clientCredentialPrefix`, `scopes`, and `status`.

## Decision

### 1. Machine principal model — separate from User

Machine principals are a separate identity type stored in the `MachinePrincipal` table. They do not have Google OAuth credentials, email addresses, or User records. They are permanently bound to one organisation.

A machine principal has:
- `id` (cuid, primary key)
- `organisationId` (FK to Organisation, cascade delete)
- `name` (human-readable identifier, e.g. "CI Runner", "Smoke Test Bot")
- `description` (optional)
- `status` (ACTIVE or REVOKED)
- `clientCredentialHash` (SHA-256 hash of the client secret)
- `clientCredentialPrefix` (first 8 chars of the client secret for identification)
- `scopes` (string array of allowed scopes)
- `lastUsedAt` (updated on each token exchange)
- `createdAt`, `updatedAt`

### 2. Token exchange flow

Machine authentication uses OAuth 2.0 client credentials flow:

```
POST /api/auth/token
  grant_type=client_credentials
  client_id=<machine-principal-id>
  client_secret=<client-secret>
  scope=<space-separated scopes>

Response:
  access_token=<short-lived-jwt>
  token_type=Bearer
  expires_in=<seconds>
  scope=<granted-scopes>
```

Token properties:
- 10-15 minute lifetime (configurable via `MACHINE_TOKEN_MAX_AGE`)
- Contains: principalId, organisationId, scopes, issuedAt, expiresAt
- Bound to a single organisation (cannot switch tenant)
- Auditable (issuance and use logged)
- Revocable (check principal status on each request)

The token exchange endpoint validates:
1. `client_id` exists and is an active MachinePrincipal
2. `client_secret` matches the stored hash
3. Requested scopes are a subset of the principal's allowed scopes
4. Principal status is ACTIVE (not REVOKED)

### 3. Scope model

Initial machine principal scopes:

| Scope | Description |
|-------|-------------|
| `scenario:read` | Read simulation scenarios and results |
| `scenario:execute` | Execute simulations |
| `scenario:reset-own-data` | Reset synthetic organisation data |
| `ui:simulate` | Issue browser automation sessions |
| `fixtures:read` | Read fixture and round data |
| `players:read` | Read player data within own organisation |
| `teams:read` | Read team data within own organisation |
| `selections:read` | Read selection data within own organisation |
| `selections:write` | Write selection data within own organisation |

Disallowed scopes (never granted to machine principals):
- `organisation:admin` — organisation administration
- `organisation:create` — creating organisations
- `user:impersonate` — impersonating users
- `billing:*` — billing operations
- `data:export:parent` — parent-facing exports
- `data:read:cross-tenant` — reading other organisations' data

### 4. Synthetic production organisation

A single synthetic organisation is created for automation:

- `isSynthetic: true` flag on the Organisation model
- `name: "Matchboard Canary"` (configurable via `SYNTHETIC_ORG_NAME`)
- Contains only fake players, teams, matches
- No real email addresses or phone numbers
- No external integrations, billing, or customer-facing discovery
- Marked in operator tools and logs

The `isSynthetic` field is added to the Organisation model. Normal users cannot join or discover synthetic organisations.

### 5. Integration with existing auth

Machine tokens are validated in a new middleware layer:

1. For requests with `Authorization: Bearer <token>` header:
   - Decode and verify the JWT
   - Check the principal is ACTIVE
   - Build an ActorContext with principalId, organisationId, scopes
   - This context is used by `resolveOrgFilterForUser` or a new `resolveOrgFilterForMachine`

2. For requests without Authorization header:
   - Use existing Auth.js session (Google OAuth + email allowlist)
   - Build human ActorContext

The `resolveOrgFilterForUser` function gains a companion `resolveOrgFilterForMachine` that returns an OrgFilterMode from machine principal context instead of user membership.

### 6. Kill switch

A platform-level mechanism to:
- Revoke a principal (set status to REVOKED, invalidating all tokens)
- Reject token exchange (refuse new tokens for REVOKED principals)
- End active sessions (tokens with REVOKED principal are rejected on next request)
- Disable synthetic organisation operations (set `isSynthetic` + `status` to suspended)

Kill switch is accessed through a server action requiring OWNER role on the organisation.

### 7. Audit logging

All machine principal operations are audited:
- Token exchange (issuance)
- Token validation failures
- Principal creation and revocation
- Scope changes
- Kill switch activation

Audit events include principalId, organisationId, scopes, and result.

## Rationale

- Separate model avoids fake Google users and keeps human/machine identity clean
- Short-lived tokens via exchange prevent long-lived credential exposure
- Organisation binding prevents cross-tenant access at the identity level
- Scope model allows bounded automation without unrestricted access
- Kill switch provides emergency containment
- JWT tokens integrate cleanly with existing Auth.js JWT infrastructure

## Alternatives considered

### Long-lived API keys

- Benefits: Simpler, no token exchange needed
- Costs: Longer credential exposure window, harder to rotate, harder to scope, violates ADR-0035 MT-4.12
- Reason not selected: ADR-0035 explicitly mandates short-lived tokens via exchange

### Reuse User model with a machine flag

- Benefits: One identity model, existing auth infrastructure
- Costs: Fake Google users, unclear email handling, User model not designed for machines, Auth.js expects OAuth flow
- Reason not selected: Per multitenancy spec section 21.1: "Do not create a fake Google user for automation"

### API key in Authorization header

- Benefits: Stateless, no JWT infrastructure needed
- Costs: No scope model, no short lifetime, no token exchange audit trail
- Reason not selected: ADR-0035 requires short-lived tokens with scope bounding

### OIDC workload identity

- Benefits: Industry standard, no stored credentials
- Costs: Complex setup, requires OIDC provider integration, over-engineering for current needs
- Reason not selected: Spec section 21.5 notes CI should prefer OIDC but doesn't mandate it as the only mechanism. Token exchange with client credentials is simpler and sufficient.

## Consequences

### Positive

- Machine automation operates within tenant boundaries
- Short-lived tokens limit credential exposure
- Synthetic organisation contains automation data
- Scope model bounds machine access
- Kill switch provides emergency containment
- Audit trail for all machine operations

### Negative

- Token exchange adds a network round-trip before each automation session
- Client secret must be stored securely in CI/environment
- Additional endpoint and JWT validation logic
- Synthetic organisation requires seed data

### Risks and mitigations

- Risk: Client secret leaked. Mitigation: Short-lived tokens limit exposure; kill switch revokes immediately; hash stored, never returned after creation.
- Risk: Token replay. Mitigation: JWT includes unique jti claim; short lifetime limits window; revocation check on each request.
- Risk: Machine principal accesses wrong organisation. Mitigation: Principal bound to organisation at creation; OrgFilterMode enforced by tenant context; RLS prevents cross-tenant data access.
- Risk: Synthetic org data leaks to customer. Mitigation: isSynthetic flag; synthetic orgs excluded from normal queries; normal users cannot join synthetic orgs.

## Migration and compatibility

1. Add `isSynthetic` boolean field to Organisation model (default false)
2. Add MachinePrincipal domain logic (CRUD, scope validation, client secret hashing)
3. Add token exchange endpoint (`POST /api/auth/token`)
4. Add machine auth middleware (validate Bearer tokens)
5. Add ActorContext type that accommodates both human and machine identities
6. Add kill switch server action
7. Create synthetic organisation via seed script or bootstrap
8. Add audit logging for machine principal operations

No changes to existing human auth flow. Machine auth is additive.

### Rollback

- Machine auth is additive; removing the token endpoint and middleware disables machine access
- Synthetic organisation can be suspended or deleted
- MachinePrincipal rows can be revoked individually

## Security and operations

- Client secrets are stored as SHA-256 hashes with prefix for identification
- Client secrets are never returned after initial creation (shown once in creation response)
- Token exchange rate-limited (5 requests per minute per principal)
- Failed authentication attempts are logged and rate-limited
- Kill switch is accessible only to OWNER role
- Synthetic organisation data is visibly marked in logs and operator tools
- Machine principal scopes are validated on each request, not just at token exchange

## Related records

- ADRs: ADR-0035 (multitenancy architecture), ADR-0037 (RLS and database role isolation)
- ARRs: None new
- Security findings: None new
- Issues or plans: MT-4 implementation plan

## Implementation evidence

- Pull requests or commits: (pending)
- Tests or verification: (pending)
- Provider evidence: (pending)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-07-30

Record created.