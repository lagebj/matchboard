#!/usr/bin/env bash
# Visual Authority Gate (ADR-0159) — lightweight, comment-requested deploy of an exact PR
# revision into the `test` Custom Environment.
#
# SECURITY (fixes CodeQL actions/untrusted-checkout/critical, found during this PR's own review,
# not assumed away): this script never checks out the PR's own code onto the GitHub Actions
# runner at all. It creates a Vercel deployment via the REST API's `gitSource` mechanism
# (https://vercel.com/docs/rest-api/deployments/create-a-new-deployment) — Vercel's own
# infrastructure fetches the exact commit directly from GitHub and builds it remotely. The
# privileged runner holding VERCEL_TOKEN/etc. never has the PR's (potentially attacker-authored)
# files in its own working directory, so there is no local script-execution surface for them to
# exploit (unlike checking out the ref and running `vercel deploy` from within it, the pattern
# scripts/test-acceptance/deploy-test-baseline.sh uses for `main`, which is fine because `main`
# is trusted repository content, not PR-controlled content).
#
# Required env: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, GITHUB_REPOSITORY (owner/repo)
# Usage: deploy-pr-revision.sh <sha>

set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
: "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required (owner/repo)}"

SHA="${1:?Usage: deploy-pr-revision.sh <sha>}"
GH_OWNER="${GITHUB_REPOSITORY%%/*}"
GH_REPO="${GITHUB_REPOSITORY##*/}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../test-acceptance/vercel-api.sh
source "${SCRIPT_DIR}/../test-acceptance/vercel-api.sh"

echo "== Creating a Vercel deployment for ${GH_OWNER}/${GH_REPO}@${SHA} (test Custom Environment, gitSource — no local checkout of PR code) =="
BODY="$(jq -n \
  --arg name "matchboard" \
  --arg project "$VERCEL_PROJECT_ID" \
  --arg target "test" \
  --arg ref "$SHA" \
  --arg org "$GH_OWNER" \
  --arg repo "$GH_REPO" \
  '{name: $name, project: $project, target: $target, gitSource: {type: "github", ref: $ref, org: $org, repo: $repo}}')"

DEPLOYMENT="$(vercel_api POST "/v13/deployments?forceNew=1" "$BODY")"
DEPLOYMENT_ID="$(echo "$DEPLOYMENT" | jq -r '.id // empty')"
if [ -z "$DEPLOYMENT_ID" ]; then
  echo "Failed to create deployment: $DEPLOYMENT" >&2
  exit 1
fi
echo "Deployment created: ${DEPLOYMENT_ID}"

echo "== Waiting for the deployment to become READY =="
STATE="QUEUED"
for _ in $(seq 1 60); do
  STATE="$(vercel_api GET "/v13/deployments/${DEPLOYMENT_ID}" | jq -r '.readyState')"
  echo "  readyState=${STATE}"
  case "$STATE" in
    READY) break ;;
    ERROR|CANCELED|BLOCKED)
      echo "Deployment ended in state ${STATE}" >&2
      exit 1
      ;;
  esac
  sleep 10
done
if [ "$STATE" != "READY" ]; then
  echo "Deployment did not become READY within the timeout" >&2
  exit 1
fi

DEPLOY_URL="$(vercel_api GET "/v13/deployments/${DEPLOYMENT_ID}" | jq -r '.url')"
echo "Deployment ready: https://${DEPLOY_URL}"

echo "== Aliasing test.matchboard.football -> this deployment =="
vercel_api POST "/v2/deployments/${DEPLOYMENT_ID}/aliases" \
  "$(jq -n '{alias: "test.matchboard.football"}')" > /dev/null

echo "DEPLOY_URL=https://${DEPLOY_URL}"
echo "== Lightweight visual-review deploy complete =="
