#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Usage: sync-agent-skills.sh [--required|--best-effort]

  --required     Fail when a repository cannot be installed and no cached copy exists.
  --best-effort  Keep using the cached copy when an update cannot be fetched.
USAGE
}

mode="${1:---required}"
case "$mode" in
  --required|--best-effort) ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

readonly data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
readonly config_home="${XDG_CONFIG_HOME:-$HOME/.config}"
readonly installation_root="$data_home/matchboard-agent-skills"
readonly repositories_root="$installation_root/repositories"
readonly opencode_config_root="$config_home/opencode"
readonly opencode_skills_root="$opencode_config_root/skills"
readonly instruction_root="$opencode_config_root/instructions"
readonly instruction_file="$instruction_root/matchboard-agent-skills.md"
readonly manifest_file="$installation_root/managed-skills.txt"
readonly workspace="${CODESPACE_VSCODE_FOLDER:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
readonly claude_skills_root="$workspace/.claude/skills"

readonly addy_repository="${ADDY_AGENT_SKILLS_REPOSITORY:-https://github.com/addyosmani/agent-skills.git}"
readonly addy_ref="${ADDY_AGENT_SKILLS_REF:-main}"
readonly lage_repository="${LAGE_AGENT_SKILLS_REPOSITORY:-https://github.com/lagebj/agent-skills.git}"
readonly lage_ref="${LAGE_AGENT_SKILLS_REF:-main}"

mkdir -p \
  "$repositories_root" \
  "$opencode_skills_root" \
  "$instruction_root" \
  "$claude_skills_root"

log() {
  printf '[agent-skills] %s\n' "$*"
}

warn() {
  printf '[agent-skills] WARNING: %s\n' "$*" >&2
}

repository_is_usable() {
  local directory="$1"
  [[ -d "$directory/.git" && -d "$directory/skills" ]]
}

sync_repository() {
  local id="$1"
  local url="$2"
  local ref="$3"
  local directory="$repositories_root/$id"

  if [[ ! -d "$directory/.git" ]]; then
    rm -rf "$directory"
    mkdir -p "$directory"
    git -C "$directory" init --quiet
    git -C "$directory" remote add origin "$url"
  else
    git -C "$directory" remote set-url origin "$url"
  fi

  log "Fetching $id at $ref"
  if git -C "$directory" fetch --quiet --force --prune --depth 1 origin "$ref"; then
    git -C "$directory" checkout --quiet --detach FETCH_HEAD
    git -C "$directory" reset --quiet --hard FETCH_HEAD
    git -C "$directory" clean -q -dffx
  elif repository_is_usable "$directory"; then
    warn "Could not update $id; continuing with the cached copy."
  elif [[ "$mode" == "--best-effort" ]]; then
    warn "Could not install $id and no cached copy exists; this source will be unavailable."
    rm -rf "$directory"
    return 1
  else
    printf '[agent-skills] Failed to install %s from %s at %s.\n' "$id" "$url" "$ref" >&2
    rm -rf "$directory"
    return 1
  fi

  if ! repository_is_usable "$directory"; then
    printf '[agent-skills] Repository %s does not contain a skills directory.\n' "$id" >&2
    return 1
  fi
}

remove_previous_managed_links() {
  [[ -f "$manifest_file" ]] || return 0

  while IFS= read -r skill_name; do
    [[ -n "$skill_name" ]] || continue

    local opencode_target="$opencode_skills_root/$skill_name"
    local claude_target="$claude_skills_root/$skill_name"

    if [[ -L "$opencode_target" ]]; then
      local resolved
      resolved="$(readlink -f "$opencode_target" 2>/dev/null || true)"
      if [[ "$resolved" == "$installation_root"/* ]]; then
        rm -f "$opencode_target"
      fi
    fi

    if [[ -L "$claude_target" ]]; then
      local resolved
      resolved="$(readlink -f "$claude_target" 2>/dev/null || true)"
      if [[ "$resolved" == "$installation_root"/* ]]; then
        rm -f "$claude_target"
      fi
    fi
  done < "$manifest_file"
}

validate_skill() {
  local skill_directory="$1"
  local skill_name
  skill_name="$(basename "$skill_directory")"

  if [[ ! "$skill_name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    warn "Skipping invalid skill directory name: $skill_name"
    return 1
  fi

  local skill_file="$skill_directory/SKILL.md"
  [[ -f "$skill_file" ]] || return 1

  local frontmatter_name
  frontmatter_name="$(
    awk '
      NR == 1 && $0 == "---" { in_frontmatter = 1; next }
      in_frontmatter && $0 == "---" { exit }
      in_frontmatter && /^name:[[:space:]]*/ {
        sub(/^name:[[:space:]]*/, "")
        print
        exit
      }
    ' "$skill_file" | sed -E "s/^[[:space:]]*['\"]?//; s/['\"]?[[:space:]]*$//"
  )"

  if [[ -z "$frontmatter_name" ]]; then
    warn "Skipping $skill_name because SKILL.md has no frontmatter name."
    return 1
  fi

  if [[ "$frontmatter_name" != "$skill_name" ]]; then
    warn "Skipping $skill_name because its frontmatter name is '$frontmatter_name'."
    return 1
  fi
}

link_skill_source() {
  local source_id="$1"
  local source_root="$repositories_root/$source_id/skills"

  [[ -d "$source_root" ]] || return 0

  while IFS= read -r -d '' skill_file; do
    local skill_directory
    local skill_name
    local opencode_target
    local claude_target
    local resolved

    skill_directory="$(dirname "$skill_file")"
    skill_name="$(basename "$skill_directory")"
    opencode_target="$opencode_skills_root/$skill_name"
    claude_target="$claude_skills_root/$skill_name"

    validate_skill "$skill_directory" || continue

    for target in "$opencode_target" "$claude_target"; do
      if [[ -e "$target" || -L "$target" ]]; then
        if [[ -L "$target" ]]; then
          resolved="$(readlink -f "$target" 2>/dev/null || true)"
          if [[ "$resolved" == "$installation_root"/* ]]; then
            rm -f "$target"
          else
            warn "Keeping unmanaged skill '$skill_name' at $target."
            continue
          fi
        else
          warn "Keeping unmanaged skill '$skill_name' at $target."
          continue
        fi
      fi

      ln -s "$skill_directory" "$target"
    done

    printf '%s\n' "$skill_name" >> "$manifest_file.next"
  done < <(find "$source_root" -mindepth 2 -maxdepth 2 -type f -name SKILL.md -print0 | sort -z)
}

write_opencode_instructions() {
  cat > "$instruction_file" <<'INSTRUCTIONS'
# Automatic agent-skill use

For every user request:

1. Inspect the skills advertised by OpenCode before planning or changing files.
2. When one or more skills match the task, load them with the native `skill` tool before acting.
3. Follow the loaded workflow, verification requirements, and exit criteria. Do not bypass a skill because the change appears small.
4. Select skills from the user's `lagebj/agent-skills` collection when they override identically named upstream skills.
5. Do not require the user to name, install, activate, or manually invoke a skill.
6. Load only relevant skills. Do not load every skill into context.
INSTRUCTIONS
}

sync_failure=0
sync_repository "addyosmani-agent-skills" "$addy_repository" "$addy_ref" || sync_failure=1
sync_repository "lagebj-agent-skills" "$lage_repository" "$lage_ref" || sync_failure=1

remove_previous_managed_links
: > "$manifest_file.next"

# Install upstream first. The user's collection is linked second and therefore
# intentionally replaces any identically named managed skill.
link_skill_source "addyosmani-agent-skills"
link_skill_source "lagebj-agent-skills"

sort -u "$manifest_file.next" > "$manifest_file"
rm -f "$manifest_file.next"
write_opencode_instructions

skill_count="$(wc -l < "$manifest_file" | tr -d '[:space:]')"
log "Installed $skill_count skills in $opencode_skills_root"
log "Installed $skill_count skills in $claude_skills_root"
log "OpenCode instructions: $instruction_file"

if [[ "$sync_failure" -ne 0 && "$mode" == "--required" ]]; then
  exit 1
fi
