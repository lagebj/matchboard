-- CreateEnum
CREATE TYPE "PlannedRotationStatus" AS ENUM ('DRAFT', 'APPLIED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PlannedChangeStatus" AS ENUM ('PENDING', 'APPLIED', 'SKIPPED', 'MODIFIED');

-- CreateTable
CREATE TABLE "PlannedRotation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "PlannedRotationStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedRotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedRotationChange" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "plannedRotationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "outPlayerId" TEXT,
    "inPlayerId" TEXT,
    "outPosition" TEXT,
    "inPosition" TEXT,
    "positionOnly" BOOLEAN NOT NULL DEFAULT false,
    "approximateMatchSeconds" INTEGER,
    "status" "PlannedChangeStatus" NOT NULL DEFAULT 'PENDING',
    "liveEventId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedRotationChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlannedRotation_matchId_teamId_key" ON "PlannedRotation"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "PlannedRotation_matchId_idx" ON "PlannedRotation"("matchId");

-- CreateIndex
CREATE INDEX "PlannedRotation_teamId_idx" ON "PlannedRotation"("teamId");

-- CreateIndex
CREATE INDEX "PlannedRotation_organisationId_idx" ON "PlannedRotation"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedRotationChange_plannedRotationId_sequence_key" ON "PlannedRotationChange"("plannedRotationId", "sequence");

-- CreateIndex
CREATE INDEX "PlannedRotationChange_plannedRotationId_idx" ON "PlannedRotationChange"("plannedRotationId");

-- CreateIndex
CREATE INDEX "PlannedRotationChange_outPlayerId_idx" ON "PlannedRotationChange"("outPlayerId");

-- CreateIndex
CREATE INDEX "PlannedRotationChange_inPlayerId_idx" ON "PlannedRotationChange"("inPlayerId");

-- CreateIndex
CREATE INDEX "PlannedRotationChange_organisationId_idx" ON "PlannedRotationChange"("organisationId");

-- AddForeignKey
ALTER TABLE "PlannedRotation" ADD CONSTRAINT "PlannedRotation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedRotation" ADD CONSTRAINT "PlannedRotation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedRotation" ADD CONSTRAINT "PlannedRotation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedRotationChange" ADD CONSTRAINT "PlannedRotationChange_plannedRotationId_fkey" FOREIGN KEY ("plannedRotationId") REFERENCES "PlannedRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedRotationChange" ADD CONSTRAINT "PlannedRotationChange_outPlayerId_fkey" FOREIGN KEY ("outPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedRotationChange" ADD CONSTRAINT "PlannedRotationChange_inPlayerId_fkey" FOREIGN KEY ("inPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedRotationChange" ADD CONSTRAINT "PlannedRotationChange_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS policies for PlannedRotation (defense-in-depth, primary isolation is Prisma where-clause injection)
ALTER TABLE "PlannedRotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannedRotation" FORCE ROW LEVEL SECURITY;

ALTER TABLE "PlannedRotationChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlannedRotationChange" FORCE ROW LEVEL SECURITY;

CREATE POLICY "PlannedRotation_org_scoped_select" ON "PlannedRotation" FOR SELECT USING (organisationId = current_setting('app.current_organization_id', TRUE));
CREATE POLICY "PlannedRotation_org_scoped_insert" ON "PlannedRotation" FOR INSERT WITH CHECK (organisationId = current_setting('app.current_organization_id', TRUE));
CREATE POLICY "PlannedRotation_org_scoped_update" ON "PlannedRotation" FOR UPDATE USING (organisationId = current_setting('app.current_organization_id', TRUE));
CREATE POLICY "PlannedRotation_org_scoped_delete" ON "PlannedRotation" FOR DELETE USING (organisationId = current_setting('app.current_organization_id', TRUE));

CREATE POLICY "PlannedRotationChange_org_scoped_select" ON "PlannedRotationChange" FOR SELECT USING (organisationId = current_setting('app.current_organization_id', TRUE));
CREATE POLICY "PlannedRotationChange_org_scoped_insert" ON "PlannedRotationChange" FOR INSERT WITH CHECK (organisationId = current_setting('app.current_organization_id', TRUE));
CREATE POLICY "PlannedRotationChange_org_scoped_update" ON "PlannedRotationChange" FOR UPDATE USING (organisationId = current_setting('app.current_organization_id', TRUE));
CREATE POLICY "PlannedRotationChange_org_scoped_delete" ON "PlannedRotationChange" FOR DELETE USING (organisationId = current_setting('app.current_organization_id', TRUE));