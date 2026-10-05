#!/usr/bin/env bash
# Deploys the current checked-out `main` commit into the `test` Custom Environment and aliases
# test.matchboard.football to the result — the Test baseline redeploy that runs after
# test-db-migrate.yml's `migrate` job brings the persistent Neon `test` branch's schema up to
# date. See docs/adr/0153-converge-to-single-vercel-project-with-deliberate-acceptance.md.
#
# Must run with DATABASE_URL/DIRECT_URL on the `test` Custom Environment already pointed at the
# persistent Neon `test` branch (the default state restore-baseline-alias.sh maintains) — this
# script does not touch those vars itself, since main's own baseline deploy should always use
# whatever the environment's current default is, never a PR-specific override. The shared
# `test-slot` concurrency group (shared with test-acceptance.yml) guarantees no PR acceptance
# run can be holding that override in place while this script runs.
#
# Required env: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID

set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
: "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"

vercel_() { vercel "$@" --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"; }

echo "== Deploying main to the test Custom Environment =="
DEPLOY_URL="$(vercel_ deploy --target=test --project "$VERCEL_PROJECT_ID" --yes | tail -1)"
echo "Deployment: ${DEPLOY_URL}"

echo "== Aliasing test.matchboard.football -> this deployment =="
vercel_ alias set "$DEPLOY_URL" test.matchboard.football

echo "== Test baseline redeploy complete =="
