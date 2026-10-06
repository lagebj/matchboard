-- ADR-0156 Slice 0: Team Season Profile — one rebuildable snapshot row per
-- (organisation, Team, LeagueSeason). Additive only; no existing table/column/enum changed.

-- CreateTable
CREATE TABLE "TeamSeasonProfile" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "leagueSeasonId" TEXT NOT NULL,
    "profileVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceFingerprint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSeasonProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamSeasonProfile_organisationId_leagueSeasonId_idx" ON "TeamSeasonProfile"("organisationId", "leagueSeasonId");

-- CreateIndex
CREATE INDEX "TeamSeasonProfile_organisationId_teamId_idx" ON "TeamSeasonProfile"("organisationId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSeasonProfile_organisationId_teamId_leagueSeasonId_key" ON "TeamSeasonProfile"("organisationId", "teamId", "leagueSeasonId");

-- AddForeignKey
ALTER TABLE "TeamSeasonProfile" ADD CONSTRAINT "TeamSeasonProfile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeasonProfile" ADD CONSTRAINT "TeamSeasonProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeasonProfile" ADD CONSTRAINT "TeamSeasonProfile_leagueSeasonId_fkey" FOREIGN KEY ("leagueSeasonId") REFERENCES "LeagueSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Row-level security (defence in depth; primary tenant isolation is the Prisma
-- where-clause-injection extension in src/lib/db.ts, per ADR-0087). Same pattern
-- 20261005220000_add_development_context_measurements used.
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'TeamSeasonProfile'
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
      'TeamSeasonProfile'
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
    'TeamSeasonProfile'
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
