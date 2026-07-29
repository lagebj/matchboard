#!/usr/bin/env bash
set -Eeuo pipefail

cd "${CODESPACE_VSCODE_FOLDER:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

chmod +x .devcontainer/*.sh

bash .devcontainer/sync-agent-skills.sh --required

if command -v corepack >/dev/null 2>&1; then
  corepack enable
fi

install_dependencies() {
  if [[ -f pnpm-lock.yaml ]]; then
    echo "Installing dependencies with pnpm..."
    pnpm install --frozen-lockfile
    return
  fi

  if [[ -f yarn.lock ]]; then
    echo "Installing dependencies with Yarn..."
    if [[ -f .yarnrc.yml ]]; then
      yarn install --immutable
    else
      yarn install --frozen-lockfile
    fi
    return
  fi

  if [[ -f package-lock.json ]]; then
    echo "Installing dependencies with npm ci..."
    npm ci --include=dev
    return
  fi

  if [[ -f package.json ]]; then
    echo "No supported lockfile found; running npm install..."
    npm install --include=dev
    return
  fi

  echo "No package.json found; skipping dependency installation."
}

install_dependencies

printf '\nEnvironment ready.\n'
printf 'Node: %s\n' "$(node --version)"
printf 'npm: %s\n' "$(npm --version)"
printf 'OpenCode: %s\n' "$(opencode --version)"
printf 'Agent skills: %s\n' "$(wc -l < "${XDG_DATA_HOME:-$HOME/.local/share}/matchboard-agent-skills/managed-skills.txt" | tr -d '[:space:]')"
printf '\nRequired Codespaces secrets for automatic OpenCode startup:\n'
printf '  OLLAMA_API_KEY\n'
printf '  OPENCODE_SERVER_PASSWORD\n'
printf '\nStart Matchboard with: bash .devcontainer/start-matchboard.sh\n'
printf 'OpenCode log: %s\n' "${XDG_STATE_HOME:-$HOME/.local/state}/matchboard-codespace/opencode-web.log"
