#!/usr/bin/env bash
set -Eeuo pipefail

state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/matchboard-codespace"
pid_file="$state_dir/opencode-web.pid"

if [[ ! -f "$pid_file" ]]; then
  echo "No OpenCode Web PID file found."
  exit 0
fi

pid="$(cat "$pid_file")"

if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
  kill "$pid"
  for _ in {1..10}; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done

  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL "$pid"
  fi

  echo "Stopped OpenCode Web process $pid."
else
  echo "OpenCode Web process is not running."
fi

rm -f "$pid_file"
