#!/usr/bin/env bash
# Shared Vercel REST API helpers for the single-project `test` Custom Environment
# (ADR-0153). Sourced by deploy.sh, cleanup.sh, and restore-baseline-alias.sh — never
# run directly.
#
# Uses the REST API directly rather than `vercel env add`/`vercel list`'s positional
# `[environment]` argument: that argument is documented (and, on the CLI version installed in
# this repo's devcontainer, 58.4.4, enforced) as one of `production|preview|development` only —
# there is no version-independent guarantee an arbitrary Custom Environment slug works there
# across whatever CLI version CI happens to install (`npm install -g vercel` always grabs
# latest, unpinned, so the exact behavior at runtime is not something this script can pin down
# ahead of time). The REST endpoints below are the same stable contracts the Vercel MCP tooling
# itself calls, documented at vercel.com/docs/rest-api.
#
# Required env (set by the caller before sourcing): VERCEL_TOKEN, VERCEL_ORG_ID,
# VERCEL_PROJECT_ID.

set -euo pipefail

: "${VERCEL_TOKEN:?VERCEL_TOKEN is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
: "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is required}"

VERCEL_API_BASE="https://api.vercel.com"

# vercel_api <method> <path-with-leading-slash-and-query> [json-body]
# teamId is appended to every call — VERCEL_ORG_ID is this team's ID, same value already passed
# as `--scope` to every `vercel` CLI call elsewhere in these scripts.
vercel_api() {
  local method="$1" path="$2" body="${3:-}"
  local sep="?"
  if [[ "$path" == *"?"* ]]; then
    sep="&"
  fi
  local url="${VERCEL_API_BASE}${path}${sep}teamId=${VERCEL_ORG_ID}"

  if [ -n "$body" ]; then
    curl -sS --fail-with-body -X "$method" "$url" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -sS --fail-with-body -X "$method" "$url" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}"
  fi
}

# Resolves the `test` Custom Environment's env_* id on the single matchboard project. Required
# because environment-variable scoping to a Custom Environment is done by id, not slug (see
# create_project_env's `customEnvironmentIds`, vercel.com/docs/rest-api/environment).
resolve_test_custom_environment_id() {
  vercel_api GET "/v9/projects/${VERCEL_PROJECT_ID}/custom-environments" \
    | jq -r '.environments[]? | select(.slug == "test") | .id' | head -n1
}

# Resolves the most recent READY deployment of `main` targeting the `test` Custom Environment —
# i.e. the current Test baseline. Used both by restore-baseline-alias.sh (restoring the shared
# slot after a PR's acceptance run or on failure) and by the post-merge baseline-deploy job in
# test-db-migrate.yml (which creates the very deployment this function then finds). Replaces the
# old hardcoded `matchboard-test-git-main-matchboard-app.vercel.app` alias, which only existed
# because `matchboard-test` was a separate, always-auto-deploying project — the single-project
# `test` Custom Environment never auto-deploys from a push (no branch matcher, by design), so
# there is no equivalent static alias to point at; the baseline deployment must be looked up.
resolve_test_baseline_deployment_url() {
  vercel_api GET "/v6/deployments?projectId=${VERCEL_PROJECT_ID}&target=test&state=READY&branch=main&limit=1" \
    | jq -r '.deployments[0].url // empty'
}

# Upserts a `test`-Custom-Environment-scoped env var (sensitive type — these are always DB
# connection strings carrying credentials). Environment-wide, not per-branch: Custom
# Environments don't support the `gitBranch` env var scoping Preview deployments do (the REST
# schema's `gitBranch` field is explicitly only valid with `target=preview`), so a PR's temporary
# override and the persistent-branch default necessarily share one slot — safe only because the
# shared Test slot is itself serialized one-PR-at-a-time (test-slot concurrency group) and every
# caller that sets a temporary PR override (deploy.sh) is paired with one that restores the
# persistent-branch default before releasing that lock (restore-baseline-alias.sh, called by
# cleanup.sh and by both scripts' own failure paths).
upsert_test_env_var() {
  local key="$1" value="$2" env_id body
  env_id="$(resolve_test_custom_environment_id)"
  if [ -z "$env_id" ]; then
    echo "No 'test' Custom Environment found on project ${VERCEL_PROJECT_ID} (ADR-0153 Phase B not yet completed?)." >&2
    return 1
  fi
  body="$(jq -n --arg key "$key" --arg value "$value" --arg envId "$env_id" \
    '{key: $key, value: $value, type: "sensitive", customEnvironmentIds: [$envId]}')"
  vercel_api POST "/v10/projects/${VERCEL_PROJECT_ID}/env?upsert=true" "$body" > /dev/null
}
