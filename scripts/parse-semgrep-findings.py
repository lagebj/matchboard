#!/usr/bin/env python3
"""Parse Semgrep JSON results and report finding count for CI.

Usage:
  python3 scripts/parse-semgrep-findings.py [RESULTS_FILE]

If RESULTS_FILE is not provided, defaults to
.security/results/semgrep-results.json.

Exit codes:
  0 — success (file parsed or not found)
  1 — file exists but could not be parsed
"""

import json
import os
import sys


def parse_findings(results_file: str) -> int:
    if not os.path.isfile(results_file):
        print("0")
        return 0

    try:
        with open(results_file) as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"error: could not parse {results_file}: {e}", file=sys.stderr)
        return 1

    count = len(data.get("results", []))
    print(count)

    if count > 0:
        print(f"::warning::{count} Semgrep findings detected. Review {results_file}")

    return 0


if __name__ == "__main__":
    results_file = sys.argv[1] if len(sys.argv) > 1 else ".security/results/semgrep-results.json"
    sys.exit(parse_findings(results_file))