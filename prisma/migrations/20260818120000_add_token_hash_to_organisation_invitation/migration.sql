-- Add tokenHash column to OrganisationInvitation for hashed token lookup.
-- Tokens will be hashed with SHA-256 before storage. The existing plaintext
-- token column is retained during migration for backfill compatibility.

ALTER TABLE "OrganisationInvitation" ADD COLUMN "tokenHash" TEXT;

-- Backfill tokenHash from existing token values using SHA-256.
UPDATE "OrganisationInvitation" SET "tokenHash" = encode(sha256("token"::bytea), 'hex') WHERE "tokenHash" IS NULL;

-- Make tokenHash required and unique after backfill.
ALTER TABLE "OrganisationInvitation" ALTER COLUMN "tokenHash" SET NOT NULL;
CREATE UNIQUE INDEX "OrganisationInvitation_tokenHash_key" ON "OrganisationInvitation"("tokenHash");