#!/usr/bin/env bash
# Restore the `test` Custom Environment to its default, safe state: DATABASE_URL/DIRECT_URL
# pointed back at the persistent Neon `test` branch, and test.matchboard.football aliased to
# main's current Test-baseline deployment. Used by cleanup.sh on normal PR close, and as the
# failure path if a deploy run breaks partway through — see
# docs/adr/0075-per-pr-feature-acceptance-pipeline.md's "Rollout safety" section: a failed run
# must never leave the shared slot pointed at a broken/deleted deployment or database branch.
#
# ADR-0153 superseded the old two-Vercel-project architecture this script originally relied on:
# `matchboard-test`'s own Git integration kept a static, always-current alias
# (`matchboard-test-git-main-matchboard-app.vercel.app`) for main's latest deployment, because
# that whole project auto-deployed every push. The single-project `test` Custom Environment
# deliberately never auto-deploys from a push (see scripts/vercel-ignore-build-step.sh) — the
# baseline deployment is instead produced explicitly by test-db-migrate.yml's
# `deploy-test-baseline` job after main's migration lands, so there is no static alias to read;
# it's looked up by querying deployments instead (see vercel-api.sh).
#
# Also restores DATABASE_URL/DIRECT_URL (see vercel-api.sh's upsert_test_env_var comment for why
# this is environment-wide, not per-branch, state) — deploy.sh temporarily points these at a
# PR's isolated Neon branch for the duration it holds the shared slot; this script is the
# counterpart that always runs before that lock is released.
#
# Required env: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, NEON_API_KEY, NEON_PROJECT_ID
# Optional env: NEON_PERSISTENT_TEST_BRANCH (default "test"), NEON_DATABASE_NAME (default "neondb")

set -euo pipefail

: "${NEON_API_KEY:?NEON_API_KEY is required}"
: "${NEON_PROJECT_ID:?NEON_PROJECT_ID is required}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
# shellcheck source=./vercel-api.sh
source "$SCRIPT_DIR/vercel-api.sh"

NEON_PERSISTENT_TEST_BRANCH="${NEON_PERSISTENT_TEST_BRANCH:-test}"
NEON_DATABASE_NAME="${NEON_DATABASE_NAME:-neondb}"

neonctl_() { neonctl "$@" --api-key "$NEON_API_KEY" --project-id "$NEON_PROJECT_ID"; }

echo "== Restoring test Custom Environment DATABASE_URL/DIRECT_URL to the persistent '${NEON_PERSISTENT_TEST_BRANCH}' branch =="
DIRECT_URL="$(neonctl_ connection-string "$NEON_PERSISTENT_TEST_BRANCH" \
  --role-name matchboard_admin_migration --database-name "$NEON_DATABASE_NAME")"
DATABASE_URL="$(neonctl_ connection-string "$NEON_PERSISTENT_TEST_BRANCH" --pooled \
  --role-name matchboard_app_runtime --database-name "$NEON_DATABASE_NAME")"
upsert_test_env_var DATABASE_URL "$DATABASE_URL"
upsert_test_env_var DIRECT_URL "$DIRECT_URL"

echo "== Resolving main's current Test-baseline deployment =="
BASELINE_URL="$(resolve_test_baseline_deployment_url)"

if [ -z "$BASELINE_URL" ]; then
  echo "No READY deployment of main found targeting the test Custom Environment — cannot restore the baseline alias. A deploy-test-baseline run (test-db-migrate.yml) may not have completed yet." >&2
  exit 1
fi

echo "== Restoring test.matchboard.football -> ${BASELINE_URL} (main baseline) =="
vercel alias set "$BASELINE_URL" test.matchboard.football \
  --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"
