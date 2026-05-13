/*
  Warnings:

  - The `status` column on the `PostMatchReport` table is being migrated from free-text to enum.
    Existing 'IN_PROGRESS' → 'DRAFT', 'COMPLETED' → 'LOCKED'.

*/

-- Migrate existing PostMatchReport status values before changing column type
UPDATE "PostMatchReport" SET "status" = 'DRAFT' WHERE "status" = 'IN_PROGRESS';
UPDATE "PostMatchReport" SET "status" = 'LOCKED' WHERE "status" = 'COMPLETED';

-- CreateEnum
CREATE TYPE "MatchReportStatus" AS ENUM ('DRAFT', 'REPORTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "PlannedAbsenceReason" AS ENUM ('NO_SHOW', 'SICK', 'INJURED', 'DECLINED', 'NO_RSVP', 'OTHER');

-- AlterTable
ALTER TABLE "PostMatchPlayerActual" ALTER COLUMN "attendanceStatus" SET DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "PostMatchReport" DROP COLUMN "status",
ADD COLUMN     "status" "MatchReportStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "MatchReportAbsence" (
    "id" TEXT NOT NULL,
    "matchReportId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "reason" "PlannedAbsenceReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchReportAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchReportPlayerStat" (
    "id" TEXT NOT NULL,
    "matchReportId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchReportPlayerStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchReportAbsence_matchId_idx" ON "MatchReportAbsence"("matchId");

-- CreateIndex
CREATE INDEX "MatchReportAbsence_playerId_idx" ON "MatchReportAbsence"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchReportAbsence_matchReportId_playerId_key" ON "MatchReportAbsence"("matchReportId", "playerId");

-- CreateIndex
CREATE INDEX "MatchReportPlayerStat_playerId_idx" ON "MatchReportPlayerStat"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchReportPlayerStat_matchReportId_playerId_key" ON "MatchReportPlayerStat"("matchReportId", "playerId");

-- CreateIndex
CREATE INDEX "PostMatchReport_status_idx" ON "PostMatchReport"("status");

-- AddForeignKey
ALTER TABLE "MatchReportAbsence" ADD CONSTRAINT "MatchReportAbsence_matchReportId_fkey" FOREIGN KEY ("matchReportId") REFERENCES "PostMatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchReportAbsence" ADD CONSTRAINT "MatchReportAbsence_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchReportPlayerStat" ADD CONSTRAINT "MatchReportPlayerStat_matchReportId_fkey" FOREIGN KEY ("matchReportId") REFERENCES "PostMatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchReportPlayerStat" ADD CONSTRAINT "MatchReportPlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
