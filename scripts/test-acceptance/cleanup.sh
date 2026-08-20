#!/usr/bin/env bash
# Per-PR feature acceptance cleanup: restore test.matchboard.football to the main baseline,
# remove this PR's branch-scoped Vercel env vars, and delete its Neon child branch. Runs on
# every PR close (merged or not) — see docs/adr/0075-per-pr-feature-acceptance-pipeline.md.
#
# Required env: PR_NUMBER, GIT_BRANCH, NEON_API_KEY, NEON_PROJECT_ID, VERCEL_TOKEN,
#               VERCEL_ORG_ID, VERCEL_TEST_PROJECT_ID

set -euo pipefail

: "${PR_NUMBER:?PR_NUMBER is required}"
: "${GIT_BRANCH:?GIT_BRANCH is required}"
: "${NEON_API_KEY:?NEON_API_KEY is required}"
: "${NEON_PROJECT_ID:?NEON_PROJECT_ID is required}"
: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
: "${VERCEL_TEST_PROJECT_ID:?VERCEL_TEST_PROJECT_ID is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH_NAME="pr-${PR_NUMBER}"

neonctl_() { neonctl "$@" --api-key "$NEON_API_KEY" --project-id "$NEON_PROJECT_ID"; }
vercel_() { vercel "$@" --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"; }

"$SCRIPT_DIR/restore-baseline-alias.sh"

echo "== Removing branch-scoped Preview env vars for ${GIT_BRANCH} =="
vercel_ env rm DATABASE_URL preview "$GIT_BRANCH" --yes --project "$VERCEL_TEST_PROJECT_ID" \
  || echo "DATABASE_URL override for ${GIT_BRANCH} already absent."
vercel_ env rm DIRECT_URL preview "$GIT_BRANCH" --yes --project "$VERCEL_TEST_PROJECT_ID" \
  || echo "DIRECT_URL override for ${GIT_BRANCH} already absent."

echo "== Deleting Neon branch ${BRANCH_NAME} =="
if neonctl_ branches get "$BRANCH_NAME" -o json >/dev/null 2>&1; then
  neonctl_ branches delete "$BRANCH_NAME"
else
  echo "Branch ${BRANCH_NAME} already absent — nothing to delete."
fi

echo "== Cleanup complete =="
