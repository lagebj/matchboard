# ADR-0061: Remove email allowlist, use membership-based authentication

## Status

Accepted

## Date

2026-08-17

## Decision owners

- Matchboard maintainer

## Context

Matchboard currently uses a dual auth gate: Google OAuth for authentication, then `ALLOWED_COACH_EMAILS` environment variable for authorisation. Every request must pass both checks — at sign-in (Auth.js `signIn` callback), at middleware (edge), and at server-action level (`requireCoachAccess`).

The organisation membership system (ADR-0035) is fully implemented:
- `OrganisationMembership` model with roles (OWNER, ADMIN, COACH, VIEWER, SUPPORT)
- `OrganisationInvitation` model with token, email, expiry, status
- `resolveOrganisationAccess()` resolves user → membership → role → permissions
- `requireActorContext()` is the standard auth+authz gate for all org-scoped operations
- Invitation creation, acceptance, revocation, and decline server actions
- Organisation listing page showing memberships and pending invitations

The email allowlist is now a redundant gate that prevents authenticated users with valid memberships from accessing the app. It must be manually maintained (env var changes require redeployment), cannot be self-served by admins, and does not provide role-based access.

The `PREVIEW_ALLOWLIST_EMAILS` env var restricts Vercel preview API routes. This remains useful for preview deployment protection and is kept as a separate mechanism.

## Decision

1. Remove `ALLOWED_COACH_EMAILS` as an auth gate at all three enforcement points:
   - Auth.js `signIn` callback: replace `isAllowedCoach(user.email)` with a check that the user exists and has an email. Sign-in itself no longer gates on membership; membership gates access to organisation data.
   - Middleware: replace allowlist check with session-email existence check. Authenticated users without memberships see the organisations page (create org or accept invitation).
   - `getCurrentCoach()`/`requireCoachAccess()`: remove `isAllowedCoach()` call. Authenticated users with a valid session are coaches. Organisation membership is checked by `requireActorContext()` and `resolveOrganisationAccess()`.

2. Remove `src/lib/allowlist.ts` entirely.

3. Remove `isAllowedCoach` re-export from `src/lib/auth.ts`.

4. Update `src/auth.ts` `signIn` callback: any Google-authenticated user with an email can sign in. The sign-in gate moves from "is on allowlist" to "has a valid Google account with email".

5. Update `src/middleware.ts`: replace `ALLOWED_COACH_EMAILS` check with a simple session-email check. Keep `PREVIEW_ALLOWLIST_EMAILS` for preview API route protection.

6. Update error and sign-in pages: replace allowlist language with membership language.

7. Remove `ALLOWED_COACH_EMAILS` from `.env.example`, CI config, and `devcontainer/start-matchboard.sh`.

8. Keep `PREVIEW_ALLOWLIST_EMAILS` — it serves a different purpose (restricting Vercel preview API routes to specific testers).

## Rationale

- The membership system already provides all the authorisation the allowlist provided, with more granularity (roles, organisations, expiry).
- Removing the allowlist eliminates a deployment-coupled access control mechanism that cannot be self-served by organisation admins.
- Organisation admins can invite and revoke access through the invitation system, which is the intended self-service flow.
- The allowlist was a single-tenant mechanism that creates friction in a multi-tenant context (users with memberships in one org could be blocked by an allowlist that doesn't include them).
- Auth.js session strategy (JWT, 24h max age) already limits session lifetime. Removing the allowlist does not weaken auth — sessions still require Google OAuth.

## Alternatives considered

### Keep allowlist as a secondary gate

- Benefits: Defence-in-depth; even with a valid Google account, only allowlisted users can sign in.
- Costs: Prevents invited users from accessing the app until the env var is updated; requires redeployment for every user addition; conflicts with self-service invitations.
- Reason not selected: The membership system provides equivalent access control with self-service. A separate allowlist adds friction without adding meaningful security beyond Google OAuth + membership.

### Gradual transition with feature flag

- Benefits: Rollback safety; gradual migration.
- Costs: Additional complexity; two auth paths to maintain and test; the membership system is already complete and in production use.
- Reason not selected: The membership system is the sole auth mechanism in practice. All production users have memberships. The allowlist is redundant, not complementary.

## Consequences

### Positive

- Organisation admins can invite and revoke access without env var changes or redeployments
- Auth flow is simpler: Google OAuth → session → membership check
- Single source of truth for access control (OrganisationMembership)
- Self-service invitation flow works end-to-end without admin infrastructure involvement

### Negative

- Any Google-authenticated user can create a session (but cannot access any organisation data without a membership)
- Sign-in page shows "Sign in with Google" to anyone with a Google account (not just allowlisted emails)

### Risks and mitigations

- Risk: Uninvited users can sign in and see the organisations page with "no memberships" state.
  Mitigation: The organisations page shows a clear message: "Ask an organisation owner or admin to invite you, or create a new organisation." This is expected behaviour for an invitation-based system.
- Risk: Existing sessions for allowlisted users will continue to work; sessions for users not on the allowlist who have memberships will now work.
  Mitigation: This is the desired outcome. No session invalidation is needed.
- Risk: Preview deployments lose the allowlist gate.
  Mitigation: `PREVIEW_ALLOWLIST_EMAILS` is retained for preview API route protection.

## Migration and compatibility

- No data migration required. All existing users have Google accounts (Auth.js adapter creates User records on first sign-in). All existing memberships remain valid.
- The `/error` page (shown when allowlist check failed) is repurposed to show a generic "Access denied" message for edge cases (no session, no email).
- The `/organisations` page (already built) handles the "no memberships" state gracefully.
- CI workflow `ALLOWED_COACH_EMAILS` env var is removed. Tests that relied on it are updated to use membership-based auth.
- The `BYPASS_AUTH` test mechanism in `getCurrentCoach()` is retained for test environments.

## Security and operations

- Auth boundary: Google OAuth (identity) → session (authentication) → membership (authorisation). Removing the allowlist removes one redundant authentication gate; authorisation via membership is unchanged.
- No session invalidation required. Existing JWT sessions remain valid for their 24h lifetime.
- `PREVIEW_ALLOWLIST_EMAILS` is retained for Vercel preview API route protection.
- Audit log entries referencing `no_session_or_allowlist` are updated to `no_session` since the allowlist check no longer exists.
- The `AuthenticationError` thrown by `requireCoachAccess()` when no session exists is unchanged. Membership-based `AuthorizationError` from `resolveOrganisationAccess()` is unchanged.

## Related records

- ADRs: ADR-0032 (authentication, session and authorisation baseline), ADR-0035 (multitenancy architecture and product decisions)
- Supersedes: ADR-0032 sections on email allowlist as auth gate and session revocation via allowlist removal

## Implementation evidence

- Pull requests: (to be added)
- Tests: (to be added)

## Supersedes

ADR-0032 (email allowlist sections only — session lifetime and error type decisions remain)

## Superseded by

None.

## History

### 2026-08-17

Record created. Replaces email allowlist auth gate with membership-based access.