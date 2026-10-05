#!/usr/bin/env bash
# Per-PR feature acceptance cleanup: restore the test Custom Environment to the main baseline
# (alias + DATABASE_URL/DIRECT_URL back to the persistent Neon branch), then delete this PR's
# isolated Neon child branch. Runs on every PR close (merged or not) — see
# docs/adr/0075-per-pr-feature-acceptance-pipeline.md and
# docs/adr/0153-converge-to-single-vercel-project-with-deliberate-acceptance.md.
#
# Required env: PR_NUMBER, NEON_API_KEY, NEON_PROJECT_ID, VERCEL_TOKEN, VERCEL_ORG_ID,
#               VERCEL_PROJECT_ID

set -euo pipefail

: "${PR_NUMBER:?PR_NUMBER is required}"
: "${NEON_API_KEY:?NEON_API_KEY is required}"
: "${NEON_PROJECT_ID:?NEON_PROJECT_ID is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH_NAME="pr-${PR_NUMBER}"

neonctl_() { neonctl "$@" --api-key "$NEON_API_KEY" --project-id "$NEON_PROJECT_ID"; }

# Restores DATABASE_URL/DIRECT_URL to the persistent branch and the alias to main's baseline —
# must happen before the branch below is deleted, since a failure partway through deploy.sh
# could otherwise leave the test Custom Environment still pointed at a branch this step is about
# to remove.
"$SCRIPT_DIR/restore-baseline-alias.sh"

echo "== Deleting Neon branch ${BRANCH_NAME} =="
if neonctl_ branches get "$BRANCH_NAME" -o json >/dev/null 2>&1; then
  neonctl_ branches delete "$BRANCH_NAME"
else
  echo "Branch ${BRANCH_NAME} already absent — nothing to delete."
fi

echo "== Cleanup complete =="
