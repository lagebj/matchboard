-- AlterTable
ALTER TABLE "OpponentSportingEvidence" ADD COLUMN "engineVersion" TEXT;
ALTER TABLE "OpponentSportingEvidence" ADD COLUMN "dataQuality" TEXT DEFAULT 'B';
ALTER TABLE "OpponentSportingEvidence" ADD COLUMN "lineupStateCount" INTEGER DEFAULT 0;
ALTER TABLE "OpponentSportingEvidence" ADD COLUMN "dominantLineupStrength" DECIMAL(4, 2);
ALTER TABLE "OpponentSportingEvidence" ADD COLUMN "contextSignals" JSONB;

-- CreateTable
CREATE TABLE "OpponentAssessmentChange" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "opponentTeamId" TEXT NOT NULL,
    "beforeLevel" DECIMAL(4, 2),
    "afterLevel" DECIMAL(4, 2),
    "source" TEXT NOT NULL DEFAULT 'AUTOMATIC',
    "reason" TEXT,
    "evidenceMatchId" TEXT,
    "engineVersion" TEXT NOT NULL,
    "formulaVersion" TEXT NOT NULL,
    "confidence" TEXT,
    "dataQuality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "OpponentAssessmentChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpponentAssessmentChange_opponentTeamId_idx" ON "OpponentAssessmentChange"("opponentTeamId");
CREATE INDEX "OpponentAssessmentChange_organisationId_idx" ON "OpponentAssessmentChange"("organisationId");
CREATE INDEX "OpponentAssessmentChange_opponentTeamId_createdAt_idx" ON "OpponentAssessmentChange"("opponentTeamId", "createdAt");

-- AddForeignKey
ALTER TABLE "OpponentAssessmentChange" ADD CONSTRAINT "OpponentAssessmentChange_opponentTeamId_fkey" FOREIGN KEY ("opponentTeamId") REFERENCES "OpponentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpponentAssessmentChange" ADD CONSTRAINT "OpponentAssessmentChange_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;