#!/usr/bin/env bash
# Per-PR feature acceptance deploy: create/reuse an isolated Neon child branch, migrate it,
# scope this PR's Vercel Preview build to that branch, deploy the exact PR commit, and alias
# test.matchboard.football to it. See docs/adr/0075-per-pr-feature-acceptance-pipeline.md.
#
# Required env: PR_NUMBER, GIT_BRANCH, NEON_API_KEY, NEON_PROJECT_ID, VERCEL_TOKEN,
#               VERCEL_ORG_ID, VERCEL_TEST_PROJECT_ID, GH_TOKEN
# Optional env: NEON_PARENT_BRANCH (default "test"), NEON_DATABASE_NAME (default "neondb")

set -euo pipefail

: "${PR_NUMBER:?PR_NUMBER is required}"
: "${GIT_BRANCH:?GIT_BRANCH is required}"
: "${NEON_API_KEY:?NEON_API_KEY is required}"
: "${NEON_PROJECT_ID:?NEON_PROJECT_ID is required}"
: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
: "${VERCEL_TEST_PROJECT_ID:?VERCEL_TEST_PROJECT_ID is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Rollout safety (ADR-0075): if anything below fails after the deploy step could plausibly have
# left the alias mid-transition, restore it to the main baseline rather than leaving the shared
# slot pointed at a broken/partial deployment. A failure before any alias change is a no-op here
# (the alias was never touched), which is safe either way.
on_failure() {
  echo "Deploy failed — restoring test.matchboard.football to the main baseline." >&2
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

echo "== Scoping Preview env vars to git branch ${GIT_BRANCH} =="
printf '%s' "$DATABASE_URL" | vercel_ env add DATABASE_URL preview "$GIT_BRANCH" \
  --force --yes --project "$VERCEL_TEST_PROJECT_ID"
printf '%s' "$DIRECT_URL" | vercel_ env add DIRECT_URL preview "$GIT_BRANCH" \
  --force --yes --project "$VERCEL_TEST_PROJECT_ID"

echo "== Deploying exact PR commit =="
# vercel deploy auto-detects Git metadata (branch, commit) from the local checkout, which is
# what makes the branch-scoped env vars above apply to this specific build rather than the
# general Preview values. No --skip-domain: that flag is production-only ("can only be used with
# production deployments" — confirmed against the real CLI, not assumed from --help text) and
# unnecessary here regardless — a Preview deployment never auto-promotes to a custom domain like
# test.matchboard.football in the first place; we alias it explicitly below either way.
DEPLOY_URL="$(vercel_ deploy --project "$VERCEL_TEST_PROJECT_ID" --yes | tail -1)"
echo "Deployment: ${DEPLOY_URL}"

echo "== Aliasing test.matchboard.football -> this deployment =="
vercel_ alias set "$DEPLOY_URL" test.matchboard.football

COMMENT_BODY="Test slot now serves this PR: **https://test.matchboard.football**

- Commit: \`${GITHUB_SHA:-unknown}\`
- Deployment: ${DEPLOY_URL}
- Neon branch: \`${BRANCH_NAME}\` (isolated, disposable — deleted on close)

Slot returns to \`main\` + persistent Test automatically when this PR closes."

gh pr comment "$PR_NUMBER" --body "$COMMENT_BODY" --edit-last 2>/dev/null \
  || gh pr comment "$PR_NUMBER" --body "$COMMENT_BODY"

echo "== Deploy complete =="
