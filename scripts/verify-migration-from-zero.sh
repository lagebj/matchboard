#!/usr/bin/env bash
# Verify that Prisma migrations can be applied from a clean database.
# This script creates a temporary PostgreSQL database, applies all migrations,
# and validates the resulting schema.
#
# Usage: ./scripts/verify-migration-from-zero.sh [POSTGRES_URL]
#
# If POSTGRES_URL is not provided, uses TEST_DATABASE_URL or DATABASE_URL.
#
# Exit codes:
#   0 — all migrations applied successfully
#   1 — migration failure or validation error

set -euo pipefail

MIGRATION_URL="${1:-${TEST_DATABASE_URL:-${DATABASE_URL:-}}}"

if [ -z "$MIGRATION_URL" ]; then
  echo "error: provide POSTGRES_URL or set TEST_DATABASE_URL/DATABASE_URL" >&2
  exit 1
fi

DB_NAME="matchboard_migrate_verify_$(date +%s)"

echo "Verifying migration chain from empty database..."
echo "Using: $(echo "$MIGRATION_URL" | sed 's/:\/\/[^@]*@/:\/\/***@/')"

# Extract host, port, user, password from URL
PGHOST=$(echo "$MIGRATION_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@\([^:]*\):.*/\2/p')
PGPORT=$(echo "$MIGRATION_URL" | sed -n 's/.*:\/\/[^:]*:[^@]*@[^:]*:\([0-9]*\)\/.*/\1/p')
PGUSER=$(echo "$MIGRATION_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
PGPASSWORD=$(echo "$MIGRATION_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

export PGPASSWORD

# Create a fresh database for migration testing
echo "Creating test database: $DB_NAME"
createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$DB_NAME" 2>/dev/null || {
  echo "warning: could not create database $DB_NAME (may already exist or pg client not available)"
  # Try using psql instead
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" 2>/dev/null || {
    echo "error: cannot create test database" >&2
    exit 1
  }
}

VERIFY_URL=$(echo "$MIGRATION_URL" | sed "s/\/[^/]*$/\/$DB_NAME/")

cleanup() {
  echo "Cleaning up test database: $DB_NAME"
  dropdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$DB_NAME" 2>/dev/null || true
}
trap cleanup EXIT

# Apply migrations to the fresh database
echo "Applying migrations..."
DIRECT_URL="$VERIFY_URL" npx prisma migrate deploy 2>&1

MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -ne 0 ]; then
  echo "error: migration from zero failed" >&2
  exit 1
fi

echo "Validating schema..."
npx prisma validate 2>&1

echo ""
echo "Migration-from-zero verification PASSED"
echo "All migrations applied successfully to a clean database."