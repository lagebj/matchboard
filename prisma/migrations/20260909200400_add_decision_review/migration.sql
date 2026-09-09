-- CreateEnum
CREATE TYPE "DecisionReviewTargetType" AS ENUM ('DEVELOPMENT_THREAD', 'TEAM_FOCUS');

-- CreateEnum
CREATE TYPE "DecisionReviewStatus" AS ENUM ('PENDING', 'COMPLETED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "DecisionReviewOutcome" AS ENUM ('KEEP', 'CHANGE', 'COMPLETE');

-- CreateTable
CREATE TABLE "DecisionReview" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "targetType" "DecisionReviewTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetRevision" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "DecisionReviewStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" "DecisionReviewOutcome",
    "reviewNote" TEXT,
    "createdBy" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionReview_targetType_targetId_status_idx" ON "DecisionReview"("targetType", "targetId", "status");

-- CreateIndex
CREATE INDEX "DecisionReview_status_dueAt_idx" ON "DecisionReview"("status", "dueAt");

-- CreateIndex
CREATE INDEX "DecisionReview_organisationId_idx" ON "DecisionReview"("organisationId");

-- AddForeignKey
ALTER TABLE "DecisionReview" ADD CONSTRAINT "DecisionReview_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
