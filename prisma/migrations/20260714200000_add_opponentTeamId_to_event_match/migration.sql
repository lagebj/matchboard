-- AlterTable: add opponentTeamId to EventMatch
ALTER TABLE "EventMatch" ADD COLUMN "opponentTeamId" TEXT;

-- CreateIndex
CREATE INDEX "EventMatch_opponentTeamId_idx" ON "EventMatch"("opponentTeamId");

-- AddForeignKey
ALTER TABLE "EventMatch" ADD CONSTRAINT "EventMatch_opponentTeamId_fkey" FOREIGN KEY ("opponentTeamId") REFERENCES "OpponentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;