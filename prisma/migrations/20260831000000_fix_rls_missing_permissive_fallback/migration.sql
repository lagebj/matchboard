-- Fix RLS policies on DevelopmentThread, DevelopmentThreadObservation, TeamFocus,
-- PlannedRotation, PlannedRotationChange, which were added after
-- 20260804160000_rls_permissive_when_app_context_unset but did not follow its pattern.
--
-- Two distinct defects, both fixed here the same way (recreate with the canonical
-- permissive-when-unset 4-policy-per-role pattern):
--
-- 1. DevelopmentThread, DevelopmentThreadObservation, TeamFocus used
--    current_setting('app.current_organization_id') WITHOUT the `missing_ok` second
--    argument. Since the app never actually sets this Postgres GUC (tenant scoping is
--    done entirely at the Prisma where-clause-injection layer — see db.ts), this form
--    throws `unrecognized configuration parameter "app.current_organization_id"`
--    (42704) on every single query against these tables, unconditionally. This is the
--    exact production crash: prisma.developmentThread.findMany() on a player detail
--    page.
--
-- 2. PlannedRotation, PlannedRotationChange used the safe `current_setting(..., TRUE)`
--    form (no crash) but were missing the "OR ... IS NULL OR ... = ''" permissive
--    fallback clause. Since the GUC is never set, "organisationId" = NULL evaluates to
--    NULL (not TRUE) in every row, so RLS silently blocked all SELECTs and rejected all
--    INSERT/UPDATEs against these tables for every organisation, not just a crash but a
--    fully broken feature.
--
-- Both fixes are additive to the app-layer isolation: primary tenant scoping remains the
-- Prisma where-clause injection (tenantRLS extension, fails closed at the app layer —
-- ADR-0087). RLS here is defense-in-depth and, per the established pattern, permissive
-- only when the GUC is unset (which is the actual runtime state today) and still
-- enforcing when it is set. This does not weaken isolation versus every other
-- already-fixed table using the same pattern.

DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
  role_name TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'DevelopmentThread', 'DevelopmentThreadObservation', 'TeamFocus',
    'PlannedRotation', 'PlannedRotationChange'
  ]) LOOP
    -- Drop every policy this table might currently have, under either naming scheme
    -- used across the two broken migrations, for both runtime role variants.
    FOR policy_name IN SELECT unnest(ARRAY[
      '_tenant_isolation',
      '_org_scoped_select', '_org_scoped_insert', '_org_scoped_update', '_org_scoped_delete',
      '_tenant_read', '_tenant_insert', '_tenant_update', '_tenant_delete'
    ]) LOOP
      BEGIN
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || policy_name, tbl);
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END LOOP;

    FOR role_name IN SELECT unnest(ARRAY['matchboard_app', 'matchboard_app_runtime']) LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR SELECT TO %I USING (
            "organisationId" = current_setting(''app.current_organization_id'', true)
            OR current_setting(''app.current_organization_id'', true) IS NULL
            OR current_setting(''app.current_organization_id'', true) = ''''
          )',
          tbl || '_tenant_read', tbl, role_name
        );

        EXECUTE format(
          'CREATE POLICY %I ON %I FOR INSERT TO %I WITH CHECK (
            "organisationId" = current_setting(''app.current_organization_id'', true)
            OR current_setting(''app.current_organization_id'', true) IS NULL
            OR current_setting(''app.current_organization_id'', true) = ''''
          )',
          tbl || '_tenant_insert', tbl, role_name
        );

        EXECUTE format(
          'CREATE POLICY %I ON %I FOR UPDATE TO %I USING (
            "organisationId" = current_setting(''app.current_organization_id'', true)
            OR current_setting(''app.current_organization_id'', true) IS NULL
            OR current_setting(''app.current_organization_id'', true) = ''''
          ) WITH CHECK (
            "organisationId" = current_setting(''app.current_organization_id'', true)
            OR current_setting(''app.current_organization_id'', true) IS NULL
            OR current_setting(''app.current_organization_id'', true) = ''''
          )',
          tbl || '_tenant_update', tbl, role_name
        );

        EXECUTE format(
          'CREATE POLICY %I ON %I FOR DELETE TO %I USING (
            "organisationId" = current_setting(''app.current_organization_id'', true)
            OR current_setting(''app.current_organization_id'', true) IS NULL
            OR current_setting(''app.current_organization_id'', true) = ''''
          )',
          tbl || '_tenant_delete', tbl, role_name
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;
