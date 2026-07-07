-- CreateEnum
CREATE TYPE "GoalkeeperAbility" AS ENUM ('NO', 'EMERGENCY', 'YES');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CUP', 'TOURNAMENT', 'FRIENDLY_DAY', 'OTHER');

-- CreateEnum
CREATE TYPE "EventPlayerStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN', 'RESERVE', 'LATE_ADDITION', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EventSquadIntent" AS ENUM ('COMPETITIVE', 'BALANCED', 'MANUAL');

-- CreateEnum
CREATE TYPE "EventSelectionPattern" AS ENUM ('ALL_BALANCED', 'ONE_COMPETITIVE_BALANCED_REMAINDER', 'MANUAL_SEED_AUTO_BALANCE');

-- CreateEnum
CREATE TYPE "EventSquadPlayerSource" AS ENUM ('AUTO', 'MANUAL', 'LOCKED');

-- DropForeignKey
ALTER TABLE "MatchLineup" DROP CONSTRAINT "MatchLineup_teamId_fkey";

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "goalkeeperAbility" "GoalkeeperAbility" NOT NULL DEFAULT 'NO',
ADD COLUMN     "lastRatedAt" TIMESTAMP(3),
ALTER COLUMN "ballControl" DROP NOT NULL,
ALTER COLUMN "ballControl" DROP DEFAULT,
ALTER COLUMN "passing" DROP NOT NULL,
ALTER COLUMN "passing" DROP DEFAULT,
ALTER COLUMN "firstTouch" DROP NOT NULL,
ALTER COLUMN "firstTouch" DROP DEFAULT,
ALTER COLUMN "oneVOneAttacking" DROP NOT NULL,
ALTER COLUMN "oneVOneAttacking" DROP DEFAULT,
ALTER COLUMN "positioning" DROP NOT NULL,
ALTER COLUMN "positioning" DROP DEFAULT,
ALTER COLUMN "oneVOneDefending" DROP NOT NULL,
ALTER COLUMN "oneVOneDefending" DROP DEFAULT,
ALTER COLUMN "decisionMaking" DROP NOT NULL,
ALTER COLUMN "decisionMaking" DROP DEFAULT,
ALTER COLUMN "effort" DROP NOT NULL,
ALTER COLUMN "effort" DROP DEFAULT,
ALTER COLUMN "teamplay" DROP NOT NULL,
ALTER COLUMN "teamplay" DROP DEFAULT,
ALTER COLUMN "concentration" DROP NOT NULL,
ALTER COLUMN "concentration" DROP DEFAULT,
ALTER COLUMN "speed" DROP NOT NULL,
ALTER COLUMN "speed" DROP DEFAULT,
ALTER COLUMN "strength" DROP NOT NULL,
ALTER COLUMN "strength" DROP DEFAULT;

-- Migrate existing 0 values to NULL (0 meant "not rated")
UPDATE "Player" SET
  "ballControl" = CASE WHEN "ballControl" = 0 THEN NULL ELSE "ballControl" END,
  "passing" = CASE WHEN "passing" = 0 THEN NULL ELSE "passing" END,
  "firstTouch" = CASE WHEN "firstTouch" = 0 THEN NULL ELSE "firstTouch" END,
  "oneVOneAttacking" = CASE WHEN "oneVOneAttacking" = 0 THEN NULL ELSE "oneVOneAttacking" END,
  "positioning" = CASE WHEN "positioning" = 0 THEN NULL ELSE "positioning" END,
  "oneVOneDefending" = CASE WHEN "oneVOneDefending" = 0 THEN NULL ELSE "oneVOneDefending" END,
  "decisionMaking" = CASE WHEN "decisionMaking" = 0 THEN NULL ELSE "decisionMaking" END,
  "effort" = CASE WHEN "effort" = 0 THEN NULL ELSE "effort" END,
  "teamplay" = CASE WHEN "teamplay" = 0 THEN NULL ELSE "teamplay" END,
  "concentration" = CASE WHEN "concentration" = 0 THEN NULL ELSE "concentration" END,
  "speed" = CASE WHEN "speed" = 0 THEN NULL ELSE "speed" END,
  "strength" = CASE WHEN "strength" = 0 THEN NULL ELSE "strength" END;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL DEFAULT 'CUP',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "gameFormat" "GameFormat" NOT NULL,
    "sourcePlanningPeriodId" TEXT,
    "defaultFormationId" TEXT,
    "selectionPattern" "EventSelectionPattern",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPlayerAvailability" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "EventPlayerStatus" NOT NULL DEFAULT 'UNKNOWN',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPlayerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSquad" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intent" "EventSquadIntent" NOT NULL,
    "targetSize" INTEGER NOT NULL,
    "minSize" INTEGER,
    "maxSize" INTEGER,
    "formationId" TEXT,
    "generationOrder" INTEGER NOT NULL DEFAULT 0,
    "generationSnapshot" JSONB,
    "balanceSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSquad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSquadPlayer" (
    "id" TEXT NOT NULL,
    "eventSquadId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "assignedRoleType" "FormationSlotRoleType",
    "assignedPositionId" TEXT,
    "source" "EventSquadPlayerSource" NOT NULL DEFAULT 'AUTO',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "selectionReason" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSquadPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE INDEX "EventPlayerAvailability_eventId_status_idx" ON "EventPlayerAvailability"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventPlayerAvailability_playerId_idx" ON "EventPlayerAvailability"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "EventPlayerAvailability_eventId_playerId_key" ON "EventPlayerAvailability"("eventId", "playerId");

-- CreateIndex
CREATE INDEX "EventSquad_eventId_idx" ON "EventSquad"("eventId");

-- CreateIndex
CREATE INDEX "EventSquad_intent_idx" ON "EventSquad"("intent");

-- CreateIndex
CREATE INDEX "EventSquadPlayer_playerId_idx" ON "EventSquadPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "EventSquadPlayer_eventSquadId_playerId_key" ON "EventSquadPlayer"("eventSquadId", "playerId");

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPlayerAvailability" ADD CONSTRAINT "EventPlayerAvailability_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPlayerAvailability" ADD CONSTRAINT "EventPlayerAvailability_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSquad" ADD CONSTRAINT "EventSquad_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSquad" ADD CONSTRAINT "EventSquad_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSquadPlayer" ADD CONSTRAINT "EventSquadPlayer_eventSquadId_fkey" FOREIGN KEY ("eventSquadId") REFERENCES "EventSquad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSquadPlayer" ADD CONSTRAINT "EventSquadPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
