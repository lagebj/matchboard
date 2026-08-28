-- ADR-0104: generalize evidence-adjacent models to accept an Event match source,
-- alongside the existing League Match source, via a nullable dual-FK pattern.

-- AlterTable
ALTER TABLE "ActualPositionInterval" ADD COLUMN     "eventMatchId" TEXT,
ALTER COLUMN "matchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CombinationEvidence" ADD COLUMN     "eventMatchId" TEXT,
ALTER COLUMN "matchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OpponentSportingEvidence" ADD COLUMN     "eventMatchId" TEXT,
ALTER COLUMN "matchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlayerDevelopmentObservation" ADD COLUMN     "eventMatchId" TEXT,
ALTER COLUMN "matchId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ActualPositionInterval_eventMatchId_playerId_idx" ON "ActualPositionInterval"("eventMatchId", "playerId");

-- CreateIndex
CREATE INDEX "ActualPositionInterval_eventMatchId_startedAtMs_idx" ON "ActualPositionInterval"("eventMatchId", "startedAtMs");

-- CreateIndex
CREATE INDEX "CombinationEvidence_eventMatchId_family_idx" ON "CombinationEvidence"("eventMatchId", "family");

-- CreateIndex
CREATE INDEX "CombinationEvidence_eventMatchId_playerIds_idx" ON "CombinationEvidence"("eventMatchId", "playerIds");

-- CreateIndex
CREATE UNIQUE INDEX "OpponentSportingEvidence_eventMatchId_key" ON "OpponentSportingEvidence"("eventMatchId");

-- CreateIndex
CREATE INDEX "PlayerDevelopmentObservation_eventMatchId_idx" ON "PlayerDevelopmentObservation"("eventMatchId");

-- AddForeignKey
ALTER TABLE "ActualPositionInterval" ADD CONSTRAINT "ActualPositionInterval_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombinationEvidence" ADD CONSTRAINT "CombinationEvidence_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentSportingEvidence" ADD CONSTRAINT "OpponentSportingEvidence_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDevelopmentObservation" ADD CONSTRAINT "PlayerDevelopmentObservation_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-added: Prisma's schema DSL cannot express "exactly one of two nullable FKs is
-- set", so these CHECK constraints are added by hand to the generated diff, following
-- the existing repo convention for constraints Prisma can't generate
-- (see 20260729120000_add_critical_unique_constraints/migration.sql).
ALTER TABLE "ActualPositionInterval" ADD CONSTRAINT "ActualPositionInterval_exactly_one_match_source" CHECK (("matchId" IS NOT NULL) != ("eventMatchId" IS NOT NULL));

ALTER TABLE "CombinationEvidence" ADD CONSTRAINT "CombinationEvidence_exactly_one_match_source" CHECK (("matchId" IS NOT NULL) != ("eventMatchId" IS NOT NULL));

ALTER TABLE "OpponentSportingEvidence" ADD CONSTRAINT "OpponentSportingEvidence_exactly_one_match_source" CHECK (("matchId" IS NOT NULL) != ("eventMatchId" IS NOT NULL));

ALTER TABLE "PlayerDevelopmentObservation" ADD CONSTRAINT "PlayerDevelopmentObservation_exactly_one_match_source" CHECK (("matchId" IS NOT NULL) != ("eventMatchId" IS NOT NULL));
