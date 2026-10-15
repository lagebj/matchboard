import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { auditGateA, buildInventoryRows, EXPECTED_SCENARIOS, expectedLogicalScenarioCount, loadWaveData } from "../lib/gate-a-authority.mjs";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const AUDIT_SCRIPT = join(REPO_ROOT, "scripts", "audit-gate-a-golden-authority.mjs");
const GENERATE_SCRIPT = join(REPO_ROOT, "scripts", "generate-gate-a-authority-inventory.mjs");

const tmpDirs: string[] = [];
afterAll(() => tmpDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function makeRepoRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "gate-a-authority-"));
  tmpDirs.push(dir);
  return dir;
}

function writeWave(repoRoot: string, relDir: string, manifest: unknown, attestation: unknown) {
  const full = join(repoRoot, relDir);
  mkdirSync(full, { recursive: true });
  writeFileSync(join(full, "candidate_manifest.json"), JSON.stringify(manifest, null, 2));
  if (attestation !== undefined) writeFileSync(join(full, "capture-attestation.json"), JSON.stringify(attestation, null, 2));
}

function runCli(script: string, args: string[]): { code: number; out: string; err: string } {
  try {
    const out = execFileSync(process.execPath, [script, ...args], { cwd: REPO_ROOT, encoding: "utf8" });
    return { code: 0, out, err: "" };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: err.stdout ?? "", err: err.stderr ?? "" };
  }
}

const SHA40_A = "a".repeat(40);
const SHA40_B = "b".repeat(40);
const SHA64_1 = "1".repeat(64);
const SHA64_2 = "2".repeat(64);
const SHA64_3 = "3".repeat(64);
const SHA64_4 = "4".repeat(64);

/** The 4 minimal captures (desktop/mobile x dark/light) needed to satisfy the structural checks. */
function minimalCaptureSet(filePrefix: string, shas: [string, string, string, string] = [SHA64_1, SHA64_2, SHA64_3, SHA64_4]) {
  return [
    { viewport: "desktop", theme: "dark", interactionState: "initial", file: `${filePrefix}-desktop-dark.png`, sha256: shas[0] },
    { viewport: "desktop", theme: "light", interactionState: "initial", file: `${filePrefix}-desktop-light.png`, sha256: shas[1] },
    { viewport: "mobile", theme: "dark", interactionState: "initial", file: `${filePrefix}-mobile-dark.png`, sha256: shas[2] },
    { viewport: "mobile", theme: "light", interactionState: "initial", file: `${filePrefix}-mobile-light.png`, sha256: shas[3] },
  ];
}

function approvedEntry(scenarioId: string, filePrefix: string, overrides: Record<string, unknown> = {}) {
  const captures = minimalCaptureSet(filePrefix);
  return {
    scenarioId,
    status: "APPROVED_GOLDEN",
    fixtureId: `fixture-${filePrefix}`,
    fixtureVersion: 1,
    approval: {
      state: "APPROVED",
      approvedAt: "2026-10-09",
      approvedBy: "Test Owner",
      revisionSha: SHA40_A,
      approvedCaptures: captures.map(({ viewport, theme, interactionState, file, sha256 }) => ({ viewport, theme, interactionState, file, sha256 })),
    },
    ...overrides,
  };
}

function candidateEntry(scenarioId: string, overrides: Record<string, unknown> = {}) {
  return { scenarioId, status: "CANDIDATE", fixtureId: `fixture-${scenarioId}`, fixtureVersion: 1, ...overrides };
}

function attestationFor(...entries: Array<ReturnType<typeof approvedEntry>>) {
  // Deep-copy each capture record — the attestation and the manifest's approval are separate
  // files in reality, so a test that mutates one (e.g. to simulate a hash mismatch) must not
  // silently mutate the other via a shared object reference.
  const captures = entries.flatMap((e) => (e.approval ? e.approval.approvedCaptures.map((c: unknown) => ({ ...(c as object) })) : []));
  return { sourceCommitSha: SHA40_B, generatedAt: "2026-10-09T00:00:00.000Z", captures };
}

describe("auditGateA — completion semantics (W5-R1)", () => {
  it("1. all expected scenarios approved with complete valid records: metadata audit passes and golden authority is complete", () => {
    const repoRoot = makeRepoRoot();
    const waves: Record<string, string> = {};
    const manifestEntries: Record<string, ReturnType<typeof approvedEntry>[]> = {};
    for (const [wave, ids] of Object.entries(EXPECTED_SCENARIOS)) {
      waves[wave] = `fixture/${wave}`;
      manifestEntries[wave] = ids.map((id) => approvedEntry(id, id.replace(/[/\\]/g, "-")));
    }
    for (const wave of Object.keys(EXPECTED_SCENARIOS)) {
      const entries = manifestEntries[wave];
      writeWave(
        repoRoot,
        waves[wave],
        { baseCommitSha: SHA40_A, candidates: entries },
        attestationFor(...entries),
      );
    }

    const result = auditGateA(repoRoot, { waves, expectedScenarios: EXPECTED_SCENARIOS });
    expect(result.issues).toEqual([]);
    expect(result.expectedScenarios.missing).toEqual([]);
    expect(result.completionCriteria.allExpectedScenariosPresent).toBe(true);
    expect(result.completionCriteria.allApprovedGolden).toBe(true);
    expect(result.completionCriteria.zeroIntegrityErrors).toBe(true);
    expect(result.goldenAuthorityComplete).toBe(true);
  });

  it("2. one remaining CANDIDATE among otherwise-complete scenarios: incomplete, not an integrity error", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1", "X2"] };
    const entries = [approvedEntry("X1", "x1"), candidateEntry("X2")];
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: entries }, attestationFor(entries[0] as any));

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.goldenAuthorityComplete).toBe(false);
    expect(result.issues.some((i: any) => i.severity === "ERROR")).toBe(false);
    expect(result.completionCriteria.allApprovedGolden).toBe(false);
  });

  it("3. one REVISE among otherwise-complete scenarios: incomplete, not an integrity error", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1", "X2"] };
    const entries = [approvedEntry("X1", "x1"), { scenarioId: "X2", status: "REVISE", fixtureId: "f", fixtureVersion: 1 }];
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: entries }, attestationFor(entries[0] as any));

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.goldenAuthorityComplete).toBe(false);
    expect(result.issues.some((i: any) => i.severity === "ERROR")).toBe(false);
  });

  it("4. one REJECT among otherwise-complete scenarios: incomplete, not an integrity error", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1", "X2"] };
    const entries = [approvedEntry("X1", "x1"), { scenarioId: "X2", status: "REJECT", fixtureId: "f", fixtureVersion: 1 }];
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: entries }, attestationFor(entries[0] as any));

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.goldenAuthorityComplete).toBe(false);
    expect(result.issues.some((i: any) => i.severity === "ERROR")).toBe(false);
  });

  it("5. one missing expected scenario (absent from the manifest entirely): incomplete, flagged as an error, not silently accepted", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1", "X2"] };
    const entries = [approvedEntry("X1", "x1")]; // X2 never appears
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: entries }, attestationFor(entries[0] as any));

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.goldenAuthorityComplete).toBe(false);
    expect(result.completionCriteria.allExpectedScenariosPresent).toBe(false);
    expect(result.expectedScenarios.missing).toEqual(["W1:X2"]);
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "ERROR", kind: "MISSING_EXPECTED_SCENARIO", wave: "W1", scenario: "X2" }));
  });

  it("6. one incomplete approval object (missing approvedBy): error", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1"] };
    const entry = approvedEntry("X1", "x1");
    delete (entry.approval as any).approvedBy;
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry] }, attestationFor(entry));

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.goldenAuthorityComplete).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "ERROR", kind: "INCOMPLETE_APPROVAL", scenario: "X1" }));
  });

  it("7. one approved scenario with no screenshots: error", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1"] };
    const entry = approvedEntry("X1", "x1");
    (entry.approval as any).approvedCaptures = [];
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry] }, { sourceCommitSha: SHA40_B, generatedAt: "2026-10-09T00:00:00.000Z", captures: [] });

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.goldenAuthorityComplete).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "ERROR", kind: "NO_APPROVED_CAPTURES", scenario: "X1" }));
  });

  it("8. one approved screenshot absent from attestation: error (promoted from warning)", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1"] };
    const entry = approvedEntry("X1", "x1");
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry] }, { sourceCommitSha: SHA40_B, generatedAt: "2026-10-09T00:00:00.000Z", captures: [] });

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.goldenAuthorityComplete).toBe(false);
    const missing = result.issues.filter((i: any) => i.kind === "APPROVED_FILE_NOT_IN_ATT");
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0].severity).toBe("ERROR");
  });

  it("9. one approved screenshot with a mismatched hash: error", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1"] };
    const entry = approvedEntry("X1", "x1");
    const att = attestationFor(entry);
    (att.captures[0] as any).sha256 = "9".repeat(64); // diverges from the approval's recorded hash
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry] }, att);

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.goldenAuthorityComplete).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "ERROR", kind: "HASH_MISMATCH_WITH_ATTESTATION", scenario: "X1" }));
  });

  it("10. one malformed approved SHA-256: error", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1"] };
    const entry = approvedEntry("X1", "x1");
    (entry.approval as any).approvedCaptures[0].sha256 = "not-a-hash";
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry] }, attestationFor(entry));

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.goldenAuthorityComplete).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "ERROR", kind: "BAD_APPROVED_SHA", scenario: "X1" }));
  });

  it("11. one malformed Git revision SHA: error", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1"] };
    const entry = approvedEntry("X1", "x1");
    (entry.approval as any).revisionSha = SHA64_1; // 64-hex SHA-256, not a 40-hex git SHA — the original bug class
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry] }, attestationFor(entry));

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.goldenAuthorityComplete).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "ERROR", kind: "INCOMPLETE_APPROVAL", scenario: "X1" }));
  });

  it("12. duplicate scenario identifiers: error", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1"] };
    const entry1 = approvedEntry("X1", "x1");
    const entry2 = approvedEntry("X1", "x1-dup");
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry1, entry2] }, attestationFor(entry1, entry2));

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "ERROR", kind: "DUPLICATE_SCENARIO", scenario: "X1" }));
  });

  it("13. shared A07-S1/A07-S2 entry is accepted as the defined mapping, not double-counted or flagged missing", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W3: "fixture/W3" };
    const expected = { W3: EXPECTED_SCENARIOS.W3 };
    const entries = expected.W3.map((id) => approvedEntry(id, id.replace(/[/\\]/g, "-")));
    writeWave(repoRoot, waves.W3, { baseCommitSha: SHA40_A, candidates: entries }, attestationFor(...entries));

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.expectedScenarios.missing).toEqual([]);
    expect(result.issues.filter((i: any) => i.kind === "MISSING_EXPECTED_SCENARIO")).toEqual([]);
    expect(result.issues.filter((i: any) => i.kind === "DUPLICATE_SCENARIO")).toEqual([]);
    // 15 manifest entries (A07-S1/A07-S2 is one), matching the real W3 shape
    expect(entries.length).toBe(15);
  });

  it("14. a valid CANDIDATE with approval: null is pending, not an integrity violation", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1"] };
    const entry = { scenarioId: "X1", status: "CANDIDATE", fixtureId: "f", fixtureVersion: 1, approval: null };
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry] }, { sourceCommitSha: SHA40_B, generatedAt: "2026-10-09T00:00:00.000Z", captures: [] });

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.issues.some((i: any) => i.severity === "ERROR")).toBe(false);
    expect(result.goldenAuthorityComplete).toBe(false);
    expect(result.pendingEntries).toBe(1);
  });

  it("14b. an unrecognized status is an integrity error, not a harmless pending state", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1"] };
    const entry = { scenarioId: "X1", status: "SOMETHING_ELSE", fixtureId: "f", fixtureVersion: 1 };
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry] }, { sourceCommitSha: SHA40_B, generatedAt: "2026-10-09T00:00:00.000Z", captures: [] });

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "ERROR", kind: "UNRECOGNIZED_STATUS", scenario: "X1", status: "SOMETHING_ELSE" }));
  });

  it("15. the real repository state: incomplete authority (W4 pending), but zero unintended integrity errors", () => {
    const result = auditGateA(REPO_ROOT);
    expect(result.expectedScenarios.totalManifestEntries).toBe(38);
    expect(result.expectedScenarios.totalLogicalScenarioIds).toBe(39);
    expect(result.expectedScenarios.missing).toEqual([]);
    expect(result.approvedEntries).toBe(25);
    expect(result.pendingEntries).toBe(13);
    expect(result.issues).toEqual([]);
    expect(result.goldenAuthorityComplete).toBe(false);
  });
});

describe("structural capture-contract checks", () => {
  it("flags a missing desktop/mobile viewport pair as an error", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1"] };
    const entry = approvedEntry("X1", "x1");
    // Drop the mobile captures entirely
    (entry.approval as any).approvedCaptures = (entry.approval as any).approvedCaptures.filter((c: any) => c.viewport === "desktop");
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry] }, attestationFor(entry));

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "ERROR", kind: "MISSING_REQUIRED_VIEWPORT", scenario: "X1", viewport: "mobile" }));
  });

  it("flags a missing theme (dark-only) for a captured viewport as an error", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const expected = { W1: ["X1"] };
    const entry = approvedEntry("X1", "x1");
    (entry.approval as any).approvedCaptures = (entry.approval as any).approvedCaptures.filter((c: any) => c.theme === "dark");
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry] }, attestationFor(entry));

    const result = auditGateA(repoRoot, { waves, expectedScenarios: expected });
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "ERROR", kind: "MISSING_THEME_PAIR", scenario: "X1" }));
  });
});

describe("buildInventoryRows (W5-R2 provenance fields)", () => {
  it("separates baseCommitSha, approvalRevisionSha, captureSourceCommitSha and reviewedBranchHeadSha", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const entry = approvedEntry("X1", "x1");
    writeWave(
      repoRoot,
      waves.W1,
      { baseCommitSha: SHA40_A, candidates: [entry] },
      { sourceCommitSha: SHA40_B, reviewedBranchHeadSha: "c".repeat(40), generatedAt: "2026-10-09T00:00:00.000Z", captures: (entry.approval as any).approvedCaptures },
    );

    const rows = buildInventoryRows(repoRoot, { waves });
    expect(rows).toHaveLength(1);
    expect(rows[0].baseCommitSha).toBe(SHA40_A);
    expect(rows[0].approvalRevisionSha).toBe(SHA40_A); // approval.revisionSha in this fixture happens to equal SHA40_A too
    expect(rows[0].captureSourceCommitSha).toBe(SHA40_B);
    expect(rows[0].reviewedBranchHeadSha).toBe("c".repeat(40));
    expect(rows[0].approvedHashesMatchAttestation).toBe(true);
  });

  it("does not fabricate an approval revision for a CANDIDATE entry", () => {
    const repoRoot = makeRepoRoot();
    const waves = { W1: "fixture/W1" };
    const entry = { scenarioId: "X1", status: "CANDIDATE", fixtureId: "f", fixtureVersion: 1, approval: null };
    writeWave(repoRoot, waves.W1, { baseCommitSha: SHA40_A, candidates: [entry] }, { sourceCommitSha: SHA40_B, generatedAt: "2026-10-09T00:00:00.000Z", captures: [] });

    const rows = buildInventoryRows(repoRoot, { waves });
    expect(rows[0].approvalRevisionSha).toBeNull();
    expect(rows[0].baseCommitSha).toBe(SHA40_A);
    expect(rows[0].approvedBy).toBeNull();
    expect(rows[0].approvedAt).toBeNull();
  });

  it("real repository: approved-capture total is 488, attested total is 698 (W5-R2)", () => {
    const { waveData } = loadWaveData(REPO_ROOT);
    const rows = buildInventoryRows(REPO_ROOT);
    const approvedTotal = rows.filter((r) => r.status === "APPROVED_GOLDEN").reduce((n, r) => n + r.approvedCaptureCount, 0);
    expect(approvedTotal).toBe(488);
    const attestedTotal = Object.values(waveData).reduce((n: number, w: any) => n + (w.attestation?.captures?.length ?? 0), 0);
    expect(attestedTotal).toBe(698);
    expect(rows.filter((r) => r.status === "APPROVED_GOLDEN")).toHaveLength(25);
    expect(rows.filter((r) => r.status === "CANDIDATE")).toHaveLength(13);
    expect(rows).toHaveLength(38);
    expect(expectedLogicalScenarioCount()).toBe(39);
  });

  it("every W4 row has an empty approvalRevisionSha in the real repository (no fabricated approval revision)", () => {
    const rows = buildInventoryRows(REPO_ROOT);
    const w4Rows = rows.filter((r) => r.wave === "W4");
    expect(w4Rows).toHaveLength(13);
    for (const row of w4Rows) {
      expect(row.approvalRevisionSha).toBeNull();
      expect(row.status).toBe("CANDIDATE");
    }
  });
});

describe("CLI: audit-gate-a-golden-authority.mjs", () => {
  it("exits 0 with goldenAuthorityComplete: false against the real repo (pending approvals are not an integrity failure)", () => {
    const { code, out } = runCli(AUDIT_SCRIPT, [REPO_ROOT]);
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.goldenAuthorityComplete).toBe(false);
    expect(parsed.issues).toEqual([]);
  });

  it("exits 1 when a fixture directory has an integrity error", () => {
    const repoRoot = makeRepoRoot();
    writeWave(repoRoot, "docs/ui-lab/gate-a-w1-candidates", { baseCommitSha: SHA40_A, candidates: [{ scenarioId: "", fixtureVersion: 1 }] }, { sourceCommitSha: SHA40_B, generatedAt: "x", captures: [] });
    writeWave(repoRoot, "docs/ui-lab/gate-a-w2-candidates", { baseCommitSha: SHA40_A, candidates: [] }, { sourceCommitSha: SHA40_B, generatedAt: "x", captures: [] });
    writeWave(repoRoot, "docs/ui-lab/gate-a-w3-candidates", { baseCommitSha: SHA40_A, candidates: [] }, { sourceCommitSha: SHA40_B, generatedAt: "x", captures: [] });
    writeWave(repoRoot, "docs/ui-lab/gate-a-w4-candidates", { baseCommitSha: SHA40_A, candidates: [] }, { sourceCommitSha: SHA40_B, generatedAt: "x", captures: [] });
    const { code, out } = runCli(AUDIT_SCRIPT, [repoRoot]);
    expect(code).toBe(1);
    const parsed = JSON.parse(out);
    expect(parsed.issues.some((i: any) => i.kind === "EMPTY_SCENARIO")).toBe(true);
  });
});

describe("CLI: generate-gate-a-authority-inventory.mjs", () => {
  it("defaults to stdout, read-only (no file written)", () => {
    const { code, out } = runCli(GENERATE_SCRIPT, [REPO_ROOT]);
    expect(code).toBe(0);
    expect(out.split("\n")[0]).toBe(
      "wave,scenarioId,fixtureId,fixtureVersion,status,approvedBy,approvedAt,baseCommitSha,approvalRevisionSha,captureSourceCommitSha,reviewedBranchHeadSha,approvedCaptureCount,approvedHashesMatchAttestation,attestationGeneratedAt",
    );
  });

  it("produces byte-identical output across repeated runs against unchanged input", () => {
    const first = runCli(GENERATE_SCRIPT, [REPO_ROOT]).out;
    const second = runCli(GENERATE_SCRIPT, [REPO_ROOT]).out;
    expect(first).toBe(second);
  });

  it("refuses to generate from malformed input rather than inventing a default", () => {
    const repoRoot = makeRepoRoot();
    const full = join(repoRoot, "docs/ui-lab/gate-a-w1-candidates");
    mkdirSync(full, { recursive: true });
    writeFileSync(join(full, "candidate_manifest.json"), "{ not valid json");
    const { code, err } = runCli(GENERATE_SCRIPT, [repoRoot]);
    expect(code).toBe(1);
    expect(err).toMatch(/invalid input/i);
  });

  it("only writes docs/ui-lab/gate-a-w5-convergence/authority_inventory.csv when --write is passed", () => {
    const repoRoot = makeRepoRoot();
    // Minimal valid empty-but-structurally-sound fixture set for all four waves.
    for (const wave of ["w1", "w2", "w3", "w4"]) {
      writeWave(repoRoot, `docs/ui-lab/gate-a-${wave}-candidates`, { baseCommitSha: SHA40_A, candidates: [] }, { sourceCommitSha: SHA40_B, generatedAt: "2026-10-09T00:00:00.000Z", captures: [] });
    }
    const outPath = join(repoRoot, "docs/ui-lab/gate-a-w5-convergence/authority_inventory.csv");
    const before = runCli(GENERATE_SCRIPT, [repoRoot]);
    expect(before.code).toBe(0);
    expect(() => readFileSync(outPath)).toThrow();

    const after = runCli(GENERATE_SCRIPT, ["--write", repoRoot]);
    expect(after.code).toBe(0);
    expect(readFileSync(outPath, "utf8").split("\n")[0]).toMatch(/^wave,scenarioId/);
  });
});
