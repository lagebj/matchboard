#!/usr/bin/env bash
set -Eeuo pipefail

workspace="${CODESPACE_VSCODE_FOLDER:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$workspace"

: "${OLLAMA_API_KEY:?OLLAMA_API_KEY is not set. Add it as a GitHub Codespaces secret.}"

echo "Starting OpenCode Web"
echo "Workspace: $workspace"
echo "Model: glm-5.1:cloud"

# OpenCode Web attempts to launch a browser. Codespaces is headless.
headless_bin="${XDG_RUNTIME_DIR:-/tmp}/matchboard-headless-bin"
mkdir -p "$headless_bin"

cat > "$headless_bin/xdg-open" <<'EOF'
#!/usr/bin/env bash
echo "Browser launch suppressed in headless environment: $*" >&2
exit 0
EOF

chmod +x "$headless_bin/xdg-open"
export PATH="$headless_bin:$PATH"

exec opencode web \
  --hostname 0.0.0.0 \
  --port 4096
