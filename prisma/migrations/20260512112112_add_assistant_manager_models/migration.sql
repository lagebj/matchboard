-- CreateTable
CREATE TABLE "AssistantIssue" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "affectedTeamIds" JSONB NOT NULL,
    "affectedPlayerIds" JSONB NOT NULL,
    "ruleIds" JSONB NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "primaryActionLabel" TEXT NOT NULL,
    "primaryActionHref" TEXT NOT NULL,
    "secondaryActionLabel" TEXT,
    "secondaryActionHref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionDecisionId" TEXT,

    CONSTRAINT "AssistantIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionRecord" (
    "id" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,

    CONSTRAINT "DecisionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionExplanation" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "matchId" TEXT,
    "teamId" TEXT,
    "playerId" TEXT,
    "summary" TEXT NOT NULL,
    "rulesApplied" JSONB NOT NULL,
    "blockers" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "crossTeamImpacts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelectionExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostMatchReport" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "teamNote" TEXT,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostMatchReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostMatchPlayerActual" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "attendanceStatus" TEXT NOT NULL,
    "actualPositions" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostMatchPlayerActual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantIssue_status_idx" ON "AssistantIssue"("status");

-- CreateIndex
CREATE INDEX "AssistantIssue_severity_idx" ON "AssistantIssue"("severity");

-- CreateIndex
CREATE INDEX "AssistantIssue_entityType_entityId_idx" ON "AssistantIssue"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AssistantIssue_createdAt_idx" ON "AssistantIssue"("createdAt");

-- CreateIndex
CREATE INDEX "DecisionRecord_entityType_entityId_idx" ON "DecisionRecord"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DecisionRecord_createdAt_idx" ON "DecisionRecord"("createdAt");

-- CreateIndex
CREATE INDEX "DecisionRecord_action_idx" ON "DecisionRecord"("action");

-- CreateIndex
CREATE INDEX "SelectionExplanation_scopeType_scopeId_idx" ON "SelectionExplanation"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "SelectionExplanation_matchId_idx" ON "SelectionExplanation"("matchId");

-- CreateIndex
CREATE INDEX "SelectionExplanation_teamId_idx" ON "SelectionExplanation"("teamId");

-- CreateIndex
CREATE INDEX "SelectionExplanation_playerId_idx" ON "SelectionExplanation"("playerId");

-- CreateIndex
CREATE INDEX "SelectionExplanation_createdAt_idx" ON "SelectionExplanation"("createdAt");

-- CreateIndex
CREATE INDEX "PostMatchReport_matchId_idx" ON "PostMatchReport"("matchId");

-- CreateIndex
CREATE INDEX "PostMatchReport_status_idx" ON "PostMatchReport"("status");

-- CreateIndex
CREATE INDEX "PostMatchPlayerActual_matchId_idx" ON "PostMatchPlayerActual"("matchId");

-- CreateIndex
CREATE INDEX "PostMatchPlayerActual_playerId_idx" ON "PostMatchPlayerActual"("playerId");

-- CreateIndex
CREATE INDEX "PostMatchPlayerActual_attendanceStatus_idx" ON "PostMatchPlayerActual"("attendanceStatus");

-- AddForeignKey
ALTER TABLE "PostMatchPlayerActual" ADD CONSTRAINT "PostMatchPlayerActual_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "PostMatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
