-- CreateEnum
CREATE TYPE "MatchFormatSnapshotSource" AS ENUM ('SEASON', 'TEAM', 'MATCH', 'EVENT');

-- AlterTable
ALTER TABLE "LiveMatchSession" ADD COLUMN     "formatBreakDurationMinutes" INTEGER,
ADD COLUMN     "formatNumberOfPeriods" INTEGER,
ADD COLUMN     "formatPeriodDurationMinutes" INTEGER,
ADD COLUMN     "formatSnapshotAt" TIMESTAMP(3),
ADD COLUMN     "formatSource" "MatchFormatSnapshotSource";

-- AlterTable
ALTER TABLE "EventLiveMatchSession" ADD COLUMN     "formatBreakDurationMinutes" INTEGER,
ADD COLUMN     "formatNumberOfPeriods" INTEGER,
ADD COLUMN     "formatPeriodDurationMinutes" INTEGER,
ADD COLUMN     "formatSnapshotAt" TIMESTAMP(3),
ADD COLUMN     "formatSource" "MatchFormatSnapshotSource";

