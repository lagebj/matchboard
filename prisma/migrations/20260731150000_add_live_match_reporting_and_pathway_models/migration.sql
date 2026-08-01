-- CreateEnum: LiveSessionStatus
CREATE TYPE "LiveSessionStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum: LiveMatchEventType
CREATE TYPE "LiveMatchEventType" AS ENUM ('MATCH_START', 'PERIOD_START', 'PERIOD_END', 'MATCH_END', 'GOAL_FOR', 'GOAL_AGAINST', 'SCORER_SET', 'ASSIST_SET', 'ROTATION_OUT', 'ROTATION_IN', 'POSITIONS_CHANGED', 'FAIR_PLAY_POSITIVE', 'FAIR_PLAY_CONCERN', 'MOMENT_MARKED', 'CLOCK_ADJUSTMENT', 'EVENT_CORRECTED', 'EVENT_REVERSED');

-- CreateEnum: LiveEventCorrectionType
CREATE TYPE "LiveEventCorrectionType" AS ENUM ('CORRECTION', 'REVERSAL');

-- CreateEnum: MatchPeriod
CREATE TYPE "MatchPeriod" AS ENUM ('BEFORE', 'FIRST_HALF', 'HALF_TIME', 'SECOND_HALF', 'EXTRA_FIRST_HALF', 'EXTRA_HALF_TIME', 'EXTRA_SECOND_HALF', 'FULL_TIME');

-- CreateEnum: FairPlayCategory
CREATE TYPE "FairPlayCategory" AS ENUM ('HELPED_OPPONENT', 'CHECKED_ON_INJURED_PLAYER', 'ACCEPTED_REFEREE_DECISION', 'ENCOURAGED_TEAMMATE', 'CALMED_DIFFICULT_SITUATION', 'OTHER_POSITIVE', 'RETALIATION', 'ABUSIVE_LANGUAGE', 'DISSENT_TOWARD_REFEREE', 'TAUNTING_OR_PROVOKING', 'DISRESPECT_TOWARD_TEAMMATE', 'OTHER_CONCERN');

-- CreateEnum: FairPlayObservationSource
CREATE TYPE "FairPlayObservationSource" AS ENUM ('LIVE', 'MANUAL');

-- CreateEnum: FairPlayObservationStatus
CREATE TYPE "FairPlayObservationStatus" AS ENUM ('PROVISIONAL', 'CONFIRMED', 'DISMISSED');

-- CreateEnum: RotationSource
CREATE TYPE "RotationSource" AS ENUM ('LIVE', 'MANUAL');

-- CreateTable: LiveMatchSession
CREATE TABLE "LiveMatchSession" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "matchId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT E'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveMatchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LiveMatchEvent
CREATE TABLE "LiveMatchEvent" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "matchId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" "LiveMatchEventType" NOT NULL,
    "period" INTEGER,
    "matchSeconds" INTEGER,
    "wallClockTime" TIMESTAMP(3),
    "playerId" TEXT,
    "secondaryPlayerId" TEXT,
    "payload" JSONB,
    "correctionType" "LiveEventCorrectionType",
    "correctsEventId" TEXT,
    "clientEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveMatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MatchRotation
CREATE TABLE "MatchRotation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "matchId" TEXT NOT NULL,
    "outPlayerId" TEXT NOT NULL,
    "inPlayerId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "matchSeconds" INTEGER,
    "outPosition" TEXT,
    "inPosition" TEXT,
    "positionOnly" BOOLEAN NOT NULL DEFAULT false,
    "source" "RotationSource" NOT NULL DEFAULT E'LIVE',
    "liveEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchRotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FairPlayObservation
CREATE TABLE "FairPlayObservation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "matchId" TEXT NOT NULL,
    "period" INTEGER,
    "matchSeconds" INTEGER,
    "playerId" TEXT,
    "category" "FairPlayCategory" NOT NULL,
    "note" TEXT,
    "source" "FairPlayObservationSource" NOT NULL DEFAULT E'LIVE',
    "status" "FairPlayObservationStatus" NOT NULL DEFAULT E'PROVISIONAL',
    "liveEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FairPlayObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: LiveMatchSession unique constraint on matchId
CREATE UNIQUE INDEX "LiveMatchSession_matchId_key" ON "LiveMatchSession"("matchId");

-- CreateIndex: LiveMatchSession
CREATE INDEX "LiveMatchSession_organisationId_idx" ON "LiveMatchSession"("organisationId");
CREATE INDEX "LiveMatchSession_coachId_idx" ON "LiveMatchSession"("coachId");
CREATE INDEX "LiveMatchSession_status_idx" ON "LiveMatchSession"("status");

-- CreateIndex: LiveMatchEvent unique constraint on clientEventId
CREATE UNIQUE INDEX "LiveMatchEvent_clientEventId_key" ON "LiveMatchEvent"("clientEventId");

-- CreateIndex: LiveMatchEvent
CREATE INDEX "LiveMatchEvent_matchId_createdAt_idx" ON "LiveMatchEvent"("matchId", "createdAt");
CREATE INDEX "LiveMatchEvent_matchId_period_idx" ON "LiveMatchEvent"("matchId", "period");
CREATE INDEX "LiveMatchEvent_sessionId_idx" ON "LiveMatchEvent"("sessionId");
CREATE INDEX "LiveMatchEvent_playerId_idx" ON "LiveMatchEvent"("playerId");
CREATE INDEX "LiveMatchEvent_organisationId_idx" ON "LiveMatchEvent"("organisationId");

-- CreateIndex: MatchRotation
CREATE INDEX "MatchRotation_matchId_period_idx" ON "MatchRotation"("matchId", "period");
CREATE INDEX "MatchRotation_outPlayerId_idx" ON "MatchRotation"("outPlayerId");
CREATE INDEX "MatchRotation_inPlayerId_idx" ON "MatchRotation"("inPlayerId");
CREATE INDEX "MatchRotation_organisationId_idx" ON "MatchRotation"("organisationId");

-- CreateIndex: FairPlayObservation
CREATE INDEX "FairPlayObservation_matchId_createdAt_idx" ON "FairPlayObservation"("matchId", "createdAt");
CREATE INDEX "FairPlayObservation_playerId_idx" ON "FairPlayObservation"("playerId");
CREATE INDEX "FairPlayObservation_status_idx" ON "FairPlayObservation"("status");
CREATE INDEX "FairPlayObservation_organisationId_idx" ON "FairPlayObservation"("organisationId");

-- AddForeignKey: LiveMatchSession -> Match
ALTER TABLE "LiveMatchSession" ADD CONSTRAINT "LiveMatchSession_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LiveMatchSession -> Organisation
ALTER TABLE "LiveMatchSession" ADD CONSTRAINT "LiveMatchSession_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LiveMatchEvent -> Match
ALTER TABLE "LiveMatchEvent" ADD CONSTRAINT "LiveMatchEvent_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LiveMatchEvent -> LiveMatchSession
ALTER TABLE "LiveMatchEvent" ADD CONSTRAINT "LiveMatchEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveMatchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LiveMatchEvent -> Player (scorer)
ALTER TABLE "LiveMatchEvent" ADD CONSTRAINT "LiveMatchEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: LiveMatchEvent -> Player (secondary)
ALTER TABLE "LiveMatchEvent" ADD CONSTRAINT "LiveMatchEvent_secondaryPlayerId_fkey" FOREIGN KEY ("secondaryPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: LiveMatchEvent -> Organisation
ALTER TABLE "LiveMatchEvent" ADD CONSTRAINT "LiveMatchEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: MatchRotation -> Match
ALTER TABLE "MatchRotation" ADD CONSTRAINT "MatchRotation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: MatchRotation -> Player (out)
ALTER TABLE "MatchRotation" ADD CONSTRAINT "MatchRotation_outPlayerId_fkey" FOREIGN KEY ("outPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: MatchRotation -> Player (in)
ALTER TABLE "MatchRotation" ADD CONSTRAINT "MatchRotation_inPlayerId_fkey" FOREIGN KEY ("inPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: MatchRotation -> Organisation
ALTER TABLE "MatchRotation" ADD CONSTRAINT "MatchRotation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: FairPlayObservation -> Match
ALTER TABLE "FairPlayObservation" ADD CONSTRAINT "FairPlayObservation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: FairPlayObservation -> Player
ALTER TABLE "FairPlayObservation" ADD CONSTRAINT "FairPlayObservation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: FairPlayObservation -> Organisation
ALTER TABLE "FairPlayObservation" ADD CONSTRAINT "FairPlayObservation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;