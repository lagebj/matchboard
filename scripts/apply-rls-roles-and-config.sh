#!/usr/bin/env bash
# Apply the full role configuration and RLS migration to a Neon database
# Usage: ./scripts/apply-rls-roles-and-config.sh <DATABASE_URL>
#
# This script:
# 1. Creates matchboard_app_runtime and matchboard_admin_migration roles (if not exist)
# 2. Sets passwords
# 3. Grants neondb_owner membership in new roles (for ownership transfer)
# 4. Grants database and schema privileges
# 5. Transfers object ownership to matchboard_admin_migration
# 6. Enables RLS on additional tenant-bearing tables
# 7. Drops legacy role policies
# 8. Creates new role policies
# 9. Grants table-level privileges
# 10. Sets default privileges for future objects
#
# Prerequisites: Run as neondb_owner (or a role with CREATEROLE and sufficient privileges)

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <DIRECT_URL>"
  echo "Example: $0 \"postgresql://neondb_owner:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require\""
  exit 1
fi

DIRECT_URL="$1"

echo "Applying RLS role configuration..."
echo "Connection: $(echo "$DIRECT_URL" | sed 's|://[^:]*:[^@]*@|://***:***@|')"

# Passwords are passed via environment variables
APP_RUNTIME_PW="${MATCHBOARD_APP_RUNTIME_PASSWORD:-$(openssl rand -base64 32 | tr -d '=+/')}"
ADMIN_MIGRATION_PW="${MATCHBOARD_ADMIN_MIGRATION_PASSWORD:-$(openssl rand -base64 32 | tr -d '=+/')}"

echo ""
echo "Step 1: Creating roles..."
psql "$DIRECT_URL" -c "
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app_runtime') THEN
    CREATE ROLE matchboard_app_runtime WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${APP_RUNTIME_PW}';
    RAISE NOTICE 'Created matchboard_app_runtime role';
  ELSE
    ALTER ROLE matchboard_app_runtime WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    RAISE NOTICE 'matchboard_app_runtime role already exists, attributes updated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_admin_migration') THEN
    CREATE ROLE matchboard_admin_migration WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${ADMIN_MIGRATION_PW}';
    RAISE NOTICE 'Created matchboard_admin_migration role';
  ELSE
    ALTER ROLE matchboard_admin_migration WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
    RAISE NOTICE 'matchboard_admin_migration role already exists, attributes updated';
  END IF;
END \$\$;
"

echo ""
echo "Step 2: Granting neondb_owner membership in new roles..."
psql "$DIRECT_URL" -c "
GRANT matchboard_admin_migration TO neondb_owner;
GRANT matchboard_app_runtime TO neondb_owner;
"

echo ""
echo "Step 3: Granting database and schema privileges..."
psql "$DIRECT_URL" -c "
GRANT CONNECT ON DATABASE neondb TO matchboard_app_runtime;
GRANT CONNECT ON DATABASE neondb TO matchboard_admin_migration;
GRANT USAGE ON SCHEMA public TO matchboard_app_runtime;
GRANT USAGE, CREATE ON SCHEMA public TO matchboard_admin_migration;
"

echo ""
echo "Step 4: Transferring object ownership to matchboard_admin_migration..."
psql "$DIRECT_URL" -c "
DO \$\$
DECLARE
  tbl TEXT;
  seq RECORD;
  typ TEXT;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner != 'matchboard_admin_migration' LOOP
    EXECUTE format('ALTER TABLE %I.%I OWNER TO matchboard_admin_migration', 'public', tbl);
  END LOOP;

  FOR typ IN SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e' AND pg_get_userbyid(t.typowner) != 'matchboard_admin_migration' LOOP
    EXECUTE format('ALTER TYPE %I.%I OWNER TO matchboard_admin_migration', 'public', typ.typname);
  END LOOP;

  FOR seq IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO matchboard_admin_migration', 'public', seq.sequencename);
  END LOOP;
END \$\$;
"

echo ""
echo "Step 5: Enabling RLS on additional tenant-bearing tables..."
psql "$DIRECT_URL" -c "
DO \$\$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'FairPlayObservation', 'LiveMatchEvent', 'LiveMatchSession', 'MatchRotation',
    'NotificationOutbox', 'OpponentSportingEvidence', 'PlayerDevelopmentObservation',
    'PlannedRotation', 'PlannedRotationChange',
    'PlayerProfileSuggestion', 'ReviewRequest', 'WorkOwnership'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END \$\$;
"

echo ""
echo "Step 6: Dropping legacy role policies and creating new role policies..."
psql "$DIRECT_URL" -c "
DO \$\$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  -- Drop legacy matchboard_app policies
  FOR pol IN
    SELECT p.polname, c.relname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND EXISTS (SELECT 1 FROM pg_roles r2 WHERE r2.oid = ANY(p.polroles) AND r2.rolname IN ('matchboard_app'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.polname, pol.relname);
  END LOOP;

  -- Drop legacy matchboard_admin policies
  FOR pol IN
    SELECT p.polname, c.relname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND EXISTS (SELECT 1 FROM pg_roles r2 WHERE r2.oid = ANY(p.polroles) AND r2.rolname IN ('matchboard_admin'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.polname, pol.relname);
  END LOOP;

  -- Create new policies for RLS-enabled tables with organisationId
  FOR tbl IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
    AND EXISTS (
      SELECT 1 FROM information_schema.columns col
      WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'organisationId'
    )
    ORDER BY c.relname
  LOOP
    -- Tenant-scoped policies for matchboard_app_runtime
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO matchboard_app_runtime USING (
      \"organisationId\" = current_setting(''app.current_organization_id'', true)
      OR (\"organisationId\" IS NULL AND current_setting(''app.current_organization_id'', true) = '''')
    )', tbl || '_tenant_read', tbl);

    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO matchboard_app_runtime WITH CHECK (
      \"organisationId\" = current_setting(''app.current_organization_id'', true)
    )', tbl || '_tenant_insert', tbl);

    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO matchboard_app_runtime USING (
      \"organisationId\" = current_setting(''app.current_organization_id'', true)
    ) WITH CHECK (
      \"organisationId\" = current_setting(''app.current_organization_id'', true)
    )', tbl || '_tenant_update', tbl);

    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO matchboard_app_runtime USING (
      \"organisationId\" = current_setting(''app.current_organization_id'', true)
    )', tbl || '_tenant_delete', tbl);

    -- Admin bypass policy for matchboard_admin_migration
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO matchboard_admin_migration USING (true) WITH CHECK (true)',
      tbl || '_admin_all', tbl);
  END LOOP;
END \$\$;
"

echo ""
echo "Step 7: Granting table-level privileges..."
psql "$DIRECT_URL" -c "
DO \$\$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO matchboard_app_runtime', 'public', tbl);
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE %I.%I TO matchboard_admin_migration', 'public', tbl);
  END LOOP;
END \$\$;
"

echo ""
echo "Step 8: Setting default privileges for future objects..."
psql "$DIRECT_URL" -c "
ALTER DEFAULT PRIVILEGES FOR ROLE matchboard_admin_migration IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO matchboard_app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE matchboard_admin_migration IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO matchboard_app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE matchboard_admin_migration IN SCHEMA public
  GRANT USAGE ON TYPES TO matchboard_app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO matchboard_app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO matchboard_app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE ON TYPES TO matchboard_app_runtime;
"

echo ""
echo "=========================================="
echo "Configuration complete!"
echo ""
echo "Update your connection strings:"
echo "  DATABASE_URL=postgresql://matchboard_app_runtime:${APP_RUNTIME_PW}@<pooler-host>/neondb?sslmode=require"
echo "  DIRECT_URL=postgresql://matchboard_admin_migration:${ADMIN_MIGRATION_PW}@<direct-host>/neondb?sslmode=require"
echo "=========================================="