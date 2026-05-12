-- AlterTable: Add reportId column to PostMatchPlayerActual
ALTER TABLE "PostMatchPlayerActual" ADD COLUMN "reportId" TEXT;

-- AlterTable: Add unique constraint to PostMatchReport.matchId
ALTER TABLE "PostMatchReport" ADD CONSTRAINT "PostMatchReport_matchId_key" UNIQUE ("matchId");

-- populate reportId from existing data
UPDATE "PostMatchPlayerActual" pmp
SET "reportId" = pmr.id
FROM "PostMatchReport" pmr
WHERE pmp."matchId" = pmr."matchId";

-- Drop old foreign key constraint and create new one
-- First, drop the old constraint
ALTER TABLE "PostMatchPlayerActual" DROP CONSTRAINT "PostMatchPlayerActual_matchId_fkey";

-- Add new foreign key constraint on reportId
ALTER TABLE "PostMatchPlayerActual" ADD CONSTRAINT "PostMatchPlayerActual_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "PostMatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Make reportId NOT NULL after populating
ALTER TABLE "PostMatchPlayerActual" ALTER COLUMN "reportId" SET NOT NULL;