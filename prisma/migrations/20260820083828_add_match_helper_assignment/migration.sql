-- CreateTable
CREATE TABLE "MatchHelperAssignment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sourceTeamId" TEXT NOT NULL,
    "note" TEXT,
    "addedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchHelperAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchHelperAssignment_matchId_idx" ON "MatchHelperAssignment"("matchId");

-- CreateIndex
CREATE INDEX "MatchHelperAssignment_playerId_idx" ON "MatchHelperAssignment"("playerId");

-- CreateIndex
CREATE INDEX "MatchHelperAssignment_sourceTeamId_idx" ON "MatchHelperAssignment"("sourceTeamId");

-- CreateIndex
CREATE INDEX "MatchHelperAssignment_organisationId_idx" ON "MatchHelperAssignment"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchHelperAssignment_matchId_playerId_key" ON "MatchHelperAssignment"("matchId", "playerId");

-- AddForeignKey
ALTER TABLE "MatchHelperAssignment" ADD CONSTRAINT "MatchHelperAssignment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchHelperAssignment" ADD CONSTRAINT "MatchHelperAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchHelperAssignment" ADD CONSTRAINT "MatchHelperAssignment_sourceTeamId_fkey" FOREIGN KEY ("sourceTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchHelperAssignment" ADD CONSTRAINT "MatchHelperAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
