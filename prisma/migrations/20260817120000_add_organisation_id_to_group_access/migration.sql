-- Add organisationId column to GroupAccess for tenant isolation.
-- This column is denormalised from FootballGroup.organisationId and enables
-- deterministic where-clause injection by the Prisma tenantRLS extension.

-- Step 1: Add nullable column
ALTER TABLE "GroupAccess" ADD COLUMN "organisationId" TEXT;

-- Step 2: Backfill from FootballGroup via join
UPDATE "GroupAccess" ga
SET "organisationId" = fg."organisationId"
FROM "FootballGroup" fg
WHERE ga."footballGroupId" = fg."id";

-- Step 3: Make column NOT NULL
ALTER TABLE "GroupAccess" ALTER COLUMN "organisationId" SET NOT NULL;

-- Step 4: Add index
CREATE INDEX "GroupAccess_organisationId_idx" ON "GroupAccess"("organisationId");

-- Step 5: Add foreign key constraint
ALTER TABLE "GroupAccess"
  ADD CONSTRAINT "GroupAccess_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;