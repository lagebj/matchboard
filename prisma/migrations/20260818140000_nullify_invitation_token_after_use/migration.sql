-- Nullify plaintext invitation token after use (accept, decline, revoke).
-- Per ADR-0063 Step 7: the token column retains a unique index for lookup efficiency
-- during the PENDING state, but once the invitation is consumed, the plaintext token
-- is no longer needed and should be nullified to prevent token exposure from database
-- compromise. PostgreSQL unique indexes allow multiple NULL values.

-- Alter the token column to allow NULL
ALTER TABLE "OrganisationInvitation" ALTER COLUMN "token" DROP NOT NULL;

-- Nullify tokens for already-consumed invitations
UPDATE "OrganisationInvitation"
SET "token" = NULL
WHERE "status" IN ('ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');