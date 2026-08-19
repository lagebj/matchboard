#!/usr/bin/env bash
# Idempotent local Postgres setup for this sandboxed devcontainer, which cannot run Docker (no
# cgroup write access, unshare() returns EPERM). Creates/starts the native postgresql cluster
# installed in the Dockerfile (pinned to match Neon's actual running version), creates the
# matchboard role/databases matching docker-compose.yml and .env.example's documented local-dev
# defaults exactly, and applies migrations. Safe to call on every post-create and post-start —
# every step no-ops cleanly if already done.
set -Eeuo pipefail

workspace="${CODESPACE_VSCODE_FOLDER:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$workspace"

if ! command -v pg_lsclusters >/dev/null 2>&1; then
  echo "[local-postgres] postgresql server not installed (Dockerfile out of date?) — skipping."
  exit 0
fi

# The Dockerfile installs exactly one postgresql-<N> *server* package; discover its major
# version rather than hardcoding it here, so this script doesn't need a matching edit whenever
# the Dockerfile's pinned version changes. Check for an actual initdb binary, not just a
# /usr/lib/postgresql/<N>/ directory — postgresql-client-<N> (a transitive dependency pulled in
# alongside the pinned server version) creates client-only directories with no initdb.
pg_version="$(pg_lsclusters --no-header 2>/dev/null | awk '{print $1}' | head -1)"
if [[ -z "$pg_version" ]]; then
  for candidate in $(ls /usr/lib/postgresql/ 2>/dev/null | sort -rn); do
    if [[ -x "/usr/lib/postgresql/${candidate}/bin/initdb" ]]; then
      pg_version="$candidate"
      break
    fi
  done
fi
if [[ -z "$pg_version" ]]; then
  echo "[local-postgres] Could not determine installed postgresql server version — skipping." >&2
  exit 1
fi

if ! pg_lsclusters --no-header 2>/dev/null | awk '{print $1, $2}' | grep -q "^${pg_version} main$"; then
  echo "[local-postgres] Creating postgresql ${pg_version} cluster..."
  sudo pg_createcluster "$pg_version" main --start
fi

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "[local-postgres] Starting postgresql service..."
  sudo service postgresql start
  for _ in {1..30}; do
    pg_isready -h localhost -p 5432 >/dev/null 2>&1 && break
    sleep 1
  done
fi

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "[local-postgres] postgresql did not become ready — skipping role/database setup." >&2
  exit 1
fi

role_exists="$(sudo su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='matchboard'\"" 2>/dev/null || true)"
if [[ "$role_exists" != "1" ]]; then
  echo "[local-postgres] Creating matchboard role..."
  sudo su - postgres -c "psql -c \"CREATE ROLE matchboard WITH LOGIN SUPERUSER PASSWORD 'matchboard';\""
fi

for db in matchboard matchboard_test; do
  db_exists="$(sudo su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${db}'\"" 2>/dev/null || true)"
  if [[ "$db_exists" != "1" ]]; then
    echo "[local-postgres] Creating database ${db}..."
    sudo su - postgres -c "psql -c \"CREATE DATABASE ${db} OWNER matchboard;\""
  fi
done

echo "[local-postgres] Applying migrations..."
DIRECT_URL="postgresql://matchboard:matchboard@localhost:5432/matchboard?schema=public" \
  npx prisma migrate deploy >/dev/null
DIRECT_URL="postgresql://matchboard:matchboard@localhost:5432/matchboard_test?schema=public" \
  npx prisma migrate deploy >/dev/null

echo "[local-postgres] Ready: matchboard and matchboard_test databases on localhost:5432 (PostgreSQL ${pg_version})."
