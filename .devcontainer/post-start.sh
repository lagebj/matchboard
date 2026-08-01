#!/usr/bin/env bash
set -Eeuo pipefail

state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/matchboard-codespace"
pid_file="$state_dir/opencode-web.pid"
log_file="$state_dir/opencode-web.log"

mkdir -p "$state_dir"

echo "Synchronising OpenCode agent skills..."
bash .devcontainer/sync-agent-skills.sh --best-effort

# Local VS Code devcontainer:
# Keep the environment prepared, but do not automatically start OpenCode Web.
# Local development can use the OpenCode TUI directly with:
#
#   opencode
#
if [[ "${CODESPACES:-false}" != "true" ]]; then
  echo "Local devcontainer detected."
  echo "Agent skills are ready."
  echo "OpenCode Web will not be started automatically."
  echo "Run 'opencode' to use the terminal UI."
  exit 0
fi

echo "GitHub Codespaces environment detected."

if [[ -z "${OLLAMA_API_KEY:-}" ]]; then
  cat <<'MESSAGE'
OpenCode Web was not started because OLLAMA_API_KEY is missing.

Add OLLAMA_API_KEY as a GitHub Codespaces secret, then restart the
Codespace or run:

  bash .devcontainer/post-start.sh
MESSAGE

  exit 0
fi

# Handle an existing OpenCode Web process.
if [[ -f "$pid_file" ]]; then
  pid="$(cat "$pid_file")"

  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    if lsof -nP -a \
      -p "$pid" \
      -iTCP:4096 \
      -sTCP:LISTEN \
      >/dev/null 2>&1; then

      echo "OpenCode Web is already running on port 4096 with PID $pid."

      if [[ -n "${CODESPACE_NAME:-}" &&
            -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
        echo
        echo "OpenCode Web:"
        echo "https://${CODESPACE_NAME}-4096.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
      fi

      exit 0
    fi

    echo "Found stale OpenCode process PID $pid. Stopping it."
    kill "$pid" 2>/dev/null || true
  fi

  rm -f "$pid_file"
fi

# Protect against an OpenCode process that is listening but whose PID file
# was lost or removed.
if lsof -nP -iTCP:4096 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 4096 is already in use."
  echo "OpenCode Web will not be started a second time."
  lsof -nP -iTCP:4096 -sTCP:LISTEN || true
  exit 0
fi

echo "Starting OpenCode Web..."

nohup bash .devcontainer/start-opencode.sh \
  >"$log_file" 2>&1 </dev/null &

pid=$!
echo "$pid" >"$pid_file"

# Wait for OpenCode to become available.
for _ in {1..60}; do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "OpenCode Web failed to start." >&2
    echo "Log: $log_file" >&2
    echo >&2
    cat "$log_file" >&2

    rm -f "$pid_file"
    exit 1
  fi

  if lsof -nP -iTCP:4096 -sTCP:LISTEN >/dev/null 2>&1; then
    # Confirm that the HTTP server is actually responding.
    if curl \
      --fail \
      --silent \
      --output /dev/null \
      http://127.0.0.1:4096/project; then

      echo "OpenCode Web started successfully."
      echo "PID: $pid"
      echo "Log: $log_file"

      if [[ -n "${CODESPACE_NAME:-}" &&
            -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
        echo
        echo "OpenCode Web:"
        echo "https://${CODESPACE_NAME}-4096.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
      fi

      echo
      echo "For a new Codespace/browser origin, add the project once in OpenCode:"
      echo "  /workspaces/matchboard"

      exit 0
    fi
  fi

  sleep 1
done

echo "OpenCode Web did not become ready on port 4096 within 60 seconds." >&2
echo "Log: $log_file" >&2
echo >&2
cat "$log_file" >&2

rm -f "$pid_file"
exit 1    )"

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
