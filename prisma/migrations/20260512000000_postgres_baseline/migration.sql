-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FootPreference" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "SecondaryFoot" AS ENUM ('LEFT', 'RIGHT', 'WEAK');

-- CreateEnum
CREATE TYPE "BestSide" AS ENUM ('LEFT', 'CENTER', 'RIGHT');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'INJURED', 'SICK', 'AWAY', 'TENTATIVE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "SelectionRole" AS ENUM ('CORE', 'SUPPORT', 'BACKFILL', 'DEVELOPMENT', 'CONFIDENCE_REBUILD', 'CORE_MATCH_DROP', 'REDUCED_MATCH_LOAD_DROP', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "OverrideReasonCategory" AS ENUM ('SQUAD_TOO_SMALL', 'SUPPORT_MISSING', 'DEVELOPMENT_OPPORTUNITY', 'DOUBLE_LOAD_NEEDED', 'AVAILABILITY_CHANGED', 'COACH_JUDGEMENT', 'MATCH_ALREADY_PLAYED', 'DATA_CORRECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "MatchVenue" AS ENUM ('HOME', 'AWAY');

-- CreateEnum
CREATE TYPE "MatchFit" AS ENUM ('UNKNOWN', 'TOO_EASY', 'GOOD_FIT', 'TOO_HARD', 'CHAOTIC', 'SUPPORT_OVERPOWERED', 'SUPPORT_TOO_LOW');

-- CreateEnum
CREATE TYPE "GameFormat" AS ENUM ('SEVEN_A_SIDE', 'NINE_A_SIDE', 'ELEVEN_A_SIDE');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('LEAGUE', 'FRIENDLY', 'CUP', 'DEVELOPMENT');

-- CreateEnum
CREATE TYPE "WarningSeverity" AS ENUM ('HARD_BLOCK', 'REQUIRES_OVERRIDE', 'WARNING', 'SCORING_PREFERENCE');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetSquadSize" INTEGER NOT NULL DEFAULT 11,
    "minAcceptedSquadSize" INTEGER NOT NULL DEFAULT 9,
    "maxSquadSize" INTEGER NOT NULL DEFAULT 14,
    "minCorePlayers" INTEGER NOT NULL DEFAULT 8,
    "minSupportCount" INTEGER NOT NULL DEFAULT 0,
    "targetSupportCount" INTEGER NOT NULL DEFAULT 0,
    "maxSupportCount" INTEGER NOT NULL DEFAULT 0,
    "maxPlayerChangesPerRound" INTEGER NOT NULL DEFAULT 0,
    "supportPriority" INTEGER NOT NULL DEFAULT 0,
    "minSupportPlayers" INTEGER NOT NULL DEFAULT 0,
    "developmentSlots" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "playerCode" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "removedAt" TIMESTAMP(3),
    "coreTeamId" TEXT NOT NULL,
    "nonRotatable" BOOLEAN NOT NULL DEFAULT false,
    "reducedMatchLoadAllowed" BOOLEAN NOT NULL DEFAULT false,
    "supportSuitability" TEXT NOT NULL DEFAULT 'neutral',
    "developmentReadiness" TEXT NOT NULL DEFAULT 'neutral',
    "primaryPosition" TEXT NOT NULL,
    "secondaryPosition" TEXT,
    "tertiaryPosition" TEXT,
    "preferredFoot" "FootPreference" NOT NULL,
    "secondaryFoot" "SecondaryFoot" NOT NULL,
    "bestSide" "BestSide" NOT NULL,
    "currentAvailability" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "supportNoShowCount" INTEGER NOT NULL DEFAULT 0,
    "ballControl" INTEGER NOT NULL DEFAULT 0,
    "passing" INTEGER NOT NULL DEFAULT 0,
    "firstTouch" INTEGER NOT NULL DEFAULT 0,
    "oneVOneAttacking" INTEGER NOT NULL DEFAULT 0,
    "positioning" INTEGER NOT NULL DEFAULT 0,
    "oneVOneDefending" INTEGER NOT NULL DEFAULT 0,
    "decisionMaking" INTEGER NOT NULL DEFAULT 0,
    "effort" INTEGER NOT NULL DEFAULT 0,
    "teamplay" INTEGER NOT NULL DEFAULT 0,
    "concentration" INTEGER NOT NULL DEFAULT 0,
    "speed" INTEGER NOT NULL DEFAULT 0,
    "strength" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "supportInstruction" TEXT,
    "developmentInstruction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "matchRoundId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "homeAway" "MatchVenue" NOT NULL,
    "squadSize" INTEGER NOT NULL DEFAULT 11,
    "availableForDevelopmentSlot" BOOLEAN NOT NULL DEFAULT false,
    "matchType" "MatchType" NOT NULL DEFAULT 'FRIENDLY',
    "gameFormat" "GameFormat" NOT NULL DEFAULT 'ELEVEN_A_SIDE',
    "formation" TEXT,
    "matchFit" "MatchFit" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleConfig" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Default ruleset',
    "minDaysBetweenAnyMatches" INTEGER NOT NULL DEFAULT 3,
    "warningThreshold" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRound" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planningPeriodId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchRoundId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Selection" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "matchRoundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" "SelectionRole" NOT NULL,
    "controlledDoubleLoad" BOOLEAN NOT NULL DEFAULT false,
    "status" "SelectionStatus" NOT NULL DEFAULT 'DRAFT',
    "ruleConfigVersion" INTEGER,
    "explanation" JSONB,
    "overrideReason" TEXT,
    "overrideReasonCategory" "OverrideReasonCategory",
    "overrideReasonDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationPath" (
    "id" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "role" "SelectionRole" NOT NULL,
    "purpose" TEXT NOT NULL,
    "minimumCount" INTEGER,
    "targetCount" INTEGER,
    "maximumCount" INTEGER,
    "cooldownRounds" INTEGER,
    "priority" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "allowDoubleLoad" BOOLEAN NOT NULL DEFAULT false,
    "minRestSpacingHours" INTEGER,
    "maxDoubleLoadsPerPeriod" INTEGER,

    CONSTRAINT "RotationPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementLedger" (
    "id" TEXT NOT NULL,
    "matchRoundId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "role" "SelectionRole" NOT NULL,
    "controlledDoubleLoad" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "explanation" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovementLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warning" (
    "id" TEXT NOT NULL,
    "matchRoundId" TEXT NOT NULL,
    "matchId" TEXT,
    "playerId" TEXT,
    "teamId" TEXT,
    "severity" "WarningSeverity" NOT NULL,
    "rule" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerLock" (
    "id" TEXT NOT NULL,
    "matchRoundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "lockType" TEXT NOT NULL,
    "reason" TEXT,
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionAudit" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "previousRole" TEXT,
    "previousStatus" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelectionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_archivedAt_name_idx" ON "Team"("archivedAt", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Player_playerCode_key" ON "Player"("playerCode");

-- CreateIndex
CREATE INDEX "Player_coreTeamId_active_removedAt_idx" ON "Player"("coreTeamId", "active", "removedAt");

-- CreateIndex
CREATE INDEX "Player_removedAt_firstName_lastName_idx" ON "Player"("removedAt", "firstName", "lastName");

-- CreateIndex
CREATE INDEX "Match_startsAt_createdAt_idx" ON "Match"("startsAt", "createdAt");

-- CreateIndex
CREATE INDEX "MovementLedger_matchRoundId_matchId_idx" ON "MovementLedger"("matchRoundId", "matchId");

-- CreateIndex
CREATE INDEX "MovementLedger_playerId_idx" ON "MovementLedger"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerLock_matchRoundId_playerId_key" ON "PlayerLock"("matchRoundId", "playerId");

-- CreateIndex
CREATE INDEX "SelectionAudit_selectionId_idx" ON "SelectionAudit"("selectionId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_coreTeamId_fkey" FOREIGN KEY ("coreTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningPeriod" ADD CONSTRAINT "PlanningPeriod_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRound" ADD CONSTRAINT "MatchRound_planningPeriodId_fkey" FOREIGN KEY ("planningPeriodId") REFERENCES "PlanningPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationPath" ADD CONSTRAINT "RotationPath_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationPath" ADD CONSTRAINT "RotationPath_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLedger" ADD CONSTRAINT "MovementLedger_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLedger" ADD CONSTRAINT "MovementLedger_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLedger" ADD CONSTRAINT "MovementLedger_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLedger" ADD CONSTRAINT "MovementLedger_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLedger" ADD CONSTRAINT "MovementLedger_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerLock" ADD CONSTRAINT "PlayerLock_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerLock" ADD CONSTRAINT "PlayerLock_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionAudit" ADD CONSTRAINT "SelectionAudit_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

