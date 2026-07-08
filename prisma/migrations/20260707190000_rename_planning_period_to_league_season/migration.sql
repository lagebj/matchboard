-- CreateEnum: LeagueSeasonPart
CREATE TYPE "LeagueSeasonPart" AS ENUM ('SPRING', 'FALL');

-- AlterTable: Season - add year column
ALTER TABLE "Season" ADD COLUMN "year" INTEGER;

-- Populate year from name (extract first 4-digit number from name)
UPDATE "Season" SET "year" = CAST(SUBSTRING("name" FROM '\d{4}') AS INTEGER) WHERE "name" ~ '\d{4}';
-- Fallback for names without a year
UPDATE "Season" SET "year" = 2026 WHERE "year" IS NULL;
ALTER TABLE "Season" ALTER COLUMN "year" SET NOT NULL;

-- RenameTable: PlanningPeriod -> LeagueSeason
ALTER TABLE "PlanningPeriod" RENAME TO "LeagueSeason";

-- RenameColumn: PlanningPeriod.planningPeriodId -> LeagueSeason.id kept, add part column
-- Add part column (nullable first for migration)
ALTER TABLE "LeagueSeason" ADD COLUMN "part" "LeagueSeasonPart";

-- Derive part from startDate: Jan-Jun = SPRING, Jul-Dec = FALL
UPDATE "LeagueSeason" SET "part" = 'SPRING' WHERE EXTRACT(MONTH FROM "startDate") <= 6;
UPDATE "LeagueSeason" SET "part" = 'FALL' WHERE EXTRACT(MONTH FROM "startDate") > 6;
-- Fallback for any remaining nulls
UPDATE "LeagueSeason" SET "part" = 'SPRING' WHERE "part" IS NULL;

ALTER TABLE "LeagueSeason" ALTER COLUMN "part" SET NOT NULL;

-- Rename FK column: MatchRound.planningPeriodId -> MatchRound.leagueSeasonId
ALTER TABLE "MatchRound" RENAME COLUMN "planningPeriodId" TO "leagueSeasonId";

-- Rename index: PlanningPeriod_pkey -> LeagueSeason_pkey (Prisma handles this, but let's be explicit)
-- The foreign key constraint on MatchRound will need updating
-- Drop old FK constraint and recreate
ALTER TABLE "MatchRound" DROP CONSTRAINT "MatchRound_planningPeriodId_fkey";
ALTER TABLE "MatchRound" ADD CONSTRAINT "MatchRound_leagueSeasonId_fkey" 
  FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old index if exists and create new one
DROP INDEX IF EXISTS "MatchRound_planningPeriodId_idx";
CREATE INDEX "MatchRound_leagueSeasonId_idx" ON "MatchRound"("leagueSeasonId");

-- Rename relation: Season.planningPeriods -> Season.leagueSeasons
-- This is a Prisma-level relation name change, no SQL needed
-- The FK constraint on LeagueSeason.seasonId references Season.id
-- Check if the old constraint name exists and rename it
ALTER TABLE "LeagueSeason" DROP CONSTRAINT IF EXISTS "PlanningPeriod_seasonId_fkey";
ALTER TABLE "LeagueSeason" ADD CONSTRAINT "LeagueSeason_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove Event.sourcePlanningPeriodId
ALTER TABLE "Event" DROP COLUMN IF EXISTS "sourcePlanningPeriodId";