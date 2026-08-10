#!/usr/bin/env bash
set -Eeuo pipefail

# Matchboard ZAP Baseline Scan
# Passive/safe scan against a local Matchboard instance.
# Does NOT perform active/ddestructive scanning.

ZAP_IMAGE="softwaresecurityproject/zap-stable:2.16.0"
TARGET_URL="${MATCHBOARD_SECURITY_TARGET:-http://host.docker.internal:3333}"
RESULTS_DIR=".security/results"
mkdir -p "$RESULTS_DIR"

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
REPORT="$RESULTS_DIR/zap-baseline-${TIMESTAMP}"

echo "=== Matchboard ZAP Baseline Scan ==="
echo
echo "Target: $TARGET_URL"
echo "Mode:  Passive (baseline)"
echo

# Safety check: refuse production targets
if [[ "$TARGET_URL" == *"matchboard.football"* ]] || [[ "$TARGET_URL" == *"vercel.app"* ]]; then
  echo "ERROR: Target URL appears to be a production endpoint."
  echo "       Baseline scans must target local development instances only."
  echo "       Set MATCHBOARD_SECURITY_TARGET to your local dev instance."
  exit 1
fi

# Safety check: refuse if MATCHBOARD_ALLOW_ACTIVE_SECURITY_SCAN is set
# (baseline must not become active by accident)
if [[ "${MATCHBOARD_ALLOW_ACTIVE_SECURITY_SCAN:-}" == "1" ]]; then
  echo "WARNING: MATCHBOARD_ALLOW_ACTIVE_SECURITY_SCAN is set."
  echo "         This is a baseline (passive) scan, not an active scan."
  echo "         The flag does not change baseline scan behavior."
fi

echo "Checking if Docker is available..."
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is required for ZAP scanning. Install Docker or run ZAP manually."
  exit 1
fi

echo "Checking if target is reachable..."
if ! curl -sf -o /dev/null "$TARGET_URL" 2>/dev/null; then
  echo "ERROR: Target $TARGET_URL is not reachable."
  echo "       Start Matchboard locally first: npm run dev"
  exit 1
fi

echo "Starting ZAP baseline scan..."
echo

docker run --rm \
  -v "$(pwd)/$RESULTS_DIR:/zap/results:rw" \
  --network=host \
  "$ZAP_IMAGE" \
  zap-baseline.py \
  -t "$TARGET_URL" \
  -r "/zap/results/zap-baseline-${TIMESTAMP}.html" \
  -w "/zap/results/zap-baseline-${TIMESTAMP}.md" \
  -j \
  --hook "security/zap/zap-hook.py" \
  || true

echo
echo "Baseline scan complete."
echo "HTML report: $RESULTS_DIR/zap-baseline-${TIMESTAMP}.html"
echo "Markdown report: $RESULTS_DIR/zap-baseline-${TIMESTAMP}.md"