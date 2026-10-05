#!/usr/bin/env bash
# Per-PR feature acceptance deploy: create/reuse an isolated Neon child branch, migrate it,
# temporarily point the `test` Custom Environment's DATABASE_URL/DIRECT_URL at it, deploy the
# exact PR commit into that environment, and alias test.matchboard.football to it. See
# docs/adr/0075-per-pr-feature-acceptance-pipeline.md and
# docs/adr/0153-converge-to-single-vercel-project-with-deliberate-acceptance.md.
#
# Required env: PR_NUMBER, NEON_API_KEY, NEON_PROJECT_ID, VERCEL_TOKEN,
#               VERCEL_ORG_ID, VERCEL_PROJECT_ID, GH_TOKEN
# Optional env: NEON_PARENT_BRANCH (default "test"), NEON_DATABASE_NAME (default "neondb")
#
# GIT_BRANCH is intentionally not required here (ADR-0075 needed it to scope a Preview env var
# to this PR's branch; ADR-0153's Custom-Environment deploy has no such per-branch scoping — see
# vercel-api.sh's upsert_test_env_var comment). The checkout step that runs before this script
# still needs `ref: github.head_ref` so `vercel deploy`'s own git-metadata auto-detection records
# the correct branch/commit on the resulting deployment.

set -euo pipefail

: "${PR_NUMBER:?PR_NUMBER is required}"
: "${NEON_API_KEY:?NEON_API_KEY is required}"
: "${NEON_PROJECT_ID:?NEON_PROJECT_ID is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./vercel-api.sh
source "$SCRIPT_DIR/vercel-api.sh"

# Rollout safety (ADR-0075/ADR-0153): if anything below fails after the env-var/deploy steps
# could plausibly have left the shared Test environment mid-transition, restore it (both the
# DATABASE_URL/DIRECT_URL override and the alias) to the persistent-branch baseline rather than
# leaving the shared slot pointed at a broken/partial deployment or a soon-to-be-deleted Neon
# branch. A failure before any of that happened is a no-op here either way.
on_failure() {
  echo "Deploy failed — restoring the Test environment to the main baseline." >&2
  "$SCRIPT_DIR/restore-baseline-alias.sh" || echo "Baseline restore also failed — manual intervention needed." >&2
}
trap on_failure ERR

NEON_PARENT_BRANCH="${NEON_PARENT_BRANCH:-test}"
NEON_DATABASE_NAME="${NEON_DATABASE_NAME:-neondb}"
BRANCH_NAME="pr-${PR_NUMBER}"

neonctl_() { neonctl "$@" --api-key "$NEON_API_KEY" --project-id "$NEON_PROJECT_ID"; }
vercel_() { vercel "$@" --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"; }

echo "== Neon branch: create-or-reuse ${BRANCH_NAME} =="
if neonctl_ branches get "$BRANCH_NAME" -o json >/dev/null 2>&1; then
  echo "Branch ${BRANCH_NAME} already exists — reusing (idempotent across pushes to this PR)."
else
  neonctl_ branches create --name "$BRANCH_NAME" --parent "$NEON_PARENT_BRANCH"
fi

echo "== Resolving connection strings =="
DIRECT_URL="$(neonctl_ connection-string "$BRANCH_NAME" \
  --role-name matchboard_admin_migration --database-name "$NEON_DATABASE_NAME")"
DATABASE_URL="$(neonctl_ connection-string "$BRANCH_NAME" --pooled \
  --role-name matchboard_app_runtime --database-name "$NEON_DATABASE_NAME")"

echo "== Applying migrations to ${BRANCH_NAME} =="
DIRECT_URL="$DIRECT_URL" npx prisma migrate deploy

echo "== Pointing the test Custom Environment at ${BRANCH_NAME} =="
# Environment-wide, not per-branch (Custom Environments don't support git-branch-scoped env
# vars — see vercel-api.sh's upsert_test_env_var comment) — safe only because the shared Test
# slot is itself serialized one-PR-at-a-time, and restore-baseline-alias.sh always restores the
# persistent-branch default before the test-slot concurrency lock is released (cleanup.sh, and
# this script's own failure trap above).
upsert_test_env_var DATABASE_URL "$DATABASE_URL"
upsert_test_env_var DIRECT_URL "$DIRECT_URL"

echo "== Deploying exact PR commit =="
# vercel deploy auto-detects Git metadata (branch, commit) from the local checkout. The
# deployment's recorded branch is this PR's own branch, never "main" — which is what lets
# resolve_test_baseline_deployment_url's branch=main filter correctly ignore PR deployments when
# looking for the real Test baseline.
DEPLOY_URL="$(vercel_ deploy --target=test --project "$VERCEL_PROJECT_ID" --yes | tail -1)"
echo "Deployment: ${DEPLOY_URL}"

echo "== Aliasing test.matchboard.football -> this deployment =="
vercel_ alias set "$DEPLOY_URL" test.matchboard.football

COMMENT_BODY="Test slot now serves this PR: **https://test.matchboard.football**

- Commit: \`${GITHUB_SHA:-unknown}\`
- Deployment: ${DEPLOY_URL}
- Neon branch: \`${BRANCH_NAME}\` (isolated, disposable — deleted on close)

Slot returns to \`main\` + persistent Test automatically when this PR closes, or if new commits
are pushed (the \`acceptance\` label is removed automatically on the next push — re-apply it to
request acceptance again)."

gh pr comment "$PR_NUMBER" --body "$COMMENT_BODY" --edit-last 2>/dev/null \
  || gh pr comment "$PR_NUMBER" --body "$COMMENT_BODY"

echo "== Deploy complete =="
