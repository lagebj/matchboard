#!/usr/bin/env bash
set -Eeuo pipefail

state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/matchboard-codespace"
pid_file="$state_dir/opencode-web.pid"
log_file="$state_dir/opencode-web.log"

mkdir -p "$state_dir"

bash .devcontainer/sync-agent-skills.sh --best-effort

if [[ -f "$pid_file" ]]; then
  pid="$(cat "$pid_file")"

  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    echo "OpenCode Web is already running with PID $pid."
    exit 0
  fi

  rm -f "$pid_file"
fi

if [[ -z "${OLLAMA_API_KEY:-}" ]]; then
  cat <<'MESSAGE'
OpenCode Web was not started because OLLAMA_API_KEY is missing.

Add OLLAMA_API_KEY as a GitHub Codespaces secret, then restart the
Codespace or run:

  bash .devcontainer/post-start.sh
MESSAGE
  exit 0
fi

nohup bash .devcontainer/start-opencode.sh \
  >"$log_file" 2>&1 </dev/null &

pid=$!
echo "$pid" >"$pid_file"

for _ in {1..30}; do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "OpenCode Web failed to start." >&2
    echo "Log: $log_file" >&2
    cat "$log_file" >&2
    rm -f "$pid_file"
    exit 1
  fi

  if lsof -nP -iTCP:4096 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "OpenCode Web started on port 4096 with PID $pid."
    echo "Log: $log_file"

    workspace="${CODESPACE_VSCODE_FOLDER:-$(git rev-parse --show-toplevel)}"

    echo "Registering OpenCode project: $workspace"

    projects="$(
      curl \
        --fail-with-body \
        --silent \
        --show-error \
        http://127.0.0.1:4096/project
    )"

    if jq -e \
      --arg worktree "$workspace" \
      '.[] | select(.worktree == $worktree)' \
      <<<"$projects" >/dev/null; then

      echo "Matchboard is already registered with OpenCode."
    else
      curl \
        --fail-with-body \
        --silent \
        --show-error \
        -H "Content-Type: application/json" \
        -H "x-opencode-directory: ${workspace}" \
        -X POST \
        http://127.0.0.1:4096/session \
        -d '{"title":"Matchboard"}' \
        >/dev/null

      echo "Registered Matchboard with OpenCode."
    fi

    exit 0
  fi

  sleep 1
done

echo "OpenCode Web did not start listening on port 4096." >&2
echo "Log: $log_file" >&2
cat "$log_file" >&2
exit 1
