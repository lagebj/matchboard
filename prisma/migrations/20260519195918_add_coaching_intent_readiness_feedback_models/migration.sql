-- CreateEnum
CREATE TYPE "CoachingIntentCategory" AS ENUM ('TEAM_FIRST', 'RESET_AFTER_ERROR', 'SUPPORT_TEAMMATES', 'POSITIONAL_DISCIPLINE', 'PLAY_THROUGH_TEAM', 'DEFENSIVE_RECOVERY', 'CONFIDENCE_REBUILD', 'CHALLENGE_EXPOSURE', 'STABILIZE_WEAKER_TEAM', 'PROTECT_MATCH_FUNCTION');

-- CreateEnum
CREATE TYPE "CoachingIntentScopeType" AS ENUM ('PLANNING_PERIOD', 'MATCH_ROUND', 'MATCH', 'TEAM', 'SELECTION');

-- CreateEnum
CREATE TYPE "MatchdayResponsibilityType" AS ENUM ('STABILIZER', 'CONNECTOR', 'RECOVERY_LEADER', 'WIDTH_HOLDER', 'CHALLENGE_PLAYER', 'CONFIDENCE_REBUILD_PLAYER');

-- CreateEnum
CREATE TYPE "ReadinessSignalType" AS ENUM ('EFFORT_TREND', 'ATTENDANCE_RELIABILITY', 'LEARNING_BEHAVIOR', 'TEAM_FIRST_BEHAVIOR', 'RESET_AFTER_ERROR_RELIABILITY', 'COACH_TRUST');

-- CreateEnum
CREATE TYPE "ReadinessSignalValue" AS ENUM ('RISING', 'STABLE', 'FALLING', 'HIGH', 'MEDIUM', 'LOW', 'STRONG', 'OK', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('EFFORT', 'TEAM_HELP', 'RESET_AFTER_MISTAKE', 'POSITIONAL_DISCIPLINE', 'TEAMMATE_INVOLVEMENT');

-- CreateEnum
CREATE TYPE "FeedbackNextAction" AS ENUM ('NO_ACTION', 'MONITOR', 'ADJUST_PLANNING', 'COACH_CONVERSATION');

-- AlterTable
ALTER TABLE "Selection" ADD COLUMN     "matchdayResponsibility" "MatchdayResponsibilityType";

-- AlterTable
ALTER TABLE "SelectionExplanation" ADD COLUMN     "coachingIntentCategory" "CoachingIntentCategory",
ADD COLUMN     "matchdayResponsibility" "MatchdayResponsibilityType";

-- CreateTable
CREATE TABLE "CoachingIntent" (
    "id" TEXT NOT NULL,
    "scopeType" "CoachingIntentScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "category" "CoachingIntentCategory" NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerReadinessSignal" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "signalType" "ReadinessSignalType" NOT NULL,
    "value" "ReadinessSignalValue" NOT NULL,
    "note" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerReadinessSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchExecutionFeedback" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "value" TEXT NOT NULL,
    "observableBehavior" TEXT,
    "nextAction" "FeedbackNextAction" NOT NULL DEFAULT 'NO_ACTION',
    "note" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchExecutionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamReflection" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "effort" TEXT,
    "teamCohesion" TEXT,
    "positionalShape" TEXT,
    "recoveryBehavior" TEXT,
    "note" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamReflection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachingIntent_scopeType_scopeId_idx" ON "CoachingIntent"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "CoachingIntent_category_idx" ON "CoachingIntent"("category");

-- CreateIndex
CREATE INDEX "PlayerReadinessSignal_playerId_idx" ON "PlayerReadinessSignal"("playerId");

-- CreateIndex
CREATE INDEX "PlayerReadinessSignal_signalType_idx" ON "PlayerReadinessSignal"("signalType");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerReadinessSignal_playerId_signalType_key" ON "PlayerReadinessSignal"("playerId", "signalType");

-- CreateIndex
CREATE INDEX "MatchExecutionFeedback_matchId_idx" ON "MatchExecutionFeedback"("matchId");

-- CreateIndex
CREATE INDEX "MatchExecutionFeedback_playerId_idx" ON "MatchExecutionFeedback"("playerId");

-- CreateIndex
CREATE INDEX "MatchExecutionFeedback_category_idx" ON "MatchExecutionFeedback"("category");

-- CreateIndex
CREATE UNIQUE INDEX "MatchExecutionFeedback_matchId_playerId_category_key" ON "MatchExecutionFeedback"("matchId", "playerId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "TeamReflection_matchId_key" ON "TeamReflection"("matchId");

-- AddForeignKey
ALTER TABLE "PlayerReadinessSignal" ADD CONSTRAINT "PlayerReadinessSignal_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchExecutionFeedback" ADD CONSTRAINT "MatchExecutionFeedback_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchExecutionFeedback" ADD CONSTRAINT "MatchExecutionFeedback_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamReflection" ADD CONSTRAINT "TeamReflection_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
