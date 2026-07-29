#!/usr/bin/env bash
set -Eeuo pipefail

workspace="${CODESPACE_VSCODE_FOLDER:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$workspace"

chmod +x .devcontainer/*.sh

echo "[devcontainer] Synchronising OpenCode agent skills..."
bash .devcontainer/sync-agent-skills.sh --required

if [[ ! -f package.json ]]; then
  echo "[devcontainer] package.json not found." >&2
  exit 1
fi

if [[ ! -f package-lock.json ]]; then
  echo "[devcontainer] package-lock.json not found." >&2
  echo "[devcontainer] Matchboard expects npm with a committed lockfile." >&2
  exit 1
fi

echo "[devcontainer] Installing dependencies with npm ci..."
npm ci --include=dev

echo
echo "Environment ready."
printf 'Node: %s\n' "$(node --version)"
printf 'npm: %s\n' "$(npm --version)"
printf 'OpenCode: %s\n' "$(opencode --version)"

skills_file="${XDG_DATA_HOME:-$HOME/.local/share}/matchboard-agent-skills/managed-skills.txt"

if [[ -f "$skills_file" ]]; then
  printf 'Agent skills: %s\n' "$(wc -l < "$skills_file" | tr -d '[:space:]')"
fi

echo
echo "Local devcontainer:"
echo "  Start Matchboard: bash .devcontainer/start-matchboard.sh"
echo "  Start OpenCode:   opencode"

if [[ "${CODESPACES:-false}" == "true" ]]; then
  echo
  echo "Codespaces:"
  echo "  OLLAMA_API_KEY must be configured as a Codespaces secret."
  echo "  OpenCode Web starts automatically through post-start.sh."
  printf '  OpenCode log: %s\n' \
    "${XDG_STATE_HOME:-$HOME/.local/state}/matchboard-codespace/opencode-web.log"
fi
