#!/usr/bin/env node

/**
 * Deterministic Gate A authority-inventory generator (W5 independent technical review findings
 * W5-R2, hardened by W5-R5 — see docs/ui-lab/gate-a-w5-convergence/CHANGED_FILES.md).
 *
 * Reads the four committed `candidate_manifest.json`/`capture-attestation.json` pairs and emits
 * `authority_inventory.csv` with distinct provenance fields (`baseCommitSha`,
 * `approvalRevisionSha`, `captureSourceCommitSha`, `reviewedBranchHeadSha`) instead of the
 * previous single overloaded `revisionSha` column, which conflated W4's un-approved base commit
 * with an approval revision and under/over-counted totals by hand instead of deriving them.
 *
 * Before writing, runs the SAME semantic audit `audit-gate-a-golden-authority.mjs` does (via the
 * shared `auditGateA()`, never a duplicated check) and refuses to generate when any ERROR-severity
 * issue is present — a duplicate or unexpected scenario ID, a missing expected scenario, invalid
 * approval metadata, or a capture-hash mismatch all block generation (W5-R5). A merely INCOMPLETE
 * golden authority does NOT block it: W4's 13 `CANDIDATE` entries are valid records with an
 * outstanding owner decision, not an invalid inventory, and must remain generatable.
 *
 * Read-only by default (prints to stdout). Writing to the repository requires the explicit
 * `--write` flag — this tool never silently rewrites a committed file (W5-R2: "Do not make an
 * audit command unexpectedly rewrite repository files"), and a rejected (invalid-input) run never
 * touches an existing committed CSV either.
 *
 * Usage:
 *   node scripts/generate-gate-a-authority-inventory.mjs [repoRoot]              # prints CSV to stdout
 *   node scripts/generate-gate-a-authority-inventory.mjs --write [repoRoot]      # writes docs/ui-lab/gate-a-w5-convergence/authority_inventory.csv
 *
 * Exit codes:
 *   0 — generated successfully
 *   1 — invalid input: a required file was missing/malformed, or the shared audit found an
 *       ERROR-severity integrity issue (refuses to invent a default or generate from bad data)
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { auditGateA, buildInventoryRows, WAVES } from "./lib/gate-a-authority.mjs";

const args = process.argv.slice(2);
const write = args.includes("--write");
const repoRootArg = args.find((a) => !a.startsWith("--"));
const repoRoot = repoRootArg ? String(repoRootArg) : new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const audit = auditGateA(repoRoot, { waves: WAVES });
const fatal = audit.issues.filter((i) => i.severity === "ERROR");
if (fatal.length > 0) {
  console.error("Refusing to generate an inventory from invalid input:");
  for (const issue of fatal) console.error(`  ${issue.severity} ${issue.kind} ${JSON.stringify(issue)}`.trim());
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
