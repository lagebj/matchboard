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

if [[ -z "${OLLAMA_API_KEY:-}" || -z "${OPENCODE_SERVER_PASSWORD:-}" ]]; then
  cat <<'MESSAGE'
OpenCode Web was not started because required Codespaces secrets are missing.
Add OLLAMA_API_KEY and OPENCODE_SERVER_PASSWORD, then restart the Codespace or run:

  bash .devcontainer/post-start.sh
MESSAGE
  exit 0
fi

nohup bash .devcontainer/start-opencode.sh >"$log_file" 2>&1 </dev/null &
pid=$!
echo "$pid" >"$pid_file"

for _ in {1..30}; do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "OpenCode Web failed to start. Inspect $log_file" >&2
    rm -f "$pid_file"
    exit 1
  fi

  if lsof -nP -iTCP:4096 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "OpenCode Web started on port 4096 with PID $pid."
    echo "Log: $log_file"
    exit 0
  fi

  sleep 1
done

echo "OpenCode Web is still starting. Inspect $log_file if port 4096 does not appear."
