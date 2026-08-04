-- Allow the runtime role to read OrganisationMembership rows when no org context is set.
-- This is required for org resolution during authentication: the app needs to find
-- which organisations a user belongs to before it knows which org context to set.
-- Without this policy, getOrgSlugForUser() and resolveOrgSlugForLayout() return 0 memberships
-- because the tenant_read policy requires app.current_organization_id to be set, creating
-- a chicken-and-egg problem.
--
-- The policy allows SELECT on all OrganisationMembership rows when
-- app.current_organization_id is empty (not yet resolved), which only happens during
-- the auth resolution phase before any org context is established.

CREATE POLICY OrganisationMembership_tenant_self_read
ON "OrganisationMembership"
FOR SELECT
TO matchboard_app_runtime
USING (current_setting('app.current_organization_id', true) IS NOT DISTINCT FROM '' OR current_setting('app.current_organization_id', true) IS NULL);