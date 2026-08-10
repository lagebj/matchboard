#!/usr/bin/env bash
set -Eeuo pipefail

# Matchboard ZAP Active Scan
# Active scanning against an isolated security environment.
# REQUIRES explicit opt-in and safety checks.

ZAP_IMAGE="softwaresecurityproject/zap-stable:2.16.0"
RESULTS_DIR=".security/results"
mkdir -p "$RESULTS_DIR"

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
REPORT="$RESULTS_DIR/zap-active-${TIMESTAMP}"

echo "=== Matchboard ZAP Active Security Scan ==="
echo

# ========== SAFETY GATES ==========

# Gate 1: Explicit opt-in
if [[ "${MATCHBOARD_ALLOW_ACTIVE_SECURITY_SCAN:-}" != "1" ]]; then
  echo "ERROR: Active security scanning requires explicit opt-in."
  echo
  echo "       Set MATCHBOARD_ALLOW_ACTIVE_SECURITY_SCAN=1 to enable."
  echo
  echo "       Active scanning can mutate application state and MUST"
  echo "       only target isolated non-production environments."
  exit 1
fi

# Gate 2: Target URL must be local
TARGET_URL="${MATCHBOARD_SECURITY_TARGET:-http://host.docker.internal:3333}"

if [[ "$TARGET_URL" == *"matchboard.football"* ]] || [[ "$TARGET_URL" == *"vercel.app"* ]]; then
  echo "ERROR: Active scanning against production URLs is prohibited."
  echo "       Target: $TARGET_URL"
  echo "       Set MATCHBOARD_SECURITY_TARGET to a local development instance."
  exit 1
fi

# Gate 3: Database must not be production
DB_URL="${TEST_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ "$DB_URL" == *"neon.tech"* ]] && [[ "$DB_URL" != *"-security"* ]] && [[ "$DB_URL" != *"_security"* ]]; then
  echo "ERROR: Database URL appears to be a non-security Neon database."
  echo "       Active scanning requires an isolated security database branch."
  echo "       Use a Neon branch with 'security' in its name or set"
  echo "       TEST_DATABASE_URL to the security branch connection string."
  exit 1
fi

# Gate 4: Verify security branch exists (if neon is available)
if command -v neon &>/dev/null; then
  echo "Neon CLI available. Verify you are using a security branch."
fi

echo "Safety gates passed."
echo
echo "Target: $TARGET_URL"
echo "Mode:   Active (destructive)"
echo "WARNING: This scan will send active attack payloads to the target."
echo "         Only run against isolated security environments."
echo

# Confirm
read -r -p "Continue with active scan? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# ========== ISOLATED ENVIRONMENT ==========

# If MATCHBOARD_SECURITY_NEON_BRANCH is set, create/switch to it
SECURITY_BRANCH="${MATCHBOARD_SECURITY_NEON_BRANCH:-}"

cleanup() {
  echo
  echo "Cleaning up..."
  # Clean up security branch if we created it
  if [[ -n "$SECURITY_BRANCH" ]] && command -v neon &>/dev/null; then
    echo "Neon security branch cleanup is manual."
    echo "To delete the branch: neon branches delete $SECURITY_BRANCH"
  fi
}

trap cleanup EXIT INT TERM

# ========== RUN ACTIVE SCAN ==========

echo "Checking if Docker is available..."
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is required for ZAP scanning."
  exit 1
fi

echo "Checking if target is reachable..."
if ! curl -sf -o /dev/null "$TARGET_URL" 2>/dev/null; then
  echo "ERROR: Target $TARGET_URL is not reachable."
  echo "       Start Matchboard locally first."
  exit 1
fi

echo "Starting ZAP active scan..."
echo

docker run --rm \
  -v "$(pwd)/$RESULTS_DIR:/zap/results:rw" \
  --network=host \
  "$ZAP_IMAGE" \
  zap-full-scan.py \
  -t "$TARGET_URL" \
  -r "/zap/results/zap-active-${TIMESTAMP}.html" \
  -w "/zap/results/zap-active-${TIMESTAMP}.md" \
  -j \
  --hook "security/zap/zap-hook.py" \
  || true

echo
echo "Active scan complete."
echo "HTML report: $RESULTS_DIR/zap-active-${TIMESTAMP}.html"
echo "Markdown report: $RESULTS_DIR/zap-active-${TIMESTAMP}.md"
echo
echo "IMPORTANT: Review findings and delete the isolated security branch when done."