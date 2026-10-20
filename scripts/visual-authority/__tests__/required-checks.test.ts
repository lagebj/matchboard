import { describe, it, expect } from "vitest";
import { evaluateRequiredChecks, requiredChecksGreen } from "../required-checks.mjs";

const REQUIRED = ["Lint", "Tests", "Build"];

function checkRun(name: string, conclusion: string, startedAt = "2026-01-01T00:00:00Z", status = "completed") {
  return { name, conclusion, status, started_at: startedAt };
}

describe("evaluateRequiredChecks", () => {
  it("is green when every required context has a successful completed run", () => {
    const runs = REQUIRED.map((name) => checkRun(name, "success"));
    expect(evaluateRequiredChecks(REQUIRED, runs)).toEqual({ allGreen: true });
  });

  it("treats skipped and neutral conclusions as acceptable (matches GitHub's own merge semantics)", () => {
    const runs = [checkRun("Lint", "success"), checkRun("Tests", "skipped"), checkRun("Build", "neutral")];
    expect(evaluateRequiredChecks(REQUIRED, runs)).toEqual({ allGreen: true });
  });

  it("is not green when a required context has no check run at all", () => {
    const runs = [checkRun("Lint", "success"), checkRun("Tests", "success")];
    const result = evaluateRequiredChecks(REQUIRED, runs);
    expect(result.allGreen).toBe(false);
    expect(result.reason).toMatch(/Build.*has not run/);
  });

  it("is not green when a required context is still in progress", () => {
    const runs = [checkRun("Lint", "success"), checkRun("Tests", "success"), checkRun("Build", "", "2026-01-01T00:00:00Z", "in_progress")];
    const result = evaluateRequiredChecks(REQUIRED, runs);
    expect(result.allGreen).toBe(false);
    expect(result.reason).toMatch(/Build.*in_progress/);
  });

  it("is not green when a required context failed", () => {
    const runs = [checkRun("Lint", "success"), checkRun("Tests", "failure"), checkRun("Build", "success")];
    const result = evaluateRequiredChecks(REQUIRED, runs);
    expect(result.allGreen).toBe(false);
    expect(result.reason).toMatch(/Tests.*failure/);
  });

  it("uses the LATEST run when a required check has been re-run multiple times for the same SHA", () => {
    const runs = [
      checkRun("Lint", "failure", "2026-01-01T00:00:00Z"),
      checkRun("Lint", "success", "2026-01-01T01:00:00Z"), // re-run, later, succeeded
      checkRun("Tests", "success"),
      checkRun("Build", "success"),
    ];
    expect(evaluateRequiredChecks(REQUIRED, runs)).toEqual({ allGreen: true });
  });

  it("does not let an EARLIER successful run mask a LATER failing re-run", () => {
    const runs = [
      checkRun("Lint", "success", "2026-01-01T00:00:00Z"),
      checkRun("Lint", "failure", "2026-01-01T01:00:00Z"), // re-run, later, failed
      checkRun("Tests", "success"),
      checkRun("Build", "success"),
    ];
    const result = evaluateRequiredChecks(REQUIRED, runs);
    expect(result.allGreen).toBe(false);
    expect(result.reason).toMatch(/Lint.*failure/);
  });
});

function fakeFetch(routes: Record<string, unknown>) {
  return async (path: string) => {
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => routes[key] };
  };
}

describe("requiredChecksGreen (network wrapper, mocked fetch)", () => {
  it("fails closed when the ruleset can't be resolved", async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const result = await requiredChecksGreen({ owner: "o", repo: "r", sha: "abc123", fetchImpl });
    expect(result.allGreen).toBe(false);
    expect(result.reason).toMatch(/ruleset/i);
  });

  it("resolves the required-context list from the live ruleset and checks it against check-runs", async () => {
    // Response shape here is the REAL GitHub Check Runs API shape ({total_count, check_runs: [...]}),
    // not a bare array — this exact fixture is a regression test for a real bug found via this
    // repo's own first live /visual-review deploy request: an earlier version of paginateAll
    // assumed every list endpoint returns a bare array, so this wrapped shape silently produced
    // zero results (not an error), making every required check falsely read as "has not run yet".
    const fetchImpl = fakeFetch({
      "/repos/o/r/rulesets/21317362": {
        rules: [{ type: "required_status_checks", parameters: { required_status_checks: [{ context: "Lint" }, { context: "Tests" }] } }],
      },
      "/repos/o/r/commits/abc123/check-runs": { total_count: 2, check_runs: [checkRun("Lint", "success"), checkRun("Tests", "success")] },
    });
    const result = await requiredChecksGreen({ owner: "o", repo: "r", sha: "abc123", fetchImpl });
    expect(result).toEqual({ allGreen: true });
  });

  it("fails closed (never silently reports allGreen) if the check-runs response isn't the expected wrapped shape", async () => {
    const fetchImpl = fakeFetch({
      "/repos/o/r/rulesets/21317362": {
        rules: [{ type: "required_status_checks", parameters: { required_status_checks: [{ context: "Lint" }] } }],
      },
      // A bare array here (the old, wrong assumption) must not be silently treated as zero
      // required checks having run — it must still fail closed with a clear reason, not crash.
      "/repos/o/r/commits/abc123/check-runs": [checkRun("Lint", "success")],
    });
    const result = await requiredChecksGreen({ owner: "o", repo: "r", sha: "abc123", fetchImpl });
    expect(result.allGreen).toBe(false);
  });

  it("fails closed when check-run pagination doesn't complete", async () => {
    const fetchImpl = async (path: string) => {
      if (path.includes("rulesets")) {
        return {
          ok: true,
          json: async () => ({ rules: [{ type: "required_status_checks", parameters: { required_status_checks: [{ context: "Lint" }] } }] }),
        };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    };
    const result = await requiredChecksGreen({ owner: "o", repo: "r", sha: "abc123", fetchImpl });
    expect(result.allGreen).toBe(false);
    expect(result.reason).toMatch(/check-run/i);
  });
});
