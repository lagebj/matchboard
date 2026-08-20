#!/usr/bin/env bash
# Point test.matchboard.football back at main's current deployment (the persistent-Test
# baseline). Used both by cleanup.sh on normal PR close and as the failure path if a deploy
# run breaks partway through — see docs/adr/0075-per-pr-feature-acceptance-pipeline.md's
# "Rollout safety" section: a failed run must never leave the shared slot pointed at a broken
# or deleted deployment.
#
# Required env: VERCEL_TOKEN, VERCEL_ORG_ID

set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"

# Vercel's own Git-integration alias for main's latest deployment — always current, no
# deployment-ID lookup or polling needed.
BASELINE_ALIAS="matchboard-test-git-main-matchboard-app.vercel.app"

echo "== Restoring test.matchboard.football -> ${BASELINE_ALIAS} (main baseline) =="
vercel alias set "$BASELINE_ALIAS" test.matchboard.football \
  --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"
