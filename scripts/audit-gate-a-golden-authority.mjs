#!/usr/bin/env node

/**
 * Gate A golden-authority consistency check (read-only).
 *
 * Ports the Gate A W5 handoff bundle's `scripts/audit_gate_a.py`
 * (`.matchboard-work/Matchboard_Gate_A_W5_Golden_Consistency_Implementation_Bundle_2026-10-12/`)
 * to this repo's Node/ESM script conventions, fixing one defect found while running it against
 * this repo's actual manifests: the Python original validated `approval.revisionSha` against a
 * 64-hex SHA-256 pattern, but every wave's manifest records a standard 40-hex git commit SHA
 * there (the 64-hex SHA-256 pattern is only correct for `approvedCaptures[].sha256`). The
 * original script therefore flagged every one of W1-W3's 25 approved entries as
 * `INCOMPLETE_APPROVAL` — a false positive, not a real gap in the approval records. See
 * `docs/ui-lab/gate-a-w5-convergence/AUTOMATED_VALIDATION_AND_REGRESSION.md`.
 *
 * This is metadata-only: it never fetches raw PNG bytes and never approves a golden. It does not
 * replace the normative programme contracts or an owner's explicit visual review.
 *
 * Usage:
 *   node scripts/audit-gate-a-golden-authority.mjs
 *
 * Exit codes:
 *   0 — no ERROR-severity issues found (WARNING issues may still be present)
 *   1 — at least one ERROR-severity issue found
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const REPO_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

const WAVES = {
  W1: "docs/ui-lab/gate-a-w1-candidates",
  W2: "docs/ui-lab/gate-a-w2-candidates",
  W3: "docs/ui-lab/gate-a-w3-candidates",
  W4: "docs/ui-lab/gate-a-w4-candidates",
};

function readJson(relPath, issues) {
  const path = join(REPO_ROOT, relPath);
  if (!existsSync(path)) {
    issues.push({ severity: "ERROR", kind: "MISSING_FILE", path: relPath });
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    issues.push({ severity: "ERROR", kind: "BAD_JSON", path: relPath, error: String(err) });
    return null;
  }
}

function audit() {
  const issues = [];
  const summary = [];
  const allIds = new Set();
  let totalApproved = 0;
  let totalCandidate = 0;

  for (const [wave, rel] of Object.entries(WAVES)) {
    const manifest = readJson(`${rel}/candidate_manifest.json`, issues);
    const attestation = readJson(`${rel}/capture-attestation.json`, issues);
    if (manifest === null) continue;

    const entries = manifest.candidates;
    if (!Array.isArray(entries)) {
      issues.push({ severity: "ERROR", kind: "INVALID_MANIFEST_ENTRIES", wave });
      continue;
    }

    const attByFile = new Map();
    const duplicates = new Set();
    if (attestation && Array.isArray(attestation.captures)) {
      for (const cap of attestation.captures) {
        if (!cap || !cap.file) continue;
        if (attByFile.has(cap.file) && attByFile.get(cap.file) !== cap.sha256) {
          duplicates.add(cap.file);
        }
        attByFile.set(cap.file, cap.sha256);
      }
      for (const file of duplicates) {
        issues.push({ severity: "ERROR", kind: "AMBIGUOUS_ATTESTED_FILE", wave, file });
      }
    }

    let approved = 0;
    let candidate = 0;
    let other = 0;

    for (const entry of entries) {
      const sid = entry.scenarioId;
      if (typeof sid !== "string" || !sid) {
        issues.push({ severity: "ERROR", kind: "EMPTY_SCENARIO", wave });
        continue;
      }
      if (allIds.has(sid)) {
        issues.push({ severity: "ERROR", kind: "DUPLICATE_SCENARIO", wave, scenario: sid });
      }
      allIds.add(sid);

      const version = entry.fixtureVersion;
      if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
        issues.push({ severity: "ERROR", kind: "BAD_FIXTURE_VERSION", wave, scenario: sid });
      }

      const status = entry.status;
      const approval = entry.approval;

      if (status === "APPROVED_GOLDEN") {
        approved += 1;
        const hasValidShape =
          approval &&
          typeof approval === "object" &&
          approval.state === "APPROVED" &&
          !!approval.approvedAt &&
          !!approval.approvedBy &&
          GIT_SHA_PATTERN.test(String(approval.revisionSha ?? ""));
        if (!hasValidShape) {
          issues.push({ severity: "ERROR", kind: "INCOMPLETE_APPROVAL", wave, scenario: sid });
          continue;
        }
        const caps = Array.isArray(approval.approvedCaptures) ? approval.approvedCaptures : [];
        if (caps.length === 0) {
          issues.push({ severity: "ERROR", kind: "NO_APPROVED_CAPTURES", wave, scenario: sid });
        }
        for (const cap of caps) {
          const filename = cap.file;
          const sha = cap.sha256;
          if (!SHA256_PATTERN.test(String(sha ?? ""))) {
            issues.push({ severity: "ERROR", kind: "BAD_APPROVED_SHA", wave, scenario: sid, file: filename });
          } else if (!attByFile.has(filename)) {
            issues.push({ severity: "WARNING", kind: "APPROVED_FILE_NOT_IN_ATT", wave, scenario: sid, file: filename });
          } else if (attByFile.get(filename) !== sha) {
            issues.push({ severity: "ERROR", kind: "HASH_MISMATCH_WITH_ATTESTATION", wave, scenario: sid, file: filename });
          }
        }
      } else if (status === "CANDIDATE") {
        candidate += 1;
        if (approval) {
          issues.push({ severity: "WARNING", kind: "CANDIDATE_HAS_APPROVAL_FIELDS", wave, scenario: sid });
        }
      } else {
        other += 1;
        if (status !== "REVISE" && status !== "REJECT") {
          issues.push({ severity: "WARNING", kind: "UNRECOGNIZED_STATUS", wave, scenario: sid, status });
        }
      }
    }

    totalApproved += approved;
    totalCandidate += candidate;
    summary.push({
      wave,
      entries: entries.length,
      approved,
      candidate,
      other,
      attestedCaptures: attestation && Array.isArray(attestation.captures) ? attestation.captures.length : null,
      sourceCommitSha: attestation ? attestation.sourceCommitSha ?? null : null,
    });
  }

  return {
    repo: REPO_ROOT,
    readOnly: true,
    bytesVerified: false,
    humanVisualReviewPerformed: false,
    ownerApprovalGranted: false,
    waves: summary,
    approvedEntries: totalApproved,
    candidateEntries: totalCandidate,
    goldenAuthorityComplete: totalCandidate === 0 && !issues.some((i) => i.severity === "ERROR"),
    issues,
  };
}

const result = audit();
console.log(JSON.stringify(result, null, 2));
process.exit(result.issues.some((i) => i.severity === "ERROR") ? 1 : 0);
