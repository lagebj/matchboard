#!/usr/bin/env bash
set -Eeuo pipefail

echo "=== Matchboard Security Review ==="
echo

RESULTS_DIR=".security/results"
mkdir -p "$RESULTS_DIR"

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
SUMMARY="$RESULTS_DIR/review-${TIMESTAMP}.txt"

echo "Matchboard Security Review - $(date -u +"%Y-%m-%dT%H:%M:%SZ")" > "$SUMMARY"
echo "============================================" >> "$SUMMARY"
echo >> "$SUMMARY"

EXIT_CODE=0

# 1. Tool verification
echo "1. Verifying security tools..."
npm run security:tools 2>&1 | tail -5 >> "$SUMMARY" || true
echo >> "$SUMMARY"

# 2. Forbidden SQL check
echo "2. Checking for forbidden SQL methods..."
npm run security:check-sql >> "$SUMMARY" 2>&1 || { echo "  FAILED: Forbidden SQL methods found"; EXIT_CODE=1; }
echo >> "$SUMMARY"

# 3. Supply chain check
echo "3. Checking supply chain integrity..."
npm run security:check-supply-chain >> "$SUMMARY" 2>&1 || true
echo >> "$SUMMARY"

# 4. Semgrep SAST
echo "4. Running Semgrep SAST scan..."
if command -v semgrep &>/dev/null; then
  npm run security:semgrep >> "$SUMMARY" 2>&1 || true
  echo "  Semgrep results: .security/results/semgrep.json"
else
  echo "  SKIPPED: Semgrep not available" >> "$SUMMARY"
  echo "  SKIPPED: Semgrep not available"
fi
echo >> "$SUMMARY"

# 5. Dependency vulnerability scan
echo "5. Running dependency vulnerability scan..."
if command -v osv-scanner &>/dev/null; then
  npm run security:deps >> "$SUMMARY" 2>&1 || true
  echo "  OSV results: .security/results/osv.json"
else
  echo "  SKIPPED: OSV-Scanner not available" >> "$SUMMARY"
  echo "  SKIPPED: OSV-Scanner not available"
fi
echo >> "$SUMMARY"

# 6. Secret detection
echo "6. Running secret detection..."
if command -v gitleaks &>/dev/null; then
  npm run security:secrets >> "$SUMMARY" 2>&1 || true
  echo "  Gitleaks results: .security/results/gitleaks.json"
else
  echo "  SKIPPED: Gitleaks not available" >> "$SUMMARY"
  echo "  SKIPPED: Gitleaks not available"
fi
echo >> "$SUMMARY"

# 7. Authorization security tests
echo "7. Running authorization security tests..."
if [ -n "${TEST_DATABASE_URL:-}" ]; then
  npm run security:authz >> "$SUMMARY" 2>&1 || { echo "  FAILED: Authorization tests"; EXIT_CODE=1; }
else
  echo "  SKIPPED: TEST_DATABASE_URL not set" >> "$SUMMARY"
  echo "  SKIPPED: TEST_DATABASE_URL not set"
fi
echo >> "$SUMMARY"

echo "============================================" >> "$SUMMARY"
echo "Review complete. See: $SUMMARY" >> "$SUMMARY"

echo
echo "=== Review Complete ==="
echo "Summary: $SUMMARY"
echo "Results: $RESULTS_DIR/"
echo
echo "Note: This was a non-destructive static review."
echo "For runtime DAST testing, run: npm run security:dast:baseline"

exit $EXIT_CODE