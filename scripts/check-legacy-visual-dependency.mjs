#!/usr/bin/env node

/**
 * ADR-0158 maintenance gate: fail when active source or current docs introduce a new
 * "Product Surface 1.0" (ADR-0130, superseded 2026-09-10 by the Touchline visual system)
 * reference. Historical ADR/archive content is exempt by design -- only active implementation
 * and current-contract docs are scanned.
 *
 * This is a regression gate, not a migration tool: Touchline convergence is already complete
 * (ADR-0157). Every current mention below is an explicitly reviewed, allowed exception --
 * historical framing or a documented deprecated no-op, never an active instruction to use
 * Product Surface 1.0. A new match outside this allowlist fails the check.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PATTERN = /Product Surface 1\.0|ProductSurface1|product-surface-1/;

const SCAN_GLOBS = ["src", "docs"];
const EXCLUDE_DIR_SEGMENTS = ["/docs/adr/", "/docs/arr/", "/node_modules/", "/generated/"];

/** path -> allowed line count. A file not listed here may not contain the pattern at all. */
const ALLOWLIST = {
  "src/app/(app)/o/[orgSlug]/reviews/review-list-client.tsx": 1,
  "src/components/ui/tactical-surface.tsx": 1,
  "docs/product/adaptive-interaction-design.md": 2,
  "src/app/globals.css": 1,
  "src/app/touchline.css": 3,
};

function listFiles() {
  const out = execFileSync("git", ["ls-files", ...SCAN_GLOBS], { encoding: "utf8" });
  return out
    .split("\n")
    .filter(Boolean)
    .filter((p) => !EXCLUDE_DIR_SEGMENTS.some((seg) => `/${p}/`.includes(seg)));
}

const violations = [];
for (const path of listFiles()) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  const matches = content.split("\n").filter((line) => PATTERN.test(line)).length;
  if (matches === 0) continue;

  const allowed = ALLOWLIST[path] ?? 0;
  if (matches > allowed) {
    violations.push({ path, matches, allowed });
  }
}

// Also flag an allowlisted file that no longer contains the pattern at all, so the allowlist
// stays accurate rather than accumulating stale entries (PAC-016: compatibility must be
// explicit and have a stated removal condition).
for (const [path, allowed] of Object.entries(ALLOWLIST)) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    violations.push({ path, matches: 0, allowed, stale: true });
    continue;
  }
  const matches = content.split("\n").filter((line) => PATTERN.test(line)).length;
  if (matches === 0) {
    violations.push({ path, matches: 0, allowed, stale: true });
  }
}

if (violations.length === 0) {
  console.log("✓ No unreviewed Product Surface 1.0 references found.");
  process.exit(0);
}

console.error("✗ Legacy visual-system dependency check failed:\n");
for (const v of violations) {
  if (v.stale) {
    console.error(
      `  ${v.path}: allowlisted for ${v.allowed} reference(s) but none remain -- remove it from ALLOWLIST in scripts/check-legacy-visual-dependency.mjs.`,
    );
  } else {
    console.error(
      `  ${v.path}: found ${v.matches} Product Surface 1.0 reference(s), allowlist permits ${v.allowed}.`,
    );
  }
}
console.error(
  "\nIf this is genuinely historical/compatibility framing (not an active instruction to use " +
    "Product Surface 1.0), add it to ALLOWLIST in this script with a reason. Otherwise remove the reference.",
);
process.exit(1);
