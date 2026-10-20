#!/usr/bin/env bash
# Visual Authority Gate (ADR-0159) — lightweight, comment-requested deploy of an exact PR
# revision into the `test` Custom Environment. Thin variant of
# scripts/test-acceptance/deploy-test-baseline.sh, parameterized by ref instead of hardcoded to
# `main`. Caller (.github/workflows/visual-review-deploy.yml) is responsible for checking out the
# correct ref before invoking this script — it does not check out anything itself, matching
# deploy-test-baseline.sh's own division of responsibility.
#
# Deliberately does NOT: create or touch a Neon branch, run any migration, deploy the Cloudflare
# Worker, or run the Playwright acceptance suite. This is the lightweight visual-review path
# only — a PR needing any of those belongs on the existing `acceptance` label path instead
# (see scripts/visual-authority/classify.mjs's classifyLightweightDeployEligibility()).
#
# Required env: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
# Usage: deploy-pr-revision.sh <ref-description-for-logging-only>
#   (the actual working directory must already be checked out at the revision to deploy — the
#   argument is used only in log output, `vercel deploy` reads the real checked-out source.)

set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
: "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"

REF_DESCRIPTION="${1:?Usage: deploy-pr-revision.sh <ref-description-for-logging-only> — no implicit default ref is supported}"

vercel_() { vercel "$@" --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"; }

echo "== Deploying ${REF_DESCRIPTION} to the test Custom Environment (lightweight visual-review path) =="
DEPLOY_URL="$(vercel_ deploy --target=test --project "$VERCEL_PROJECT_ID" --yes | tail -1)"
echo "Deployment: ${DEPLOY_URL}"

echo "== Aliasing test.matchboard.football -> this deployment =="
vercel_ alias set "$DEPLOY_URL" test.matchboard.football

echo "DEPLOY_URL=${DEPLOY_URL}"
echo "== Lightweight visual-review deploy complete =="
