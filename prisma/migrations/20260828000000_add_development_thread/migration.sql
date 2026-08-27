-- CreateEnum
CREATE TYPE "DevelopmentThreadStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CLOSED');
CREATE TYPE "DevelopmentFocusCategory" AS ENUM ('POSITIONAL_DISCIPLINE', 'CONFIDENCE_REBUILD', 'CHALLENGE_EXPOSURE', 'TEAM_FIRST_BEHAVIOUR', 'RESET_AFTER_ERROR', 'SUPPORT_TEAMMATES', 'PLAY_THROUGH_TEAM', 'BALL_CONTROL', 'DECISION_MAKING', 'EFFORT_AND_INTENSITY', 'POSITIONAL_LEARNING', 'GOALKEEPING');

-- CreateTable
CREATE TABLE "DevelopmentThread" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "focus" TEXT NOT NULL,
    "rationale" TEXT,
    "status" "DevelopmentThreadStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" "DevelopmentFocusCategory",
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentThreadObservation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "matchId" TEXT,
    "evidence" TEXT NOT NULL,
    "context" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentThreadObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevelopmentThread_playerId_idx" ON "DevelopmentThread"("playerId");
CREATE INDEX "DevelopmentThread_status_idx" ON "DevelopmentThread"("status");
CREATE INDEX "DevelopmentThread_organisationId_idx" ON "DevelopmentThread"("organisationId");
CREATE INDEX "DevelopmentThread_playerId_status_idx" ON "DevelopmentThread"("playerId", "status");

-- CreateIndex
CREATE INDEX "DevelopmentThreadObservation_threadId_idx" ON "DevelopmentThreadObservation"("threadId");
CREATE INDEX "DevelopmentThreadObservation_matchId_idx" ON "DevelopmentThreadObservation"("matchId");
CREATE INDEX "DevelopmentThreadObservation_organisationId_idx" ON "DevelopmentThreadObservation"("organisationId");

-- AddForeignKey
ALTER TABLE "DevelopmentThread" ADD CONSTRAINT "DevelopmentThread_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DevelopmentThread" ADD CONSTRAINT "DevelopmentThread_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentThreadObservation" ADD CONSTRAINT "DevelopmentThreadObservation_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DevelopmentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevelopmentThreadObservation" ADD CONSTRAINT "DevelopmentThreadObservation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DevelopmentThreadObservation" ADD CONSTRAINT "DevelopmentThreadObservation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS policies
ALTER TABLE "DevelopmentThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DevelopmentThreadObservation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DevelopmentThread_tenant_isolation" ON "DevelopmentThread" USING ("organisationId" = current_setting('app.current_organization_id')::text);
CREATE POLICY "DevelopmentThreadObservation_tenant_isolation" ON "DevelopmentThreadObservation" USING ("organisationId" = current_setting('app.current_organization_id')::text);