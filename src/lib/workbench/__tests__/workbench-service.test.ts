import { describe, it, expect } from "vitest";
import { getPolicyVersion, getPolicyArtifactHash } from "@/lib/policies/policy-version";
import { getPolicyRuntimeDiagnostics } from "@/lib/policies/policy-runtime";
import { getActivePackId, loadPackMetadata } from "@/lib/policies/policy-pack";

// Deliberately does not import workbench-service.ts directly: it has `import "server-only"`,
// which throws outside a Next.js server-component test environment. These tests instead exercise
// the same underlying pure functions getWorkbenchDiagnostics() composes.

describe("Workbench diagnostics (pure functions)", () => {
  it("policy version is a non-empty string", () => {
    const version = getPolicyVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });

  it("policy runtime diagnostics report a health status", () => {
    const diagnostics = getPolicyRuntimeDiagnostics();
    expect(["HEALTHY", "DEGRADED"]).toContain(diagnostics.status);
    expect(diagnostics.runtime).toBe("opa-wasm");
  });

  it("diagnostics snapshot structure is correct", () => {
    const runtimeDiagnostics = getPolicyRuntimeDiagnostics();
    const packId = getActivePackId();
    const packMetadata = loadPackMetadata(packId);

    const diagnostics = {
      runtimeStatus: runtimeDiagnostics.status,
      regoWasmLoaded: runtimeDiagnostics.artifactLoaded,
      policyVersion: getPolicyVersion(),
      artifactHash: getPolicyArtifactHash(),
      packId,
      packVersion: packMetadata?.version ?? null,
      packFailureMode: packMetadata?.failureMode ?? null,
      evaluationTimestamp: new Date().toISOString(),
    };

    expect(diagnostics).toHaveProperty("runtimeStatus");
    expect(diagnostics).toHaveProperty("regoWasmLoaded");
    expect(diagnostics).toHaveProperty("policyVersion");
    expect(diagnostics).toHaveProperty("artifactHash");
    expect(diagnostics).toHaveProperty("packId");
    expect(diagnostics).toHaveProperty("packVersion");
    expect(diagnostics).toHaveProperty("packFailureMode");
    expect(diagnostics).toHaveProperty("evaluationTimestamp");

    expect(["HEALTHY", "DEGRADED"]).toContain(diagnostics.runtimeStatus);
    expect(typeof diagnostics.policyVersion).toBe("string");
    expect(diagnostics.packId).toBe("matchboard-default");
    expect(typeof diagnostics.evaluationTimestamp).toBe("string");

    const parsedDate = new Date(diagnostics.evaluationTimestamp);
    expect(parsedDate.getTime()).not.toBeNaN();
  });
});
