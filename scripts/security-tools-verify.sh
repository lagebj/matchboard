#!/usr/bin/env bash
set -Eeuo pipefail

echo "=== Matchboard Security Tools Verification ==="
echo

TOOLS_OK=true

check_tool() {
  local name="$1"
  local cmd="$2"
  local expected="$3"
  
  if command -v "$cmd" &>/dev/null; then
    local version
    version=$($cmd $expected 2>/dev/null || echo "unknown")
    printf '  %-20s %s\n' "$name" "$version"
  else
    printf '  %-20s NOT FOUND\n' "$name"
    TOOLS_OK=false
  fi
}

echo "Static analysis tools:"
check_tool "Semgrep" "semgrep" "--version"
check_tool "OSV-Scanner" "osv-scanner" "--version"
check_tool "Gitleaks" "gitleaks" "version"

echo
echo "Application security tools:"
check_tool "Node.js" "node" "--version"
check_tool "npm" "npm" "--version"
check_tool "Vitest" "npx" "vitest --version"

echo
echo "Database tools:"
check_tool "psql" "psql" "--version"
check_tool "neon" "neon" "--version"

echo
echo "Security scripts:"
ls -1 scripts/security-*.sh scripts/zap-*.sh 2>/dev/null | while read -r f; do
  printf '  %-20s %s\n' "$(basename "$f")" "found"
done

echo
echo "Security directories:"
printf '  %-20s %s\n' ".security/results/" "$(test -d .security/results && echo 'found' || echo 'MISSING')"
printf '  %-20s %s\n' "security/semgrep/" "$(test -d security/semgrep && echo 'found' || echo 'MISSING')"
printf '  %-20s %s\n' "security/zap/" "$(test -d security/zap && echo 'found' || echo 'MISSING')"

if [ "$TOOLS_OK" = "false" ]; then
  echo
  echo "Some security tools are missing. Rebuild the devcontainer to install them."
  exit 1
fi

echo
echo "All security tools available."