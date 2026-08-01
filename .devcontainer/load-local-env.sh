#!/usr/bin/env bash

# Codespaces injects its secrets into the environment itself.
# Never load a repository .env over Codespaces secrets.
if [[ "${CODESPACES:-false}" == "true" ]]; then
  return 0 2>/dev/null || exit 0
fi

if [[ -n "${MATCHBOARD_WORKSPACE:-}" ]]; then
  workspace="$MATCHBOARD_WORKSPACE"
else
  workspace="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "$workspace" || ! -f "$workspace/.env" ]]; then
  return 0 2>/dev/null || exit 0
fi

set -a
# shellcheck disable=SC1090
source "$workspace/.env"
set +a
