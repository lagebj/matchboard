-- DropIndex
DROP INDEX "PostMatchReport_matchId_idx";

-- AlterTable
ALTER TABLE "PostMatchPlayerActual" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'PLANNED';

-- AlterTable
ALTER TABLE "PostMatchReport" ADD COLUMN     "awayGoals" INTEGER,
ADD COLUMN     "homeGoals" INTEGER;

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "playerId" TEXT,
    "minute" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Goal_reportId_idx" ON "Goal"("reportId");

-- CreateIndex
CREATE INDEX "Goal_playerId_idx" ON "Goal"("playerId");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "PostMatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
