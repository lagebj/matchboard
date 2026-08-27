-- CreateEnum
CREATE TYPE "TeamFocusStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CLOSED');

-- CreateTable
CREATE TABLE "TeamFocus" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "context" TEXT,
    "status" "TeamFocusStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "linkedIntentId" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamFocus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamFocus_teamId_idx" ON "TeamFocus"("teamId");
CREATE INDEX "TeamFocus_status_idx" ON "TeamFocus"("status");
CREATE INDEX "TeamFocus_organisationId_idx" ON "TeamFocus"("organisationId");
CREATE INDEX "TeamFocus_teamId_status_idx" ON "TeamFocus"("teamId", "status");

-- AddForeignKey
ALTER TABLE "TeamFocus" ADD CONSTRAINT "TeamFocus_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamFocus" ADD CONSTRAINT "TeamFocus_linkedIntentId_fkey" FOREIGN KEY ("linkedIntentId") REFERENCES "CoachingIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamFocus" ADD CONSTRAINT "TeamFocus_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS policies
ALTER TABLE "TeamFocus" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TeamFocus_tenant_isolation" ON "TeamFocus" USING ("organisationId" = current_setting('app.current_organization_id')::text);