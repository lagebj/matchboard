#!/usr/bin/env node

/**
 * The canonical local quality gate (Consolidation Programme C7 / F7). Runs EVERY validation step
 * and reports a summary at the end — a failing step no longer aborts the chain and silently
 * hides the steps after it (the old `a && b && c && ...` behaviour). Exit code is non-zero iff
 * any step failed.
 *
 * `policy:verify`'s rebuild-hash comparison is advisory off amd64 (`x64`) — see ARR-0037 and
 * `scripts/policy-verify.mjs`. Every other step here is architecture-independent. CI runs these
 * as individual jobs (`.github/workflows/ci-checks.yml`); this script is the developer-facing
 * equivalent, kept in step with those.
 *
 * Usage:  npm run validate            (all steps)
 *         npm run validate -- --fast  (skip `test` + `build`, the two slow steps)
 */

import { spawnSync } from "node:child_process";

const FAST = process.argv.includes("--fast");

/** [label, npm script, { slow? }] */
const STEPS = [
  ["lint", "lint"],
  ["typecheck", "typecheck"],
  ["typecheck (workers)", "typecheck:workers"],
  ["unit + component tests", "test", { slow: true }],
  ["worker tests", "test:workers", { slow: true }],
  ["build", "build", { slow: true }],
  ["policy verify", "policy:verify"],
  ["version verify", "version:verify"],
  ["terminology check", "terminology:check"],
  ["architecture check", "architecture:check"],
  ["prisma query fields", "prisma:check-fields"],
  ["forbidden SQL", "security:check-sql"],
  ["supply chain", "security:check-supply-chain"],
  ["docs check", "docs:check"],
];

const results = [];
for (const [label, script, opts] of STEPS) {
  if (FAST && opts?.slow) {
    results.push({ label, status: "skipped" });
    continue;
  }
  process.stdout.write(`\n▶ ${label} (npm run ${script})\n`);
  const started = Date.now();
  const r = spawnSync("npm", ["run", "--silent", script], { stdio: "inherit", env: process.env });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  results.push({ label, status: r.status === 0 ? "pass" : "FAIL", secs });
}

console.log("\n=== validate summary ===");
for (const { label, status, secs } of results) {
  const tag = status === "pass" ? "✓" : status === "skipped" ? "–" : "✗";
  console.log(`  ${tag} ${label}${secs ? `  (${secs}s)` : ""}${status === "FAIL" ? "  FAILED" : ""}`);
}

const failed = results.filter((r) => r.status === "FAIL");
if (failed.length > 0) {
  console.log(`\n${failed.length} step(s) failed: ${failed.map((f) => f.label).join(", ")}`);
  process.exit(1);
}
console.log(`\nAll ${results.filter((r) => r.status === "pass").length} step(s) passed.`);
