# ADR-0063: Hash invitation tokens and enforce single-use acceptance

## Status

Accepted

## Date

2026-08-18

## Decision owners

- Matchboard maintainer

## Context

ADR-0032 deferred "invitation and token replay protection" to when invitations were added. ADR-0035 specified invitations as "email-bound, expiring, single-use, revocable, and auditable." Invitations are now fully implemented (ADR-0061), but token replay protection was not addressed.

Current state:
- Invitation tokens are generated with 32 random characters (`crypto.getRandomValues`)
- Tokens are stored **in plaintext** in `OrganisationInvitation.token` (unique, indexed)
- Tokens are looked up directly: `findUnique({ where: { token: data.token } })`
- Status transition PENDING → ACCEPTED provides implicit replay protection for accept/decline
- But: the token remains visible in URLs, database queries, logs, and email
- No rate limiting on the invitation accept/decline endpoint
- ADR-0035 claims invitations are "single-use" but the token is not consumed in a way that prevents information disclosure

Security requirements from AGENTS.md:
- "Input schemas and bounds are required on every server mutation"
- "Secrets never enter Git, logs, fixtures, reports or public environment variables"
- Invitation tokens are secrets (they grant organisation access)

## Decision

1. **Hash invitation tokens before storage.** Use SHA-256 to hash tokens before storing in the database. The raw token is only available at creation time and is sent to the invitee in the email link. The database stores only the hash.

2. **Look up invitations by token hash.** Replace `findUnique({ where: { token } })` with `findFirst({ where: { tokenHash: hash(token) } })`. The plaintext token is never stored, never logged, and never appears in database queries after creation.

3. **Keep the token column for migration compatibility.** Add a `tokenHash` column. Populate it from existing `token` values in a migration. After migration, the `token` column is retained but no longer used for lookup — it can be nullified and eventually removed.

4. **Add rate limiting to invitation accept and decline endpoints.** Use the existing in-memory rate limiter to prevent brute-force token probing.

5. **Audit log all invitation mutations.** Already implemented (`logOrganisationInvitationCreate`, `logOrganisationInvitationAccept`, `logOrganisationInvitationRevoke`). Add decline and expiry logging.

## Rationale

- Hashing tokens before storage prevents token disclosure from database dumps, logs, or query parameters persisted in server access logs.
- SHA-256 is appropriate for token hashing (not passwords — no salt needed since tokens are high-entropy random values).
- The status transition (PENDING → ACCEPTED) already prevents reuse at the application level; hashing adds protection against information disclosure.
- Rate limiting prevents brute-force probing of the token space (32 chars from 62-char alphabet = ~3 × 10^57 possible tokens, which is infeasible to brute-force, but rate limiting is defense-in-depth).

## Alternatives considered

### Store tokens in plaintext with status-based replay protection only

- Benefits: No schema migration, simpler code
- Costs: Tokens visible in database, logs, and URLs; ADR-0035 "single-use" claim is misleading; tokens are long-lived secrets stored in plaintext
- Reason not selected: Violates AGENTS.md secrets policy and ADR-0032 replay protection commitment

### Use HMAC instead of SHA-256 hash

- Benefits: Keyed hash prevents hash comparison across deployments
- Costs: Requires secret key management; adds complexity for no practical security benefit since tokens are unique per invitation
- Reason not selected: SHA-256 hash is sufficient for high-entropy random tokens

### One-time token with immediate invalidation

- Benefits: Token is consumed and cannot be viewed again
- Costs: Breaks the invitation acceptance page flow (user must click the link immediately); does not match the UX where a user views the invitation page before accepting
- Reason not selected: Status-based single-use already provides replay protection; hashing adds disclosure protection

## Consequences

### Positive

- Invitation tokens are no longer stored in plaintext
- ADR-0032 deferred replay protection commitment is fulfilled
- ADR-0035 "single-use" claim becomes accurate
- Tokens cannot be extracted from database dumps, logs, or persisted queries
- Rate limiting adds defense against brute-force probing

### Negative

- Schema migration required (add `tokenHash` column, backfill, update lookup)
- Token lookup changes from unique index to hash-based query
- Slightly more complex invitation creation and acceptance flow

### Risks and mitigations

- Risk: Migration must hash all existing tokens without downtime
  Mitigation: Add nullable `tokenHash`, backfill from `token`, make `tokenHash` required after backfill
- Risk: Rate limiting is in-memory only (not distributed)
  Mitigation: Documented limitation; acceptable for current deployment scale; upgrade to distributed rate limiting when needed

## Migration and compatibility

1. Add `tokenHash` String? column to `OrganisationInvitation`
2. Create migration that adds the column
3. Backfill: `UPDATE "OrganisationInvitation" SET "tokenHash" = encode(sha256("token"::bytea), 'hex') WHERE "tokenHash" IS NULL`
4. Update `createInvitation` to hash the token and store the hash
5. Update `acceptInvitation`, `declineInvitation`, and the invite page to look up by hash
6. After backfill, make `tokenHash` required and add unique index
7. In a follow-up migration, nullify the `token` column (or remove it)

## Security and operations

- Token hashing prevents disclosure from database, logs, and persisted queries
- Rate limiting on accept/decline endpoints: 10 requests per minute per IP
- Audit logging already covers create, accept, revoke — add decline and expiry
- No external provider changes required (Brevo email template uses the raw token in the link, which is correct)

## Related records

- ADRs: ADR-0032 (auth baseline — deferred token replay protection), ADR-0035 (multitenancy — single-use invitations), ADR-0043 (Brevo email), ADR-0061 (membership-based auth)
- ARRs: None
- Security findings: Invitation tokens stored in plaintext (medium severity)

## Implementation evidence

- Pull requests: PR #291 (security/invitation-hardening)
- Tests: 15 invitation security tests in `src/test/invitation-security.test.ts`
  - Token hashing (SHA-256) verification
  - Token nullification after accept, decline, revoke, and expiry
  - Replay prevention (cannot accept already-accepted invitation)
  - Email mismatch rejection
  - Already-member rejection
  - Duplicate pending invitation prevention
  - Membership creation without GroupAccess on acceptance
  - VIEWER role invitation creates VIEWER membership
  - Role hierarchy (COACH cannot invite OWNER/ADMIN)
  - Non-member invitation rejection
  - Cross-organisation isolation
  - Token hash scope (org A token cannot join org B)
  - Expired invitation rejection with token nullification
- Migration: `prisma/migrations/20260818140000_nullify_invitation_token_after_use/migration.sql`
- `getAppBaseUrl()` returns localhost in dev/test envs; production requires `APP_BASE_URL` (AUTH_URL fallback removed)
- Audit logging added for `organisation_invitation_decline` and `organisation_invitation_expire`
- `revokeInvitation` accepts `PrismaClient` parameter for testability
- ARR-0068 records in-memory rate limiting as confirmed architectural residue

## Supersedes

ADR-0032 section on "invitation and token replay protection (documented, deferred)" — now implemented.

## Superseded by

None.

## History

### 2026-08-18

Record created. Invitation token hashing and rate limiting.