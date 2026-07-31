# Secret Rotation Procedures

## Overview

Matchboard secrets must be rotated periodically and after any suspected compromise. This document defines rotation procedures for each secret category.

## Secret Categories

| Category | Secrets | Rotation Frequency | Rotation Method |
|----------|---------|-------------------|-----------------|
| Auth | AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET | Annually or on compromise | Vercel environment variables |
| Database | DATABASE_URL, DIRECT_URL, PRODUCTION_DATABASE_URL | On Neon dashboard or on compromise | Neon connection string rotation |
| Test | TEST_DATABASE_URL | On compromise | Local .env update |
| App | NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_APP_NAME | Not a secret | Vercel environment variables |
| Machine tokens | HS256 symmetric key (AUTH_SECRET) | Annually | Vercel environment variables |

## AUTH_SECRET Rotation

1. Generate a new 32-byte random string: `openssl rand -base64 32`
2. Update `AUTH_SECRET` in Vercel environment variables (Production + Preview)
3. Deploy the change — all existing sessions will be invalidated
4. Users must re-authenticate
5. Machine principal tokens issued with the old key will fail verification — regenerate machine principal client credentials

## Google OAuth Rotation

1. Create new OAuth 2.0 Client ID and Secret in Google Cloud Console
2. Update `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in Vercel environment variables
3. Deploy the change
4. Revoke the old OAuth credentials in Google Cloud Console
5. Verify sign-in still works

## Database Credential Rotation

1. Create a new database user in Neon with the required roles (matchboard_app for DATABASE_URL, matchboard_admin for DIRECT_URL)
2. Update connection strings in Vercel environment variables
3. Deploy the change
4. Verify application connectivity
5. Revoke the old database user credentials in Neon

## Machine Principal Credential Rotation

1. Generate new client credentials using the machine principal management UI or API
2. Update any external services using the old credentials
3. Revoke the old client credentials through the management UI
4. Record rotation in audit log

## Emergency Rotation

If any secret is suspected to be compromised:

1. Immediately rotate the affected secret using the procedure above
2. Audit access logs for the compromised secret
3. Review any data access that may have occurred during the exposure window
4. Document the incident in the security incident log
5. Notify affected users if personal data may have been exposed

## Verification

After rotation, verify:

- Application starts without errors
- Authentication flows work (sign-in, sign-out)
- Database connectivity is maintained
- No secrets appear in logs, client-side bundles, or version control
- `npm run security:check-sql` passes
- `npm run security:check-supply-chain` passes