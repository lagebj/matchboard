-- CreateEnum
CREATE TYPE "WorkTargetType" AS ENUM ('FIXTURE', 'EVENT', 'POST_MATCH_REPORT', 'EVENT_SQUAD_PREPARATION');

-- CreateEnum
CREATE TYPE "WorkOwnershipStatus" AS ENUM ('ACTIVE', 'HANDED_OVER', 'COMPLETED');

-- CreateTable
CREATE TABLE "WorkOwnership" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "targetType" "WorkTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "ownerMembershipId" TEXT NOT NULL,
    "assignedByMembershipId" TEXT NOT NULL,
    "status" "WorkOwnershipStatus" NOT NULL DEFAULT E'ACTIVE',
    "dueAt" TIMESTAMP(3),
    "handoverNote" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkOwnership_targetType_targetId_status_key" ON "WorkOwnership"("targetType", "targetId", "status");

-- CreateIndex
CREATE INDEX "WorkOwnership_organisationId_idx" ON "WorkOwnership"("organisationId");

-- CreateIndex
CREATE INDEX "WorkOwnership_ownerMembershipId_status_idx" ON "WorkOwnership"("ownerMembershipId", "status");

-- CreateIndex
CREATE INDEX "WorkOwnership_assignedByMembershipId_idx" ON "WorkOwnership"("assignedByMembershipId");

-- CreateIndex
CREATE INDEX "WorkOwnership_targetType_targetId_idx" ON "WorkOwnership"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "WorkOwnership_status_idx" ON "WorkOwnership"("status");

-- CreateIndex
CREATE INDEX "WorkOwnership_dueAt_idx" ON "WorkOwnership"("dueAt");

-- AddForeignKey
ALTER TABLE "WorkOwnership" ADD CONSTRAINT "WorkOwnership_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;