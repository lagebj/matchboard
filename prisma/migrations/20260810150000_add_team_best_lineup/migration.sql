-- CreateTable
CREATE TABLE "TeamBestLineup" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "formationId" TEXT,
    "formationSnapshot" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamBestLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamBestLineupAssignment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "bestLineupId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "playerId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamBestLineupAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamBestLineup_teamId_key" ON "TeamBestLineup"("teamId");

-- CreateIndex
CREATE INDEX "TeamBestLineup_teamId_idx" ON "TeamBestLineup"("teamId");

-- CreateIndex
CREATE INDEX "TeamBestLineup_organisationId_idx" ON "TeamBestLineup"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamBestLineupAssignment_bestLineupId_slotId_key" ON "TeamBestLineupAssignment"("bestLineupId", "slotId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamBestLineupAssignment_bestLineupId_playerId_key" ON "TeamBestLineupAssignment"("bestLineupId", "playerId");

-- CreateIndex
CREATE INDEX "TeamBestLineupAssignment_bestLineupId_idx" ON "TeamBestLineupAssignment"("bestLineupId");

-- CreateIndex
CREATE INDEX "TeamBestLineupAssignment_playerId_idx" ON "TeamBestLineupAssignment"("playerId");

-- CreateIndex
CREATE INDEX "TeamBestLineupAssignment_organisationId_idx" ON "TeamBestLineupAssignment"("organisationId");

-- AddForeignKey
ALTER TABLE "TeamBestLineup" ADD CONSTRAINT "TeamBestLineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBestLineup" ADD CONSTRAINT "TeamBestLineup_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBestLineup" ADD CONSTRAINT "TeamBestLineup_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBestLineupAssignment" ADD CONSTRAINT "TeamBestLineupAssignment_bestLineupId_fkey" FOREIGN KEY ("bestLineupId") REFERENCES "TeamBestLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBestLineupAssignment" ADD CONSTRAINT "TeamBestLineupAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBestLineupAssignment" ADD CONSTRAINT "TeamBestLineupAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;