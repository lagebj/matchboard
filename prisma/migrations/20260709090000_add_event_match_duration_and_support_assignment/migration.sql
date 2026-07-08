-- AlterTable
ALTER TABLE "Event" ADD COLUMN "matchDurationMinutes" INTEGER;

-- CreateTable
CREATE TABLE "EventMatchSupportAssignment" (
    "id" TEXT NOT NULL,
    "eventMatchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sourceEventSquadId" TEXT NOT NULL,
    "targetEventSquadId" TEXT NOT NULL,
    "plannedRole" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMatchSupportAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventMatchSupportAssignment_eventMatchId_playerId_key" ON "EventMatchSupportAssignment"("eventMatchId", "playerId");

-- CreateIndex
CREATE INDEX "EventMatchSupportAssignment_eventMatchId_idx" ON "EventMatchSupportAssignment"("eventMatchId");

-- CreateIndex
CREATE INDEX "EventMatchSupportAssignment_playerId_idx" ON "EventMatchSupportAssignment"("playerId");

-- CreateIndex
CREATE INDEX "EventMatchSupportAssignment_sourceEventSquadId_idx" ON "EventMatchSupportAssignment"("sourceEventSquadId");

-- CreateIndex
CREATE INDEX "EventMatchSupportAssignment_targetEventSquadId_idx" ON "EventMatchSupportAssignment"("targetEventSquadId");

-- AddForeignKey
ALTER TABLE "EventMatchSupportAssignment" ADD CONSTRAINT "EventMatchSupportAssignment_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMatchSupportAssignment" ADD CONSTRAINT "EventMatchSupportAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMatchSupportAssignment" ADD CONSTRAINT "EventMatchSupportAssignment_sourceEventSquadId_fkey" FOREIGN KEY ("sourceEventSquadId") REFERENCES "EventSquad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMatchSupportAssignment" ADD CONSTRAINT "EventMatchSupportAssignment_targetEventSquadId_fkey" FOREIGN KEY ("targetEventSquadId") REFERENCES "EventSquad"("id") ON DELETE CASCADE ON UPDATE CASCADE;