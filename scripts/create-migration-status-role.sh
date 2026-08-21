#!/usr/bin/env bash
# Create the Neon database role used by production-db-migrate.yml's unattended `check` job
# (ADR-0084). This role only ever needs to run `prisma migrate status` -- a read of the
# `_prisma_migrations` bookkeeping table -- so it is deliberately granted nothing else.
#
# IMPORTANT: create it via direct SQL (this script), not `neonctl roles create` / the Neon
# console. Roles created through Neon's control-plane API are automatically added to the
# `neon_superuser` group role, which this script's own ALTER/GRANT statements cannot revoke
# (neondb_owner lacks ADMIN OPTION on a role it did not create) -- confirmed by hitting exactly
# this wall while provisioning it for real. Creating the role via SQL as neondb_owner avoids the
# automatic neon_superuser membership entirely (same reasoning create-rls-roles.sh documents for
# matchboard_app_runtime/matchboard_admin_migration).
#
# Prerequisites:
# - psql installed and available in PATH
# - DIRECT_URL environment variable set to the neondb_owner connection string (must have
#   CREATEROLE; the app's own matchboard_admin_migration role does not)
#
# Usage:
#   DIRECT_URL="postgresql://neondb_owner:pass@host.neon.tech/db" ./scripts/create-migration-status-role.sh
#
# After running this script:
# 1. Set the PRODUCTION_DATABASE_URL_STATUS_CHECK GitHub Actions secret (repo-level, NOT
#    environment-scoped -- production-db-migrate.yml's `check` job must read it without
#    triggering the production-db environment's required-reviewer approval):
#      gh secret set PRODUCTION_DATABASE_URL_STATUS_CHECK
#    using the connection string this script prints (direct/non-pooled host, matching
#    PRODUCTION_DATABASE_URL's convention).
# 2. Verify: DIRECT_URL="<that connection string>" npx prisma migrate status should succeed
#    read-only, and a query against any application table (e.g. "Organisation") should fail with
#    "permission denied".

set -euo pipefail

if [ -z "${DIRECT_URL:-}" ]; then
  echo "ERROR: DIRECT_URL environment variable must be set (neondb_owner connection string)"
  echo "Usage: DIRECT_URL=\"postgresql://neondb_owner:pass@host.neon.tech/db\" ./scripts/create-migration-status-role.sh"
  exit 1
fi

STATUS_ROLE_PASSWORD="${MATCHBOARD_MIGRATION_STATUS_PASSWORD:-$(openssl rand -base64 32 | tr -d '=+/')}"

echo "Creating matchboard_migration_status role (read-only, _prisma_migrations only)..."
psql "$DIRECT_URL" -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'matchboard_migration_status') THEN
      CREATE ROLE matchboard_migration_status WITH LOGIN PASSWORD '${STATUS_ROLE_PASSWORD}' NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      RAISE NOTICE 'Created matchboard_migration_status role';
    ELSE
      ALTER ROLE matchboard_migration_status WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      RAISE NOTICE 'matchboard_migration_status role already exists, attributes updated';
    END IF;
  END \$\$;
"

echo ""
echo "Granting minimal privileges (CONNECT + _prisma_migrations SELECT only)..."
psql "$DIRECT_URL" <<'SQL'
GRANT CONNECT ON DATABASE neondb TO matchboard_migration_status;
GRANT USAGE ON SCHEMA public TO matchboard_migration_status;
GRANT SELECT ON public._prisma_migrations TO matchboard_migration_status;
SQL

echo ""
echo "Role created. Password: ${STATUS_ROLE_PASSWORD}"
echo ""
echo "IMPORTANT: construct the connection string using the same host as PRODUCTION_DATABASE_URL"
echo "(direct/non-pooled Neon endpoint), then set it as a repo-level secret:"
echo "  gh secret set PRODUCTION_DATABASE_URL_STATUS_CHECK"
echo "  postgresql://matchboard_migration_status:${STATUS_ROLE_PASSWORD}@<direct-host>/neondb?sslmode=require&channel_binding=require"
