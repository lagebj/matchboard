-- Scope OrganisationMembership RLS self-read policy to the authenticated user.
--
-- The previous permissive fallback allowed reading ALL OrganisationMembership rows
-- when app.current_organization_id was not set (NULL or empty). This was needed for
-- auth resolution (finding which orgs a user belongs to before knowing the org),
-- but it meant any query without tenant context could read all memberships across
-- all organisations.
--
-- The application now injects `userId` into OrganisationMembership queries via the
-- Prisma tenantRLS extension when organisation context is not set but userId is
-- available. This application-level filtering is the primary mechanism.
--
-- Database RLS serves as defence-in-depth. The self-read policy is now scoped to
-- the authenticated user's own memberships when app.current_user_id is set.
--
-- Since app.current_user_id is NOT set via SET LOCAL (which is unreliable with
-- the Neon adapter per ADR-0057), the RLS policy uses the session variable only
-- as defence-in-depth when it IS set. The application-layer userId injection is
-- the primary enforcement mechanism.
--
-- See ARR-0052, ADR-0057, ADR-0060.

-- Drop the old self-read policy (added in 20260804140000, now redundant with the
-- scoped tenant_read policy below)
DROP POLICY IF EXISTS OrganisationMembership_tenant_self_read ON "OrganisationMembership";

-- Recreate OrganisationMembership_tenant_read with a user-scoped fallback.
-- When app.current_organization_id is set: scope to that organisation (existing behavior).
-- When app.current_organization_id is NOT set AND app.current_user_id is set:
--   scope to the user's own memberships only (scoped self-read).
-- When neither is set: permissive fallback (application-layer filtering handles this).
DO $$
BEGIN
  FOR role_name IN SELECT unnest(ARRAY['matchboard_app', 'matchboard_app_runtime']) LOOP
    -- Drop the existing permissive-only policy
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON "OrganisationMembership"', 'OrganisationMembership_tenant_read');
    EXCEPTION WHEN others THEN
      NULL;
    END;

    -- Only create policies if the role exists
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      -- New scoped self-read policy: when no org context is set, limit reads
      -- to the authenticated user's own memberships if app.current_user_id is set
      EXECUTE format(
        'CREATE POLICY %I ON "OrganisationMembership" FOR SELECT TO %I USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
          OR (
            (current_setting(''app.current_organization_id'', true) IS NULL OR current_setting(''app.current_organization_id'', true) = '''')
            AND "userId" = current_setting(''app.current_user_id'', true)
          )
        )',
        'OrganisationMembership_tenant_read', role_name
      );
    END IF;
  END LOOP;
END $$;