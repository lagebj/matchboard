#!/usr/bin/env bash
set -Eeuo pipefail

: "${OLLAMA_API_KEY:?OLLAMA_API_KEY is not set. Add it as a GitHub Codespaces secret.}"
: "${OPENCODE_SERVER_PASSWORD:?OPENCODE_SERVER_PASSWORD is not set. Add it as a GitHub Codespaces secret.}"

export OPENCODE_SERVER_USERNAME="${OPENCODE_SERVER_USERNAME:-lage}"

model="${OLLAMA_MODEL:-qwen3-coder:480b}"
context="${OPENCODE_MODEL_CONTEXT:-262144}"
output="${OPENCODE_MODEL_OUTPUT:-32768}"
skills_root="${XDG_DATA_HOME:-$HOME/.local/share}/matchboard-agent-skills"
instruction_file="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/instructions/matchboard-agent-skills.md"

if ! [[ "$context" =~ ^[0-9]+$ ]] || ! [[ "$output" =~ ^[0-9]+$ ]]; then
  echo "OPENCODE_MODEL_CONTEXT and OPENCODE_MODEL_OUTPUT must be positive integers." >&2
  exit 1
fi

# Runtime-only configuration keeps credentials outside Git while still merging
# with any repository-level opencode.json and .opencode instructions.
export OPENCODE_CONFIG_CONTENT
OPENCODE_CONFIG_CONTENT="$(
  jq -cn \
    --arg model "$model" \
    --argjson context "$context" \
    --argjson output "$output" \
    --arg skills_root "$skills_root/**" \
    --arg instruction_file "$instruction_file" \
    '{
      "$schema": "https://opencode.ai/config.json",
      "model": ("ollama-cloud/" + $model),
      "autoupdate": false,
      "instructions": [$instruction_file],
      "permission": {
        "skill": {"*": "allow"},
        "external_directory": {($skills_root): "allow"},
        "edit": {($skills_root): "deny"}
      },
      "provider": {
        "ollama-cloud": {
          "npm": "@ai-sdk/openai-compatible",
          "name": "Ollama Cloud",
          "options": {
            "baseURL": "https://ollama.com/v1/",
            "apiKey": "{env:OLLAMA_API_KEY}"
          },
          "models": {
            ($model): {
              "name": ("Ollama Cloud · " + $model),
              "limit": {
                "context": $context,
                "output": $output
              }
            }
          }
        }
      }
    }'
)"

cd "${CODESPACE_VSCODE_FOLDER:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

exec opencode web --hostname 0.0.0.0 --port 4096
