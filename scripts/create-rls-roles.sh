#!/usr/bin/env bash
# Create Neon database roles for Matchboard RLS
# Run this script BEFORE deploying the RLS migration.
#
# IMPORTANT: Neon Console-created roles inherit BYPASSRLS from neon_superuser,
# which makes RLS ineffective. This script creates SQL-managed roles instead:
# - matchboard_app_runtime: restricted runtime role (NOBYPASSRLS)
# - matchboard_admin_migration: migration role (NOBYPASSRLS, but has admin_all RLS policy)
#
# These roles are also created by the Prisma migration, but this script
# provides a standalone way to create them with passwords for connection strings.
#
# Prerequisites:
# - psql installed and available in PATH
# - DIRECT_URL environment variable set (pointing to Neon direct connection)
# - This script must be run by a user with CREATEROLE privilege (neondb_owner or neon_superuser)
#
# Usage:
#   DIRECT_URL="postgresql://user:pass@host.neon.tech/db" ./scripts/create-rls-roles.sh
#
# After running this script, update your environment variables:
#   DATABASE_URL=postgresql://matchboard_app_runtime:<password>@<pooler-host>/<db>?sslmode=require
#   DIRECT_URL=postgresql://matchboard_admin_migration:<password>@<direct-host>/<db>?sslmode=require

set -euo pipefail

if [ -z "${DIRECT_URL:-}" ]; then
  echo "ERROR: DIRECT_URL environment variable must be set"
  echo "Usage: DIRECT_URL=\"postgresql://user:pass@host.neon.tech/db\" ./scripts/create-rls-roles.sh"
  exit 1
fi

echo "Creating database roles for Matchboard RLS..."

# Generate secure passwords if not provided
APP_PASSWORD="${MATCHBOARD_APP_RUNTIME_PASSWORD:-$(openssl rand -base64 32 | tr -d '=+/')}"
ADMIN_PASSWORD="${MATCHBOARD_ADMIN_MIGRATION_PASSWORD:-$(openssl rand -base64 32 | tr -d '=+/')}"

echo ""
echo "Creating matchboard_app_runtime role (runtime, NOBYPASSRLS)..."
psql "$DIRECT_URL" -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'matchboard_app_runtime') THEN
      CREATE ROLE matchboard_app_runtime WITH LOGIN PASSWORD '${APP_PASSWORD}' NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      RAISE NOTICE 'Created matchboard_app_runtime role';
    ELSE
      ALTER ROLE matchboard_app_runtime WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      RAISE NOTICE 'matchboard_app_runtime role already exists, attributes updated';
    END IF;
  END \$\$;
"

echo ""
echo "Creating matchboard_admin_migration role (migration, NOBYPASSRLS)..."
psql "$DIRECT_URL" -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'matchboard_admin_migration') THEN
      CREATE ROLE matchboard_admin_migration WITH LOGIN PASSWORD '${ADMIN_PASSWORD}' NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
      RAISE NOTICE 'Created matchboard_admin_migration role';
    ELSE
      ALTER ROLE matchboard_admin_migration WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
      RAISE NOTICE 'matchboard_admin_migration role already exists, attributes updated';
    END IF;
  END \$\$;
"

echo ""
echo "Roles created successfully."
echo ""
echo "IMPORTANT: Update your environment variables:"
echo "  DATABASE_URL=postgresql://matchboard_app_runtime:${APP_PASSWORD}@<pooler-host>/<db>?sslmode=require"
echo "  DIRECT_URL=postgresql://matchboard_admin_migration:${ADMIN_PASSWORD}@<direct-host>/<db>?sslmode=require"
echo ""
echo "For Neon, construct the URLs using:"
echo "  - DATABASE_URL: Use the Neon pooled connection host (e.g., ep-xxx.us-east-2.aws.neon.tech)"
echo "  - DIRECT_URL: Use the Neon direct connection host (e.g., ep-xxx.us-east-2.aws.neon.tech)"
echo ""
echo "NOTE: The legacy roles (matchboard_app, matchboard_admin) remain in the database"
echo "but are no longer used by the application. They inherit BYPASSRLS from neon_superuser"
echo "and cannot be modified via SQL on Neon. Do NOT use them for application connections."