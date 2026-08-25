import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkScannerExecution } from "../../scripts/check-scanner-execution.mjs";

/**
 * AIP-6 (Architecture Integrity Programme): proves the core acceptance criterion directly —
 * scanner execution failure (missing/unparseable output) must fail, independent of finding
 * count, and finding count alone must never fail the check under the current advisory policy.
 */
describe("check-scanner-execution", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-exec-test-"));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fails when the output file does not exist (scanner never ran)", () => {
    const result = checkScannerExecution("semgrep", path.join(tmpDir, "does-not-exist.json"));
    expect(result.ok).toBe(false);
    expect(result.message).toContain("SCANNER EXECUTION FAILURE");
    expect(result.message).toContain("did not produce an output file");
  });

  it("fails when the output file exists but is not valid JSON (scanner crashed mid-write)", () => {
    const file = path.join(tmpDir, "corrupt.json");
    fs.writeFileSync(file, "{ not valid json ");
    const result = checkScannerExecution("gitleaks", file);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("SCANNER EXECUTION FAILURE");
    expect(result.message).toContain("not valid JSON");
  });

  it("succeeds with zero findings — a clean scan is a real success, not a failure", () => {
    const file = path.join(tmpDir, "semgrep-clean.json");
    fs.writeFileSync(file, JSON.stringify({ results: [] }));
    const result = checkScannerExecution("semgrep", file);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Findings: 0");
  });

  it("succeeds with findings present — findings are advisory, not blocking, under current policy", () => {
    const file = path.join(tmpDir, "semgrep-findings.json");
    fs.writeFileSync(file, JSON.stringify({ results: [{ check_id: "x" }, { check_id: "y" }] }));
    const result = checkScannerExecution("semgrep", file);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Findings: 2");
    expect(result.message).toContain("::warning::2 semgrep finding(s)");
  });

  it("succeeds for gitleaks' top-level-array shape", () => {
    const file = path.join(tmpDir, "gitleaks-findings.json");
    fs.writeFileSync(file, JSON.stringify([{ Description: "x" }]));
    const result = checkScannerExecution("gitleaks", file);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Findings: 1");
  });

  it("succeeds for gitleaks' empty-array shape (no findings is a valid gitleaks output too)", () => {
    const file = path.join(tmpDir, "gitleaks-clean.json");
    fs.writeFileSync(file, JSON.stringify([]));
    const result = checkScannerExecution("gitleaks", file);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Findings: 0");
  });

  it("succeeds for osv-scanner's nested results/packages/vulnerabilities shape", () => {
    const file = path.join(tmpDir, "osv-findings.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        results: [
          { packages: [{ vulnerabilities: [{ id: "GHSA-1" }, { id: "GHSA-2" }] }] },
        ],
      }),
    );
    const result = checkScannerExecution("osv", file);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Findings: 2");
  });

  it("does not fail on an unexpected-shape JSON file — a parseable file is still evidence the tool ran", () => {
    const file = path.join(tmpDir, "unexpected-shape.json");
    fs.writeFileSync(file, JSON.stringify({ somethingElse: true }));
    const result = checkScannerExecution("osv", file);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Findings: unknown");
  });
});
