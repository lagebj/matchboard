-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "targetType" "ReviewTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetRevision" TEXT NOT NULL,
    "requestedByMembershipId" TEXT NOT NULL,
    "reviewerMembershipId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "requestMessage" TEXT,
    "reviewerComment" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('EVENT_SQUAD', 'MATCH_LINEUP');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'CANCELLED', 'SUPERSEDED');

-- CreateIndex
CREATE INDEX "ReviewRequest_targetType_targetId_status_idx" ON "ReviewRequest"("targetType", "targetId", "status");

-- CreateIndex
CREATE INDEX "ReviewRequest_reviewerMembershipId_status_idx" ON "ReviewRequest"("reviewerMembershipId", "status");

-- CreateIndex
CREATE INDEX "ReviewRequest_requestedByMembershipId_idx" ON "ReviewRequest"("requestedByMembershipId");

-- CreateIndex
CREATE INDEX "ReviewRequest_organisationId_idx" ON "ReviewRequest"("organisationId");

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;