-- CreateEnum
CREATE TYPE "FormationSource" AS ENUM ('SYSTEM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FormationSlotRoleType" AS ENUM ('GOALKEEPER', 'DEFENDER', 'DEFENSIVE_MIDFIELDER', 'MIDFIELDER', 'ATTACKING_MIDFIELDER', 'FORWARD', 'FREE');

-- CreateEnum
CREATE TYPE "MatchLineupStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MatchLineupAssignmentSource" AS ENUM ('MANUAL', 'SUGGESTED');

-- CreateEnum
CREATE TYPE "PlayerPositionPriority" AS ENUM ('PRIMARY', 'SECONDARY', 'CAN_PLAY');

-- AlterEnum
ALTER TYPE "GameFormat" ADD VALUE 'THREE_A_SIDE';
ALTER TYPE "GameFormat" ADD VALUE 'FIVE_A_SIDE';

-- CreateTable
CREATE TABLE "Formation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gameFormat" "GameFormat" NOT NULL,
    "source" "FormationSource" NOT NULL DEFAULT 'SYSTEM',
    "teamId" TEXT,
    "createdByUserId" TEXT,
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Formation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationSlot" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "roleType" "FormationSlotRoleType" NOT NULL,
    "acceptedPositionIds" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormationSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchLineup" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "formationId" TEXT,
    "status" "MatchLineupStatus" NOT NULL DEFAULT 'DRAFT',
    "formationSnapshot" JSONB,
    "benchPlayerIds" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchLineupAssignment" (
    "id" TEXT NOT NULL,
    "matchLineupId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "playerId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "source" "MatchLineupAssignmentSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchLineupAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerPosition" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "priority" "PlayerPositionPriority" NOT NULL DEFAULT 'PRIMARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Formation_gameFormat_idx" ON "Formation"("gameFormat");

-- CreateIndex
CREATE INDEX "Formation_teamId_idx" ON "Formation"("teamId");

-- CreateIndex
CREATE INDEX "Formation_source_isArchived_idx" ON "Formation"("source", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "FormationSlot_formationId_gridX_gridY_key" ON "FormationSlot"("formationId", "gridX", "gridY");

-- CreateIndex
CREATE INDEX "FormationSlot_formationId_idx" ON "FormationSlot"("formationId");

-- CreateIndex
CREATE INDEX "FormationSlot_formationId_sortOrder_idx" ON "FormationSlot"("formationId", "sortOrder");

-- CreateIndex
CREATE INDEX "MatchLineup_matchId_idx" ON "MatchLineup"("matchId");

-- CreateIndex
CREATE INDEX "MatchLineup_teamId_idx" ON "MatchLineup"("teamId");

-- CreateIndex
CREATE INDEX "MatchLineup_status_idx" ON "MatchLineup"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MatchLineupAssignment_matchLineupId_slotId_key" ON "MatchLineupAssignment"("matchLineupId", "slotId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchLineupAssignment_matchLineupId_playerId_key" ON "MatchLineupAssignment"("matchLineupId", "playerId");

-- CreateIndex
CREATE INDEX "MatchLineupAssignment_matchLineupId_idx" ON "MatchLineupAssignment"("matchLineupId");

-- CreateIndex
CREATE INDEX "MatchLineupAssignment_playerId_idx" ON "MatchLineupAssignment"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerPosition_playerId_positionId_key" ON "PlayerPosition"("playerId", "positionId");

-- CreateIndex
CREATE INDEX "PlayerPosition_playerId_idx" ON "PlayerPosition"("playerId");

-- CreateIndex
CREATE INDEX "PlayerPosition_positionId_idx" ON "PlayerPosition"("positionId");

-- AddForeignKey
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationSlot" ADD CONSTRAINT "FormationSlot_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupAssignment" ADD CONSTRAINT "MatchLineupAssignment_matchLineupId_fkey" FOREIGN KEY ("matchLineupId") REFERENCES "MatchLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPosition" ADD CONSTRAINT "PlayerPosition_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;