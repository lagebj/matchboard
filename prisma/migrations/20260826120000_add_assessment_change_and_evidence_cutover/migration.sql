-- AlterTable: Add evidenceCutoverAt to Player
ALTER TABLE "Player" ADD COLUMN "evidenceCutoverAt" TIMESTAMP(3);

-- CreateTable: AssessmentChange
CREATE TABLE "AssessmentChange" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'ATTRIBUTE',
    "attributeKey" TEXT,
    "targetDescription" TEXT,
    "beforeValue" DECIMAL(4,2),
    "afterValue" DECIMAL(4,2),
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "evidenceIds" JSONB,
    "engineVersion" TEXT NOT NULL,
    "mappingVersion" TEXT NOT NULL,
    "confidence" DECIMAL(3,2),
    "cutoverAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentChange_playerId_targetType_attributeKey_idx" ON "AssessmentChange"("playerId", "targetType", "attributeKey");
CREATE INDEX "AssessmentChange_playerId_createdAt_idx" ON "AssessmentChange"("playerId", "createdAt");
CREATE INDEX "AssessmentChange_organisationId_idx" ON "AssessmentChange"("organisationId");
CREATE INDEX "AssessmentChange_targetType_idx" ON "AssessmentChange"("targetType");
CREATE INDEX "AssessmentChange_source_idx" ON "AssessmentChange"("source");

-- AddForeignKey
ALTER TABLE "AssessmentChange" ADD CONSTRAINT "AssessmentChange_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentChange" ADD CONSTRAINT "AssessmentChange_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;