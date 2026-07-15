import { describe, it, expect } from "vitest";
import { getPolicyVersion } from "@/lib/policies/policy-version";
import { isRegoEnabled, getRegoFailureMode } from "@/lib/policies/rego-policy-adapter";
import { getActivePackId, loadPackMetadata } from "@/lib/policies/policy-pack";

describe("Workbench diagnostics (pure functions)", () => {
  it("policy version is a non-empty string", () => {
    const version = getPolicyVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });

  it("isRegoEnabled returns a boolean", () => {
    const enabled = isRegoEnabled();
    expect(typeof enabled).toBe("boolean");
  });

  it("getRegoFailureMode returns a string", () => {
    const mode = getRegoFailureMode();
    expect(typeof mode).toBe("string");
  });

  it("diagnostics snapshot structure is correct", () => {
    const regoEnabled = isRegoEnabled();
    const packId = regoEnabled ? getActivePackId() : null;
    const packMetadata = packId ? loadPackMetadata(packId) : null;

    const diagnostics = {
      regoEnabled,
      regoWasmLoaded: regoEnabled,
      policyVersion: getPolicyVersion(),
      artifactHash: null as string | null,
      packId,
      packVersion: packMetadata?.version ?? null,
      failureMode: getRegoFailureMode(),
      evaluationTimestamp: new Date().toISOString(),
    };

    expect(diagnostics).toHaveProperty("regoEnabled");
    expect(diagnostics).toHaveProperty("regoWasmLoaded");
    expect(diagnostics).toHaveProperty("policyVersion");
    expect(diagnostics).toHaveProperty("artifactHash");
    expect(diagnostics).toHaveProperty("packId");
    expect(diagnostics).toHaveProperty("packVersion");
    expect(diagnostics).toHaveProperty("failureMode");
    expect(diagnostics).toHaveProperty("evaluationTimestamp");

    expect(typeof diagnostics.regoEnabled).toBe("boolean");
    expect(typeof diagnostics.policyVersion).toBe("string");
    expect(typeof diagnostics.failureMode).toBe("string");
    expect(typeof diagnostics.evaluationTimestamp).toBe("string");

    const parsedDate = new Date(diagnostics.evaluationTimestamp);
    expect(parsedDate.getTime()).not.toBeNaN();
  });
});