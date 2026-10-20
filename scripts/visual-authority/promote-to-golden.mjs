#!/usr/bin/env node
// Visual Authority Gate (ADR-0159) — writes a real `/visual-approve`d revision into a
// candidate_manifest.json's `approval` block, using the exact schema Gate A already established
// (docs/ui-lab/gate-a-w1-candidates/candidate_manifest.json). Available to invoke manually once
// a real approval resolves APPROVED. NOT wired to auto-run inside visual-authority-gate.yml in
// this PR — see ADR-0159's "Deferred, explicitly not in this PR" — a coding agent never calls
// this on its own initiative to assert its own approval; it is only ever run in response to an
// already-verified real approval event.
//
// Usage: node promote-to-golden.mjs <manifestPath> <scenarioId> <approvedBy> <revisionSha> <approvedCapturesJsonPath>

import { readFileSync, writeFileSync } from "node:fs";

const [, , manifestPath, scenarioId, approvedBy, revisionSha, approvedCapturesJsonPath] = process.argv;

if (!manifestPath || !scenarioId || !approvedBy || !revisionSha || !approvedCapturesJsonPath) {
  console.error(
    "Usage: node promote-to-golden.mjs <manifestPath> <scenarioId> <approvedBy> <revisionSha> <approvedCapturesJsonPath>",
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const approvedCaptures = JSON.parse(readFileSync(approvedCapturesJsonPath, "utf8"));

const candidate = manifest.candidates?.find((c) => c.scenarioId === scenarioId);
if (!candidate) {
  console.error(`No candidate with scenarioId "${scenarioId}" found in ${manifestPath}`);
  process.exit(1);
}

candidate.status = "CANDIDATE"; // promotion to APPROVED_GOLDEN is a separate, explicit step
candidate.approval = {
  state: "APPROVED",
  scope: "APPROVED_GOLDEN — design reference only; NOT production implementation authorization",
  approvedAt: new Date().toISOString().slice(0, 10),
  approvedBy,
  revisionSha,
  releaseTag: null,
  releaseStatus: "PENDING — durable GitHub Release creation not yet attempted; approval hashes verified against this PR's own capture-attestation.json in the meantime",
  approvedCaptures,
};

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote approval for ${scenarioId} into ${manifestPath}`);
