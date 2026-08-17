#!/usr/bin/env bash
set -Eeuo pipefail

cd "${CONTAINER_WORKSPACE_FOLDER:-/workspaces/matchboard}"

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${DIRECT_URL:?DIRECT_URL is required}"
: "${AUTH_SECRET:?AUTH_SECRET is required}"
: "${AUTH_GOOGLE_ID:?AUTH_GOOGLE_ID is required}"
: "${AUTH_GOOGLE_SECRET:?AUTH_GOOGLE_SECRET is required}"

if [[ "${CODESPACES:-}" == "true" ]]; then
  export AUTH_URL="https://${CODESPACE_NAME}-3333.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
fi

exec npm run dev -- --hostname 0.0.0.0
