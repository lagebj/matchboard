/**
 * Shared, read-only loader/audit/inventory logic for Gate A golden-authority tooling.
 *
 * Used by `scripts/audit-gate-a-golden-authority.mjs` (metadata-integrity check, stdout only) and
 * `scripts/generate-gate-a-authority-inventory.mjs` (deterministic inventory file writer). Kept in
 * one module so both tools parse the same four `candidate_manifest.json`/`capture-attestation.json`
 * pairs the same way — see `docs/ui-lab/gate-a-w5-convergence/CHANGED_FILES.md` for the W5
 * technical-review findings (W5-R1/R2) this module exists to fix.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const SHA256_PATTERN = /^[0-9a-f]{64}$/;
export const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

export const WAVES = {
  W1: "docs/ui-lab/gate-a-w1-candidates",
  W2: "docs/ui-lab/gate-a-w2-candidates",
  W3: "docs/ui-lab/gate-a-w3-candidates",
  W4: "docs/ui-lab/gate-a-w4-candidates",
};

/**
 * Authoritative expected-scenario registry (`25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` +
 * `20_UI_LAB_CANDIDATE_WAVES.md`, cross-checked against the W1-W4 `*_REVIEW.md` records this
 * session verified against GitHub — see `docs/ui-lab/gate-a-w5-convergence/SOURCE_RECONCILIATION.md`).
 * 38 manifest entries / 39 logical scenario IDs: A07-S1 and A07-S2 intentionally share one
 * manifest entry (`A07-S1/A07-S2`), per `A03_A07_A09_REVIEW.md` ("S1 has no distinct end-state of
 * its own"). An expected ID absent from a wave's manifest is a `MISSING_EXPECTED_SCENARIO` error,
 * not silently-accepted scope reduction — if a future authoritative programme revision changes
 * this set, this registry must be updated explicitly as part of that change, not inferred from
 * whatever a manifest happens to contain.
 */
export const EXPECTED_SCENARIOS = {
  W1: ["A01", "A02", "A06", "A12"],
  W2: ["A04-S1", "A04-S2", "A04-S3", "A04-S4", "A04-S5", "A04-S6"],
  W3: [
    "A03-S1", "A03-S2", "A03-S3", "A03-S4",
    "A07-S1/A07-S2", "A07-S3", "A07-S4", "A07-S5", "A07-S6",
    "A09-S1", "A09-S2", "A09-S3", "A09-S4", "A09-S5", "A09-S6",
  ],
  W4: [
    "A05-disabled", "A05-enabled-with-pattern", "A05-enabled-without-pattern", "A05-unavailable",
    "A08-off", "A08-on-strong-pattern", "A08-on-no-insight",
    "A10-review-alternative-success", "A10-stale-proposal-blocked", "A10-disabled-or-failed",
    "A11-coach-text-and-parsed-evidence", "A11-profile-change-review-guarded", "A11-profile-change-review-rejected",
  ],
};

/** Logical scenario-ID count (39) — A07-S1/A07-S2's shared entry counts as 2 here, 1 as a manifest entry. */
export function expectedLogicalScenarioCount() {
  return Object.values(EXPECTED_SCENARIOS).reduce(
    (sum, ids) => sum + ids.reduce((n, id) => n + (id.includes("/") ? id.split("/").length : 1), 0),
    0,
  );
}

function readJson(repoRoot, relPath, issues) {
  const path = join(repoRoot, relPath);
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

/**
 * Reads and lightly structures the four wave pairs. Pure data loading — every integrity judgement
 * lives in `auditGateA`, not here, so `generate-gate-a-authority-inventory.mjs` can reuse this
 * without re-deriving audit semantics.
 */
export function loadWaveData(repoRoot, { waves = WAVES } = {}) {
  const issues = [];
  const result = {};
  for (const [wave, rel] of Object.entries(waves)) {
    const manifest = readJson(repoRoot, `${rel}/candidate_manifest.json`, issues);
    const attestation = readJson(repoRoot, `${rel}/capture-attestation.json`, issues);
    const entries = manifest && Array.isArray(manifest.candidates) ? manifest.candidates : null;
    if (manifest !== null && entries === null) {
      issues.push({ severity: "ERROR", kind: "INVALID_MANIFEST_ENTRIES", wave });
    }
    const attByFile = new Map();
    if (attestation && Array.isArray(attestation.captures)) {
      for (const cap of attestation.captures) {
        if (!cap || !cap.file) continue;
        attByFile.set(cap.file, cap.sha256);
      }
    }
    result[wave] = { rel, manifest, attestation, entries, attByFile };
  }
  return { waveData: result, loadIssues: issues };
}

/**
 * Full metadata-integrity audit. `expectedScenarios` is injectable (defaults to the real
 * `EXPECTED_SCENARIOS` registry) purely so tests can exercise the completion logic against small
 * synthetic fixtures without hand-maintaining a 39-ID duplicate list — production callers (the CLI
 * scripts) always use the default.
 */
export function auditGateA(repoRoot, { waves = WAVES, expectedScenarios = EXPECTED_SCENARIOS } = {}) {
  const { waveData, loadIssues } = loadWaveData(repoRoot, { waves });
  const issues = [...loadIssues];
  const summary = [];
  const allIds = new Set();
  let totalApproved = 0;
  let totalPending = 0;

  for (const [wave, rel] of Object.entries(waves)) {
    const { manifest, attestation, entries, attByFile } = waveData[wave];
    if (manifest === null || entries === null) {
      summary.push({ wave, entries: 0, approved: 0, pending: 0, other: 0, attestedCaptures: null, captureSourceCommitSha: null });
      continue;
    }

    const duplicateFiles = new Set();
    const seenFileHash = new Map();
    if (attestation && Array.isArray(attestation.captures)) {
      for (const cap of attestation.captures) {
        if (!cap || !cap.file) continue;
        if (seenFileHash.has(cap.file) && seenFileHash.get(cap.file) !== cap.sha256) duplicateFiles.add(cap.file);
        seenFileHash.set(cap.file, cap.sha256);
      }
      for (const file of duplicateFiles) issues.push({ severity: "ERROR", kind: "AMBIGUOUS_ATTESTED_FILE", wave, file });
    }

    const seenInWave = new Set();
    let approved = 0;
    let pending = 0; // CANDIDATE, REVISE, REJECT — anything not APPROVED_GOLDEN but a recognized state
    let other = 0; // unrecognized status — always an integrity error, never "harmless"

    for (const entry of entries) {
      const sid = entry.scenarioId;
      if (typeof sid !== "string" || !sid) {
        issues.push({ severity: "ERROR", kind: "EMPTY_SCENARIO", wave });
        continue;
      }
      if (allIds.has(sid)) issues.push({ severity: "ERROR", kind: "DUPLICATE_SCENARIO", wave, scenario: sid });
      allIds.add(sid);
      seenInWave.add(sid);

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
        const themesByGroup = new Map();
        const viewportsSeen = new Set();
        for (const cap of caps) {
          const filename = cap.file;
          const sha = cap.sha256;
          if (!SHA256_PATTERN.test(String(sha ?? ""))) {
            issues.push({ severity: "ERROR", kind: "BAD_APPROVED_SHA", wave, scenario: sid, file: filename });
          } else if (!attByFile.has(filename)) {
            // Promoted from WARNING (W5-R1): an approved golden whose capture evidence cannot be
            // located in the wave's own committed attestation is not reproducible evidence — the
            // same class of gap W5-F03 found and fixed for W2, now enforced structurally.
            issues.push({ severity: "ERROR", kind: "APPROVED_FILE_NOT_IN_ATT", wave, scenario: sid, file: filename });
          } else if (attByFile.get(filename) !== sha) {
            issues.push({ severity: "ERROR", kind: "HASH_MISMATCH_WITH_ATTESTATION", wave, scenario: sid, file: filename });
          }
          if (cap.viewport) {
            viewportsSeen.add(cap.viewport);
            const key = `${cap.viewport}::${cap.interactionState ?? ""}`;
            if (!themesByGroup.has(key)) themesByGroup.set(key, new Set());
            if (cap.theme) themesByGroup.get(key).add(cap.theme);
          }
        }
        // Structural completeness (W5-R1 criterion 4: "all required captures defined by its
        // contract"), derived from the contract's own symmetry requirements
        // (`21_FIXTURE_CAPTURE_AND_AUTHORITY.md`: "the same fixture revision must be used for
        // desktop/light and mobile/dark comparisons") rather than an invented per-scenario count.
        for (const required of ["desktop", "mobile"]) {
          if (!viewportsSeen.has(required)) {
            issues.push({ severity: "ERROR", kind: "MISSING_REQUIRED_VIEWPORT", wave, scenario: sid, viewport: required });
          }
        }
        for (const [group, themes] of themesByGroup) {
          const missing = ["dark", "light"].filter((t) => !themes.has(t));
          if (missing.length > 0) {
            issues.push({ severity: "ERROR", kind: "MISSING_THEME_PAIR", wave, scenario: sid, group, missingThemes: missing });
          }
        }
      } else if (status === "CANDIDATE" || status === "REVISE" || status === "REJECT") {
        pending += 1;
        if (status === "CANDIDATE" && approval) {
          issues.push({ severity: "WARNING", kind: "CANDIDATE_HAS_APPROVAL_FIELDS", wave, scenario: sid });
        }
      } else {
        // An unrecognized status can't be trusted to mean "pending" — treat it as an integrity
        // error rather than silently excluding it from both the approved and pending counts
        // (W5-R1: "Do not assume that an unrecognized status is harmless").
        other += 1;
        issues.push({ severity: "ERROR", kind: "UNRECOGNIZED_STATUS", wave, scenario: sid, status: status ?? null });
      }
    }

    for (const expectedId of expectedScenarios[wave] ?? []) {
      if (!seenInWave.has(expectedId)) {
        issues.push({ severity: "ERROR", kind: "MISSING_EXPECTED_SCENARIO", wave, scenario: expectedId });
      }
    }

    totalApproved += approved;
    totalPending += pending + other;
    summary.push({
      wave,
      entries: entries.length,
      approved,
      pending,
      other,
      attestedCaptures: attestation && Array.isArray(attestation.captures) ? attestation.captures.length : null,
      captureSourceCommitSha: attestation ? attestation.sourceCommitSha ?? null : null,
    });
  }

  // `expectedTotal` counts manifest ENTRIES (38) — A07-S1/A07-S2's shared entry is one element of
  // its wave's array — which is the correct denominator for completion math below, since
  // `totalApproved` likewise increments once per manifest entry. `expectedLogicalIds` (39) is
  // reported separately, purely informational (matches the baseline's "39 logical scenario IDs").
  const expectedTotal = Object.values(expectedScenarios).reduce((n, ids) => n + ids.length, 0);
  const expectedLogicalIds = Object.values(expectedScenarios).reduce(
    (n, ids) => n + ids.reduce((m, id) => m + (id.includes("/") ? id.split("/").length : 1), 0),
    0,
  );
  const hasErrors = issues.some((i) => i.severity === "ERROR");

  // Positive-requirement completion (W5-R1): every expected scenario present AND APPROVED_GOLDEN
  // AND zero integrity errors of ANY kind. A CANDIDATE/REVISE/REJECT entry is correctly excluded
  // from `approved`, so `approved === expectedTotal` already fails whenever any expected scenario
  // isn't APPROVED_GOLDEN — no separate "totalCandidate === 0" check is needed or sufficient on
  // its own (that was W5-R1's root cause: it ignored REVISE/REJECT/missing entirely).
  const allExpectedScenariosPresent = !issues.some((i) => i.kind === "MISSING_EXPECTED_SCENARIO");
  const allApprovedGolden = allExpectedScenariosPresent && totalApproved === expectedTotal;
  const goldenAuthorityComplete = allApprovedGolden && !hasErrors;

  return {
    repo: repoRoot,
    readOnly: true,
    waves: summary,
    expectedScenarios: {
      totalManifestEntries: expectedTotal,
      totalLogicalScenarioIds: expectedLogicalIds,
      approved: totalApproved,
      pending: totalPending,
      missing: issues.filter((i) => i.kind === "MISSING_EXPECTED_SCENARIO").map((i) => `${i.wave}:${i.scenario}`),
    },
    approvedEntries: totalApproved,
    pendingEntries: totalPending,
    completionCriteria: {
      allExpectedScenariosPresent,
      allApprovedGolden,
      zeroIntegrityErrors: !hasErrors,
    },
    goldenAuthorityComplete,
    // What `goldenAuthorityComplete: true` would and would NOT mean — kept explicit per W5-R1
    // ("the script's output must make these distinctions explicit") rather than left to a reader's
    // assumption. These are structural facts about this script, not per-run measurements, so they
    // do not vary with `goldenAuthorityComplete`'s value.
    scopeDisclaimer: {
      metadataConsistencyOnly: "This script compares committed JSON records against each other (manifest vs. attestation hashes, expected-scenario presence, approval-field shape). It never downloads or re-hashes the actual PNG bytes a capture filename refers to.",
      doesNotVerify: [
        "Raw screenshot byte integrity beyond the committed attestation's own recorded hash (see docs/ui-lab/gate-a-w5-convergence/VISUAL_COVERAGE_AND_CAPTURE.md for the separate, manual CI-artifact byte re-verification this repo's W5 audit performed).",
        "Durable off-git asset storage / GitHub Release existence (D7 strategy) — always unconfirmed by this script.",
        "Human visual review quality — `approval.approvedBy`/`approvedAt` presence proves a recorded decision exists, not that the reviewer's visual judgement was sound.",
        "Production implementation authorization — never inferred from any result this script can produce.",
      ],
    },
    issues,
  };
}

/**
 * Deterministic inventory rows — one per manifest entry, ordered by `waves` insertion order then
 * manifest array order (never re-sorted by a volatile key), suitable for CSV/JSON generation.
 * Distinguishes provenance fields that the pre-W5-R2 inventory conflated into a single
 * `revisionSha`/`attestationSourceCommitSha` pair (see
 * docs/ui-lab/gate-a-w5-convergence/CHANGED_FILES.md, finding W5-R2).
 */
export function buildInventoryRows(repoRoot, { waves = WAVES } = {}) {
  const { waveData } = loadWaveData(repoRoot, { waves });
  const rows = [];
  for (const wave of Object.keys(waves)) {
    const { manifest, attestation, entries, attByFile } = waveData[wave];
    if (!manifest || !entries) continue;
    for (const entry of entries) {
      const approval = entry.approval ?? null;
      const approvedCaptureCount = approval && Array.isArray(approval.approvedCaptures) ? approval.approvedCaptures.length : 0;
      let approvedHashesMatchAttestation = null;
      if (approval && Array.isArray(approval.approvedCaptures)) {
        approvedHashesMatchAttestation = approval.approvedCaptures.every((cap) => attByFile.get(cap.file) === cap.sha256);
      }
      rows.push({
        wave,
        scenarioId: entry.scenarioId,
        fixtureId: entry.fixtureId ?? null,
        fixtureVersion: entry.fixtureVersion ?? null,
        status: entry.status,
        approvedBy: approval?.approvedBy ?? null,
        approvedAt: approval?.approvedAt ?? null,
        baseCommitSha: manifest.baseCommitSha ?? null,
        approvalRevisionSha: approval?.revisionSha ?? null,
        captureSourceCommitSha: attestation?.sourceCommitSha ?? null,
        reviewedBranchHeadSha: attestation?.reviewedBranchHeadSha ?? null,
        approvedCaptureCount,
        approvedHashesMatchAttestation,
        attestationGeneratedAt: attestation?.generatedAt ?? null,
      });
    }
  }
  return rows;
}
