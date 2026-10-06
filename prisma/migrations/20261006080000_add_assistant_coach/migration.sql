-- ADR-0155 step B7: the Assistant Coach capability.
--
-- Hand-written (not `prisma migrate dev`-generated) for the same reason as
-- 20261005220000_add_development_context_measurements: this sandbox's local dev Postgres has
-- independently drifted from the migration history in several unrelated ways, none of which
-- this PR touches. The statements below were extracted from Prisma's own generated diff for
-- exactly the new enum values/column/tables/indexes/foreign keys this migration adds.

-- CreateEnum
CREATE TYPE "AssistantCoachUncertainty" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AssistantCoachHypothesisState" AS ENUM ('ACTIVE', 'DISMISSED', 'PROMOTED');

-- AlterEnum
ALTER TYPE "AiAdvisorCapability" ADD VALUE 'ASSISTANT_COACH';

-- AlterEnum
ALTER TYPE "AiAdvisorScopeType" ADD VALUE 'PLAYER';

-- AlterTable
ALTER TABLE "OrganisationAiSettings" ADD COLUMN "assistantCoachEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AssistantCoachRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "status" "AiAdvisorReviewStatus" NOT NULL DEFAULT 'QUEUED',
    "providerConnectionId" TEXT,
    "provider" "AiProviderId",
    "model" TEXT,
    "schemaVersion" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "providerRequestDurationMs" INTEGER,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantCoachRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantCoachHypothesis" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "uncertainty" "AssistantCoachUncertainty" NOT NULL,
    "supportingRefs" JSONB NOT NULL,
    "contradictingRefs" JSONB NOT NULL,
    "missingEvidence" JSONB NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "state" "AssistantCoachHypothesisState" NOT NULL DEFAULT 'ACTIVE',
    "promotedDevelopmentThreadId" TEXT,
    "promotedAt" TIMESTAMP(3),
    "promotedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantCoachHypothesis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantCoachRun_organisationId_idx" ON "AssistantCoachRun"("organisationId");

-- CreateIndex
CREATE INDEX "AssistantCoachRun_org_player_fingerprint_idx" ON "AssistantCoachRun"("organisationId", "playerId", "sourceFingerprint");

-- CreateIndex
CREATE INDEX "AssistantCoachRun_org_player_status_idx" ON "AssistantCoachRun"("organisationId", "playerId", "status");

-- CreateIndex
CREATE INDEX "AssistantCoachHypothesis_organisationId_idx" ON "AssistantCoachHypothesis"("organisationId");

-- CreateIndex
CREATE INDEX "AssistantCoachHypothesis_runId_idx" ON "AssistantCoachHypothesis"("runId");

-- CreateIndex
CREATE INDEX "AssistantCoachHypothesis_organisationId_state_idx" ON "AssistantCoachHypothesis"("organisationId", "state");

-- AddForeignKey
ALTER TABLE "AssistantCoachRun" ADD CONSTRAINT "AssistantCoachRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantCoachRun" ADD CONSTRAINT "AssistantCoachRun_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "AiProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantCoachHypothesis" ADD CONSTRAINT "AssistantCoachHypothesis_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantCoachHypothesis" ADD CONSTRAINT "AssistantCoachHypothesis_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AssistantCoachRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Row-level security (defence in depth; primary tenant isolation is the Prisma
-- where-clause-injection extension in src/lib/db.ts, per ADR-0087). Same pattern
-- 20260926120000_add_coach_learning_loop / 20261005220000_add_development_context_measurements
-- used.
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'AssistantCoachRun', 'AssistantCoachHypothesis'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app_runtime') THEN
    FOR tbl IN SELECT unnest(ARRAY[
      'AssistantCoachRun', 'AssistantCoachHypothesis'
    ]) LOOP
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO matchboard_app_runtime USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        tbl || '_tenant_read', tbl
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I FOR INSERT TO matchboard_app_runtime WITH CHECK (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        tbl || '_tenant_insert', tbl
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I FOR UPDATE TO matchboard_app_runtime USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        ) WITH CHECK (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        tbl || '_tenant_update', tbl
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I FOR DELETE TO matchboard_app_runtime USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        tbl || '_tenant_delete', tbl
      );
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'AssistantCoachRun', 'AssistantCoachHypothesis'
  ]) LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app_runtime') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO matchboard_app_runtime', tbl);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_admin_migration') THEN
      EXECUTE format('GRANT ALL PRIVILEGES ON TABLE %I TO matchboard_admin_migration', tbl);
      EXECUTE format('ALTER TABLE %I OWNER TO matchboard_admin_migration', tbl);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  typ TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app_runtime') THEN
    FOR typ IN SELECT unnest(ARRAY[
      'AssistantCoachUncertainty', 'AssistantCoachHypothesisState'
    ]) LOOP
      EXECUTE format('GRANT USAGE ON TYPE %I TO matchboard_app_runtime', typ);
    END LOOP;
  END IF;
END $$;
