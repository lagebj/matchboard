#!/usr/bin/env node

/**
 * Deterministic Gate A authority-inventory generator (W5 independent technical review finding
 * W5-R2 — see docs/ui-lab/gate-a-w5-convergence/CHANGED_FILES.md).
 *
 * Reads the four committed `candidate_manifest.json`/`capture-attestation.json` pairs and emits
 * `authority_inventory.csv` with distinct provenance fields (`baseCommitSha`,
 * `approvalRevisionSha`, `captureSourceCommitSha`, `reviewedBranchHeadSha`) instead of the
 * previous single overloaded `revisionSha` column, which conflated W4's un-approved base commit
 * with an approval revision and under/over-counted totals by hand instead of deriving them.
 *
 * Read-only by default (prints to stdout). Writing to the repository requires the explicit
 * `--write` flag — this tool never silently rewrites a committed file (W5-R2: "Do not make an
 * audit command unexpectedly rewrite repository files").
 *
 * Usage:
 *   node scripts/generate-gate-a-authority-inventory.mjs [repoRoot]              # prints CSV to stdout
 *   node scripts/generate-gate-a-authority-inventory.mjs --write [repoRoot]      # writes docs/ui-lab/gate-a-w5-convergence/authority_inventory.csv
 *
 * Exit codes:
 *   0 — generated successfully
 *   1 — a required manifest/attestation file was missing or malformed (refuses to invent a default)
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { buildInventoryRows, loadWaveData, WAVES } from "./lib/gate-a-authority.mjs";

const args = process.argv.slice(2);
const write = args.includes("--write");
const repoRootArg = args.find((a) => !a.startsWith("--"));
const repoRoot = repoRootArg ? String(repoRootArg) : new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const { loadIssues } = loadWaveData(repoRoot, { waves: WAVES });
const fatal = loadIssues.filter((i) => i.severity === "ERROR");
if (fatal.length > 0) {
  console.error("Refusing to generate an inventory from invalid input:");
  for (const issue of fatal) console.error(`  ${issue.severity} ${issue.kind} ${issue.path ?? ""} ${issue.error ?? ""}`.trim());
  process.exit(1);
}

const rows = buildInventoryRows(repoRoot, { waves: WAVES });
const FIELDS = [
  "wave", "scenarioId", "fixtureId", "fixtureVersion", "status",
  "approvedBy", "approvedAt",
  "baseCommitSha", "approvalRevisionSha", "captureSourceCommitSha", "reviewedBranchHeadSha",
  "approvedCaptureCount", "approvedHashesMatchAttestation", "attestationGeneratedAt",
];

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const lines = [FIELDS.join(",")];
for (const row of rows) lines.push(FIELDS.map((f) => csvCell(row[f])).join(","));
const csv = lines.join("\n") + "\n";

if (write) {
  const outPath = join(repoRoot, "docs/ui-lab/gate-a-w5-convergence/authority_inventory.csv");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, csv, "utf-8");
  console.error(`Wrote ${rows.length} rows to ${outPath}`);
} else {
  process.stdout.write(csv);
}
