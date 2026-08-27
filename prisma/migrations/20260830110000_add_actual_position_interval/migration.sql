-- Phase 2: Canonical Actual Position Timeline
-- Store derived actual position intervals for each player in a match.
-- These are computed from starting lineup + substitutions + position swaps + corrections.
-- See ADR-0096 for design rationale.

CREATE TABLE "ActualPositionInterval" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "startedAtMs" INTEGER NOT NULL,
    "endedAtMs" INTEGER,
    "source" TEXT NOT NULL,
    "approximateTiming" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActualPositionInterval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActualPositionInterval_matchId_playerId_idx" ON "ActualPositionInterval"("matchId", "playerId");
CREATE INDEX "ActualPositionInterval_matchId_startedAtMs_idx" ON "ActualPositionInterval"("matchId", "startedAtMs");
CREATE INDEX "ActualPositionInterval_organisationId_idx" ON "ActualPositionInterval"("organisationId");

ALTER TABLE "ActualPositionInterval" ADD CONSTRAINT "ActualPositionInterval_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActualPositionInterval" ADD CONSTRAINT "ActualPositionInterval_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActualPositionInterval" ADD CONSTRAINT "ActualPositionInterval_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create enum type for ActualIntervalSource
CREATE TYPE "ActualIntervalSource" AS ENUM ('STARTING_LINEUP', 'SUBSTITUTION', 'POSITION_SWAP', 'POST_MATCH_CORRECTION', 'LIVE_RECORDED');

ALTER TABLE "ActualPositionInterval" ALTER COLUMN "source" TYPE "ActualIntervalSource" USING "source"::"ActualIntervalSource";