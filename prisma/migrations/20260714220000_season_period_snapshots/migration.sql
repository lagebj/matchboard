-- Create enum LeagueSeasonStatus
CREATE TYPE "LeagueSeasonStatus" AS ENUM ('OPEN', 'FINALIZED');

-- Add status, finalizedAt, finalizedBy to LeagueSeason
ALTER TABLE "LeagueSeason" ADD COLUMN "status" "LeagueSeasonStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "LeagueSeason" ADD COLUMN "finalizedAt" TIMESTAMP(3);
ALTER TABLE "LeagueSeason" ADD COLUMN "finalizedBy" TEXT;

-- Create SeasonPeriodSnapshot table
CREATE TABLE "SeasonPeriodSnapshot" (
    "id" TEXT NOT NULL,
    "leagueSeasonId" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL,
    "finalizedBy" TEXT,

    CONSTRAINT "SeasonPeriodSnapshot_pkey" PRIMARY KEY ("id")
);

-- Create TeamSeasonSnapshot table
CREATE TABLE "TeamSeasonSnapshot" (
    "id" TEXT NOT NULL,
    "seasonPeriodSnapshotId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamNameSnapshot" TEXT NOT NULL,

    CONSTRAINT "TeamSeasonSnapshot_pkey" PRIMARY KEY ("id")
);

-- Create TeamSeasonSnapshotPlayer table
CREATE TABLE "TeamSeasonSnapshotPlayer" (
    "id" TEXT NOT NULL,
    "teamSeasonSnapshotId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerNameSnapshot" TEXT NOT NULL,
    "primaryPositionSnapshot" TEXT,
    "secondaryPositionSnapshot" TEXT,
    "tertiaryPositionSnapshot" TEXT,
    "shirtNumberSnapshot" INTEGER,
    "activeAtSnapshot" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TeamSeasonSnapshotPlayer_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on SeasonPeriodSnapshot.leagueSeasonId
CREATE UNIQUE INDEX "SeasonPeriodSnapshot_leagueSeasonId_key" ON "SeasonPeriodSnapshot"("leagueSeasonId");

-- Indexes
CREATE INDEX "SeasonPeriodSnapshot_leagueSeasonId_idx" ON "SeasonPeriodSnapshot"("leagueSeasonId");
CREATE INDEX "TeamSeasonSnapshot_seasonPeriodSnapshotId_idx" ON "TeamSeasonSnapshot"("seasonPeriodSnapshotId");
CREATE INDEX "TeamSeasonSnapshot_teamId_idx" ON "TeamSeasonSnapshot"("teamId");
CREATE INDEX "TeamSeasonSnapshotPlayer_teamSeasonSnapshotId_idx" ON "TeamSeasonSnapshotPlayer"("teamSeasonSnapshotId");
CREATE INDEX "TeamSeasonSnapshotPlayer_playerId_idx" ON "TeamSeasonSnapshotPlayer"("playerId");

-- Foreign keys
ALTER TABLE "SeasonPeriodSnapshot" ADD CONSTRAINT "SeasonPeriodSnapshot_leagueSeasonId_fkey" FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamSeasonSnapshot" ADD CONSTRAINT "TeamSeasonSnapshot_seasonPeriodSnapshotId_fkey" FOREIGN KEY ("seasonPeriodSnapshotId") REFERENCES "SeasonPeriodSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamSeasonSnapshot" ADD CONSTRAINT "TeamSeasonSnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamSeasonSnapshotPlayer" ADD CONSTRAINT "TeamSeasonSnapshotPlayer_teamSeasonSnapshotId_fkey" FOREIGN KEY ("teamSeasonSnapshotId") REFERENCES "TeamSeasonSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamSeasonSnapshotPlayer" ADD CONSTRAINT "TeamSeasonSnapshotPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;