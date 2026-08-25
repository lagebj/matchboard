#!/usr/bin/env bash
# Verify pending migrations apply cleanly to a populated previous-state database (ARR-0026,
# AIP-5). Forks a disposable Neon branch from the persistent "test" branch (already populated
# with real, ongoing test/CI data at its current migration state — the same populated-copy
# pattern scripts/test-acceptance/deploy.sh already uses for per-PR isolation), delegates the
# actual verification to scripts/verify-migration-upgrade.ts, then always deletes the branch.
#
# Complements scripts/verify-migration-from-zero.sh, which only proves the migration chain is
# internally consistent against an EMPTY schema — this proves it is safe against real, non-empty
# tables, which is what production-db-migrate.yml actually applies it to. No production data is
# ever touched or copied into the repository.
#
# Required env: NEON_API_KEY, NEON_PROJECT_ID
# Optional env: NEON_PARENT_BRANCH (default "test"), NEON_DATABASE_NAME (default "neondb")
#
# Exit codes:
#   0 — no pending migrations relative to the parent branch, or all pending migrations applied
#       and invariants verified successfully
#   1 — migration failure or invariant violation
#   2 — required secrets not configured (soft-skip signal, matches the e2e job's pattern of
#       gating on a `configured` step output rather than failing the whole job)

set -euo pipefail

if [ -z "${NEON_API_KEY:-}" ] || [ -z "${NEON_PROJECT_ID:-}" ]; then
  echo "NEON_API_KEY/NEON_PROJECT_ID not configured — skipping migration upgrade-path verification." >&2
  exit 2
fi

NEON_PARENT_BRANCH="${NEON_PARENT_BRANCH:-test}"
NEON_DATABASE_NAME="${NEON_DATABASE_NAME:-neondb}"
BRANCH_NAME="migration-upgrade-verify-$(date +%s)-$$"

neonctl_() { neonctl "$@" --api-key "$NEON_API_KEY" --project-id "$NEON_PROJECT_ID"; }

cleanup() {
  echo "== Deleting ephemeral Neon branch ${BRANCH_NAME} =="
  neonctl_ branches delete "$BRANCH_NAME" >/dev/null 2>&1 \
    || echo "warning: could not delete ${BRANCH_NAME} (may not have been created, or already gone)." >&2
}
trap cleanup EXIT

echo "== Forking ephemeral branch ${BRANCH_NAME} from ${NEON_PARENT_BRANCH} =="
neonctl_ branches create --name "$BRANCH_NAME" --parent "$NEON_PARENT_BRANCH"

echo "== Resolving admin connection string =="
DIRECT_URL="$(neonctl_ connection-string "$BRANCH_NAME" \
  --role-name matchboard_admin_migration --database-name "$NEON_DATABASE_NAME")"

DIRECT_URL="$DIRECT_URL" npx tsx scripts/verify-migration-upgrade.ts
