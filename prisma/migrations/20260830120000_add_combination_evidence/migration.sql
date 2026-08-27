-- Phase 3: Combination Topology and Evidence
-- Store derived combination evidence per match, derived from actual position intervals.
-- See ADR-0094 for combination evidence design rationale.

CREATE TABLE "CombinationEvidence" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "subtype" TEXT,
    "playerIds" JSONB NOT NULL,
    "positions" JSONB NOT NULL,
    "minutesTogether" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "goalsForWhilePresent" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainstWhilePresent" INTEGER NOT NULL DEFAULT 0,
    "directGoalContributions" INTEGER NOT NULL DEFAULT 0,
    "directAssistContributions" INTEGER NOT NULL DEFAULT 0,
    "opponentDiversity" INTEGER NOT NULL DEFAULT 1,
    "confidence" TEXT NOT NULL DEFAULT 'INSUFFICIENT',
    "approximateTiming" BOOLEAN NOT NULL DEFAULT false,
    "leagueSeasonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CombinationEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CombinationEvidence_matchId_family_idx" ON "CombinationEvidence"("matchId", "family");
CREATE INDEX "CombinationEvidence_matchId_playerIds_idx" ON "CombinationEvidence"("matchId", "playerIds");
CREATE INDEX "CombinationEvidence_leagueSeasonId_idx" ON "CombinationEvidence"("leagueSeasonId");
CREATE INDEX "CombinationEvidence_organisationId_idx" ON "CombinationEvidence"("organisationId");

ALTER TABLE "CombinationEvidence" ADD CONSTRAINT "CombinationEvidence_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CombinationEvidence" ADD CONSTRAINT "CombinationEvidence_leagueSeasonId_fkey" FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CombinationEvidence" ADD CONSTRAINT "CombinationEvidence_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;