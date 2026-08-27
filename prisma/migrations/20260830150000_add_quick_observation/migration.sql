-- Phase 8: quick observation capture-first/classify-later inbox.
-- See DECISIONS.md "Quick observations" and ADR for full rationale.

CREATE TYPE "QuickObservationStatus" AS ENUM ('OPEN', 'CONVERTED', 'KEPT_AS_NOTE', 'DISCARDED');
CREATE TYPE "QuickObservationConversionType" AS ENUM ('DEVELOPMENT_THREAD', 'TEAM_REFLECTION', 'OPPONENT_OBSERVATION');

CREATE TABLE "QuickObservation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "matchId" TEXT,
    "playerIds" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT NOT NULL,
    "status" "QuickObservationStatus" NOT NULL DEFAULT 'OPEN',
    "convertedToType" "QuickObservationConversionType",
    "convertedToId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuickObservation_matchId_idx" ON "QuickObservation"("matchId");
CREATE INDEX "QuickObservation_organisationId_idx" ON "QuickObservation"("organisationId");
CREATE INDEX "QuickObservation_status_idx" ON "QuickObservation"("status");

ALTER TABLE "QuickObservation" ADD CONSTRAINT "QuickObservation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuickObservation" ADD CONSTRAINT "QuickObservation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
