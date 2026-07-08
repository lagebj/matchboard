-- Rename PK constraint from old PlanningPeriod_pkey to LeagueSeason_pkey
ALTER TABLE "LeagueSeason" RENAME CONSTRAINT "PlanningPeriod_pkey" TO "LeagueSeason_pkey";

-- Create index on LeagueSeason.seasonId (expected by Prisma schema)
CREATE INDEX "LeagueSeason_seasonId_idx" ON "LeagueSeason"("seasonId");