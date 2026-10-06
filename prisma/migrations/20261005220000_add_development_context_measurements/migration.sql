-- ADR-0155 step B3: the versioned derived-measurement and trend stores.
--
-- Hand-written (not `prisma migrate dev`-generated) because this sandbox's local dev Postgres
-- has independently drifted from the migration history in several unrelated ways (a narrowed
-- CoachingIntentScopeType enum, several missing organisationId indexes, a couple of renamed
-- indexes and dropped/re-added foreign keys) -- none of which this PR touches. The statements
-- below were extracted from Prisma's own generated diff for exactly the new enums/tables/
-- indexes this migration adds, with the two "exactly one of matchId/eventMatchId" CHECK
-- constraints added by hand afterward, matching ActualPositionInterval/CombinationEvidence/
-- MatchPeriodTimingResolution's own precedent (Prisma cannot express a CHECK constraint).

-- CreateEnum
CREATE TYPE "MeasurementScopeType" AS ENUM ('MATCH', 'WINDOW');

-- CreateEnum
CREATE TYPE "MeasurementCoverageStatus" AS ENUM ('COMPLETE', 'PARTIAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TrendDirectionStatus" AS ENUM ('UP', 'DOWN', 'STABLE');

-- CreateTable
CREATE TABLE "DerivedMeasurement" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "matchId" TEXT,
    "eventMatchId" TEXT,
    "playerId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricVersion" INTEGER NOT NULL,
    "scopeType" "MeasurementScopeType" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "numerator" DOUBLE PRECISION,
    "denominator" DOUBLE PRECISION,
    "denominatorUnit" TEXT,
    "presentationScale" DOUBLE PRECISION,
    "exposureSeconds" DOUBLE PRECISION,
    "coverage" "MeasurementCoverageStatus" NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "missingInputs" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "dimensions" JSONB NOT NULL,
    "sourceRefs" JSONB NOT NULL,
    "inputRevision" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DerivedMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DerivedTrend" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricVersion" INTEGER NOT NULL,
    "dimensions" JSONB NOT NULL,
    "previousWindowMatchIds" JSONB NOT NULL,
    "latestWindowMatchIds" JSONB NOT NULL,
    "previousValue" DOUBLE PRECISION NOT NULL,
    "latestValue" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "direction" "TrendDirectionStatus" NOT NULL,
    "materialityThreshold" DOUBLE PRECISION NOT NULL,
    "coverage" "MeasurementCoverageStatus" NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "missingInputs" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "sourceRefs" JSONB NOT NULL,
    "inputRevision" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DerivedTrend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DerivedMeasurement_matchId_playerId_metricKey_idx" ON "DerivedMeasurement"("matchId", "playerId", "metricKey");

-- CreateIndex
CREATE INDEX "DerivedMeasurement_eventMatchId_playerId_metricKey_idx" ON "DerivedMeasurement"("eventMatchId", "playerId", "metricKey");

-- CreateIndex
CREATE INDEX "DerivedMeasurement_playerId_metricKey_idx" ON "DerivedMeasurement"("playerId", "metricKey");

-- CreateIndex
CREATE INDEX "DerivedMeasurement_organisationId_idx" ON "DerivedMeasurement"("organisationId");

-- CreateIndex
CREATE INDEX "DerivedTrend_playerId_metricKey_idx" ON "DerivedTrend"("playerId", "metricKey");

-- CreateIndex
CREATE INDEX "DerivedTrend_organisationId_idx" ON "DerivedTrend"("organisationId");

-- AddForeignKey
ALTER TABLE "DerivedMeasurement" ADD CONSTRAINT "DerivedMeasurement_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedMeasurement" ADD CONSTRAINT "DerivedMeasurement_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedMeasurement" ADD CONSTRAINT "DerivedMeasurement_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedTrend" ADD CONSTRAINT "DerivedTrend_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint: exactly one of matchId/eventMatchId must be set (Prisma cannot express this).
ALTER TABLE "DerivedMeasurement" ADD CONSTRAINT "DerivedMeasurement_exactly_one_match_source" CHECK (("matchId" IS NOT NULL) != ("eventMatchId" IS NOT NULL));

-- ============================================================
-- Row-level security (defence in depth; primary tenant isolation is the Prisma
-- where-clause-injection extension in src/lib/db.ts, per ADR-0087). Same pattern
-- 20260926120000_add_coach_learning_loop used.
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'DerivedMeasurement', 'DerivedTrend'
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
      'DerivedMeasurement', 'DerivedTrend'
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
    'DerivedMeasurement', 'DerivedTrend'
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
      'MeasurementScopeType', 'MeasurementCoverageStatus', 'TrendDirectionStatus'
    ]) LOOP
      EXECUTE format('GRANT USAGE ON TYPE %I TO matchboard_app_runtime', typ);
    END LOOP;
  END IF;
END $$;
