-- Add RLS policies for football group tables created after the initial RLS migrations.
-- These tables (FootballGroup, FootballGroupPlayer, GroupMovementPath) have organisationId
-- but were created AFTER the dynamic RLS policy migrations ran, so they have RLS enabled
-- and forced (from manual application) but lack tenant-scoped policies for matchboard_app_runtime.
-- GroupAccess does not have organisationId, so it uses a subquery join through FootballGroup.

-- ============================================================
-- 1. Enable and force RLS on tables with organisationId
-- ============================================================

ALTER TABLE "FootballGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FootballGroup" FORCE ROW LEVEL SECURITY;

ALTER TABLE "FootballGroupPlayer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FootballGroupPlayer" FORCE ROW LEVEL SECURITY;

ALTER TABLE "GroupMovementPath" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupMovementPath" FORCE ROW LEVEL SECURITY;

-- GroupAccess does not have organisationId, but still needs RLS
ALTER TABLE "GroupAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupAccess" FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Drop any existing policies (idempotent)
-- ============================================================

DROP POLICY IF EXISTS "FootballGroup_tenant_read" ON "FootballGroup";
DROP POLICY IF EXISTS "FootballGroup_tenant_insert" ON "FootballGroup";
DROP POLICY IF EXISTS "FootballGroup_tenant_update" ON "FootballGroup";
DROP POLICY IF EXISTS "FootballGroup_tenant_delete" ON "FootballGroup";
DROP POLICY IF EXISTS "FootballGroup_admin_all" ON "FootballGroup";

DROP POLICY IF EXISTS "FootballGroupPlayer_tenant_read" ON "FootballGroupPlayer";
DROP POLICY IF EXISTS "FootballGroupPlayer_tenant_insert" ON "FootballGroupPlayer";
DROP POLICY IF EXISTS "FootballGroupPlayer_tenant_update" ON "FootballGroupPlayer";
DROP POLICY IF EXISTS "FootballGroupPlayer_tenant_delete" ON "FootballGroupPlayer";
DROP POLICY IF EXISTS "FootballGroupPlayer_admin_all" ON "FootballGroupPlayer";

DROP POLICY IF EXISTS "GroupMovementPath_tenant_read" ON "GroupMovementPath";
DROP POLICY IF EXISTS "GroupMovementPath_tenant_insert" ON "GroupMovementPath";
DROP POLICY IF EXISTS "GroupMovementPath_tenant_update" ON "GroupMovementPath";
DROP POLICY IF EXISTS "GroupMovementPath_tenant_delete" ON "GroupMovementPath";
DROP POLICY IF EXISTS "GroupMovementPath_admin_all" ON "GroupMovementPath";

DROP POLICY IF EXISTS "GroupAccess_tenant_read" ON "GroupAccess";
DROP POLICY IF EXISTS "GroupAccess_tenant_insert" ON "GroupAccess";
DROP POLICY IF EXISTS "GroupAccess_tenant_update" ON "GroupAccess";
DROP POLICY IF EXISTS "GroupAccess_tenant_delete" ON "GroupAccess";
DROP POLICY IF EXISTS "GroupAccess_admin_all" ON "GroupAccess";

-- ============================================================
-- 3. Tenant-scoped policies for FootballGroup (has organisationId)
-- ============================================================

CREATE POLICY "FootballGroup_tenant_read" ON "FootballGroup" FOR SELECT TO matchboard_app_runtime
  USING ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "FootballGroup_tenant_insert" ON "FootballGroup" FOR INSERT TO matchboard_app_runtime
  WITH CHECK ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "FootballGroup_tenant_update" ON "FootballGroup" FOR UPDATE TO matchboard_app_runtime
  USING ("organisationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "FootballGroup_tenant_delete" ON "FootballGroup" FOR DELETE TO matchboard_app_runtime
  USING ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "FootballGroup_admin_all" ON "FootballGroup" FOR ALL TO matchboard_admin_migration
  USING (true) WITH CHECK (true);

-- ============================================================
-- 4. Tenant-scoped policies for FootballGroupPlayer (has organisationId)
-- ============================================================

CREATE POLICY "FootballGroupPlayer_tenant_read" ON "FootballGroupPlayer" FOR SELECT TO matchboard_app_runtime
  USING ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "FootballGroupPlayer_tenant_insert" ON "FootballGroupPlayer" FOR INSERT TO matchboard_app_runtime
  WITH CHECK ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "FootballGroupPlayer_tenant_update" ON "FootballGroupPlayer" FOR UPDATE TO matchboard_app_runtime
  USING ("organisationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "FootballGroupPlayer_tenant_delete" ON "FootballGroupPlayer" FOR DELETE TO matchboard_app_runtime
  USING ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "FootballGroupPlayer_admin_all" ON "FootballGroupPlayer" FOR ALL TO matchboard_admin_migration
  USING (true) WITH CHECK (true);

-- ============================================================
-- 5. Tenant-scoped policies for GroupMovementPath (has organisationId)
-- ============================================================

CREATE POLICY "GroupMovementPath_tenant_read" ON "GroupMovementPath" FOR SELECT TO matchboard_app_runtime
  USING ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "GroupMovementPath_tenant_insert" ON "GroupMovementPath" FOR INSERT TO matchboard_app_runtime
  WITH CHECK ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "GroupMovementPath_tenant_update" ON "GroupMovementPath" FOR UPDATE TO matchboard_app_runtime
  USING ("organisationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "GroupMovementPath_tenant_delete" ON "GroupMovementPath" FOR DELETE TO matchboard_app_runtime
  USING ("organisationId" = current_setting('app.current_organization_id', true));

CREATE POLICY "GroupMovementPath_admin_all" ON "GroupMovementPath" FOR ALL TO matchboard_admin_migration
  USING (true) WITH CHECK (true);

-- ============================================================
-- 6. Tenant-scoped policies for GroupAccess (no organisationId, uses join through FootballGroup)
-- ============================================================
-- GroupAccess is linked to an organisation via FootballGroup.organisationId.
-- The runtime role can only access GroupAccess rows where the associated group belongs
-- to the current organisation.

CREATE POLICY "GroupAccess_tenant_read" ON "GroupAccess" FOR SELECT TO matchboard_app_runtime
  USING (
    EXISTS (
      SELECT 1 FROM "FootballGroup"
      WHERE "FootballGroup"."id" = "GroupAccess"."footballGroupId"
        AND "FootballGroup"."organisationId" = current_setting('app.current_organization_id', true)
    )
  );

CREATE POLICY "GroupAccess_tenant_insert" ON "GroupAccess" FOR INSERT TO matchboard_app_runtime
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "FootballGroup"
      WHERE "FootballGroup"."id" = "GroupAccess"."footballGroupId"
        AND "FootballGroup"."organisationId" = current_setting('app.current_organization_id', true)
    )
  );

CREATE POLICY "GroupAccess_tenant_update" ON "GroupAccess" FOR UPDATE TO matchboard_app_runtime
  USING (
    EXISTS (
      SELECT 1 FROM "FootballGroup"
      WHERE "FootballGroup"."id" = "GroupAccess"."footballGroupId"
        AND "FootballGroup"."organisationId" = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "FootballGroup"
      WHERE "FootballGroup"."id" = "GroupAccess"."footballGroupId"
        AND "FootballGroup"."organisationId" = current_setting('app.current_organization_id', true)
    )
  );

CREATE POLICY "GroupAccess_tenant_delete" ON "GroupAccess" FOR DELETE TO matchboard_app_runtime
  USING (
    EXISTS (
      SELECT 1 FROM "FootballGroup"
      WHERE "FootballGroup"."id" = "GroupAccess"."footballGroupId"
        AND "FootballGroup"."organisationId" = current_setting('app.current_organization_id', true)
    )
  );

CREATE POLICY "GroupAccess_admin_all" ON "GroupAccess" FOR ALL TO matchboard_admin_migration
  USING (true) WITH CHECK (true);

-- ============================================================
-- 7. Grant table-level privileges to runtime and admin roles
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON "FootballGroup" TO matchboard_app_runtime;
GRANT ALL PRIVILEGES ON "FootballGroup" TO matchboard_admin_migration;

GRANT SELECT, INSERT, UPDATE, DELETE ON "FootballGroupPlayer" TO matchboard_app_runtime;
GRANT ALL PRIVILEGES ON "FootballGroupPlayer" TO matchboard_admin_migration;

GRANT SELECT, INSERT, UPDATE, DELETE ON "GroupMovementPath" TO matchboard_app_runtime;
GRANT ALL PRIVILEGES ON "GroupMovementPath" TO matchboard_admin_migration;

GRANT SELECT, INSERT, UPDATE, DELETE ON "GroupAccess" TO matchboard_app_runtime;
GRANT ALL PRIVILEGES ON "GroupAccess" TO matchboard_admin_migration;

-- ============================================================
-- 8. Ensure table ownership is matchboard_admin_migration
-- ============================================================

ALTER TABLE "FootballGroup" OWNER TO matchboard_admin_migration;
ALTER TABLE "FootballGroupPlayer" OWNER TO matchboard_admin_migration;
ALTER TABLE "GroupMovementPath" OWNER TO matchboard_admin_migration;
ALTER TABLE "GroupAccess" OWNER TO matchboard_admin_migration;

-- ============================================================
-- 9. Grant enum usage to runtime role
-- ============================================================

GRANT USAGE ON TYPE "FootballGroupType" TO matchboard_app_runtime;
GRANT USAGE ON TYPE "GroupMembershipType" TO matchboard_app_runtime;
GRANT USAGE ON TYPE "GroupMembershipStatus" TO matchboard_app_runtime;
GRANT USAGE ON TYPE "GroupAccessRole" TO matchboard_app_runtime;
GRANT USAGE ON TYPE "GroupMovementPathRole" TO matchboard_app_runtime;
GRANT USAGE ON TYPE "GroupMovementPathScope" TO matchboard_app_runtime;

-- ============================================================
-- 10. Update existing OrganisationMembership self-read policy
-- ============================================================
-- The GroupAccess table links to OrganisationMembership, so membership reads
-- during group access resolution must work. The existing self-read policy
-- already allows this, but let's make sure it's still in place.
-- (This section is a no-op verification — the policy was added in migration
--  20260804140000 and should already exist.)