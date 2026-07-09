-- Enum: EventMatchLineupPlayerSource (new)
CREATE TYPE "EventMatchLineupPlayerSource" AS ENUM ('BASE_SQUAD', 'HELPER');

-- CreateTable
CREATE TABLE "EventMatchLineup" (
    "id" TEXT NOT NULL,
    "eventMatchId" TEXT NOT NULL,
    "formationId" TEXT,
    "status" "MatchLineupStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMatchLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMatchLineupAssignment" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "playerId" TEXT,
    "slotId" TEXT,
    "slotIndex" INTEGER,
    "slotLabel" TEXT,
    "roleType" "FormationSlotRoleType",
    "source" "EventMatchLineupPlayerSource" NOT NULL DEFAULT 'BASE_SQUAD',
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMatchLineupAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventMatchLineup_eventMatchId_key" ON "EventMatchLineup"("eventMatchId");

-- CreateIndex
CREATE INDEX "EventMatchLineup_status_idx" ON "EventMatchLineup"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventMatchLineupAssignment_lineupId_playerId_key" ON "EventMatchLineupAssignment"("lineupId", "playerId");

-- CreateIndex
CREATE INDEX "EventMatchLineupAssignment_lineupId_idx" ON "EventMatchLineupAssignment"("lineupId");

-- CreateIndex
CREATE INDEX "EventMatchLineupAssignment_playerId_idx" ON "EventMatchLineupAssignment"("playerId");

-- AddForeignKey
ALTER TABLE "EventMatchLineup" ADD CONSTRAINT "EventMatchLineup_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMatchLineup" ADD CONSTRAINT "EventMatchLineup_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMatchLineupAssignment" ADD CONSTRAINT "EventMatchLineupAssignment_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "EventMatchLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMatchLineupAssignment" ADD CONSTRAINT "EventMatchLineupAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;