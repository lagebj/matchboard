-- Add ReviewRequest model for revision-specific review

CREATE TYPE "ReviewTargetType" AS ENUM ('EVENT_SQUAD', 'MATCH_LINEUP');

CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'CANCELLED', 'SUPERSEDED');

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

CREATE UNIQUE INDEX "ReviewRequest_supersededById_key" ON "ReviewRequest"("supersededById");

CREATE INDEX "ReviewRequest_targetType_targetId_idx" ON "ReviewRequest"("targetType", "targetId");
CREATE INDEX "ReviewRequest_reviewerMembershipId_status_idx" ON "ReviewRequest"("reviewerMembershipId", "status");
CREATE INDEX "ReviewRequest_requestedByMembershipId_idx" ON "ReviewRequest"("requestedByMembershipId");
CREATE INDEX "ReviewRequest_organisationId_idx" ON "ReviewRequest"("organisationId");
CREATE INDEX "ReviewRequest_status_idx" ON "ReviewRequest"("status");

ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_requestedByMembershipId_fkey" FOREIGN KEY ("requestedByMembershipId") REFERENCES "OrganisationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_reviewerMembershipId_fkey" FOREIGN KEY ("reviewerMembershipId") REFERENCES "OrganisationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "ReviewRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;