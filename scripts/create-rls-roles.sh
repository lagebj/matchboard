#!/usr/bin/env bash
# Create Neon database roles for Matchboard RLS
# Run this script BEFORE deploying the RLS migration.
#
# Prerequisites:
# - psql installed and available in PATH
# - DIRECT_URL environment variable set (pointing to Neon direct connection)
# - This script must be run by a user with CREATEROLE privilege (Neon superuser)
#
# Usage:
#   DIRECT_URL="postgresql://user:pass@host.neon.tech/db" ./scripts/create-rls-roles.sh
#
# For Neon, you can also create roles through the Neon dashboard:
#   1. Go to your Neon project > Roles
#   2. Create "matchboard_app" role (NOBYPASSRLS, LOGIN)
#   3. Create "matchboard_admin" role (BYPASSRLS, LOGIN)
#   4. Update your environment variables:
#      - DATABASE_URL uses matchboard_app credentials (pooled connection)
#      - DIRECT_URL uses matchboard_admin credentials (direct connection)

set -euo pipefail

if [ -z "${DIRECT_URL:-}" ]; then
  echo "ERROR: DIRECT_URL environment variable must be set"
  echo "Usage: DIRECT_URL=\"postgresql://user:pass@host.neon.tech/db\" ./scripts/create-rls-roles.sh"
  exit 1
fi

echo "Creating database roles for Matchboard RLS..."

# Generate secure passwords if not provided
APP_PASSWORD="${MATCHBOARD_APP_PASSWORD:-$(openssl rand -base64 32 | tr -d '=+/')"
ADMIN_PASSWORD="${MATCHBOARD_ADMIN_PASSWORD:-$(openssl rand -base64 32 | tr -d '=+/')"

echo ""
echo "Creating matchboard_app role (runtime, NOBYPASSRLS)..."
psql "$DIRECT_URL" -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'matchboard_app') THEN
      CREATE ROLE matchboard_app WITH LOGIN PASSWORD '${APP_PASSWORD}' NOBYPASSRLS;
      RAISE NOTICE 'Created matchboard_app role';
    ELSE
      RAISE NOTICE 'matchboard_app role already exists';
    END IF;
  END \$\$;
"

echo ""
echo "Creating matchboard_admin role (migration, BYPASSRLS)..."
psql "$DIRECT_URL" -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'matchboard_admin') THEN
      CREATE ROLE matchboard_admin WITH LOGIN PASSWORD '${ADMIN_PASSWORD}' BYPASSRLS;
      RAISE NOTICE 'Created matchboard_admin role';
    ELSE
      RAISE NOTICE 'matchboard_admin role already exists';
    END IF;
  END \$\$;
"

echo ""
echo "Roles created successfully."
echo ""
echo "IMPORTANT: Update your environment variables:"
echo "  DATABASE_URL=postgresql://matchboard_app:${APP_PASSWORD}@<pooler-host>/<db>?sslmode=require"
echo "  DIRECT_URL=postgresql://matchboard_admin:${ADMIN_PASSWORD}@<direct-host>/<db>?sslmode=require"
echo ""
echo "For Neon, construct the URLs using:"
echo "  - DATABASE_URL: Use the Neon pooled connection host (e.g., ep-xxx.us-east-2.aws.neon.tech)"
echo "  - DIRECT_URL: Use the Neon direct connection host (e.g., ep-xxx.us-east-2.aws.neon.tech)"