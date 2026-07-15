import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getActivePackId,
  loadPackMetadata,
  validatePackMetadataShape,
  resolvePackDirectory,
  resolveRegoDirectory,
  validatePack,
  listPacks,
  computeArtifactHash,
  getActivePackDiagnostics,
  getActivePackVersion,
  clearPackCaches,
  isRegoEnabled,
  getRegoFailureMode,
  type PolicyPackMetadata,
} from "../policy-pack";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  clearPackCaches();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  clearPackCaches();
});

describe("validatePackMetadataShape", () => {
  const validMetadata: Record<string, unknown> = {
    id: "test-pack",
    name: "Test Pack",
    version: "1.0.0",
    description: "A test policy pack",
    entrypoint: "test/selection/decision",
    regoDirectory: "rego",
    compiledWasm: "compiled/test_selection.wasm",
    fixturesDirectory: "fixtures",
    runtime: "opa-wasm",
    schemaVersion: 1,
  };

  it("accepts valid metadata", () => {
    const result = validatePackMetadataShape(validMetadata, "test-pack");
    expect(result.id).toBe("test-pack");
    expect(result.name).toBe("Test Pack");
    expect(result.version).toBe("1.0.0");
    expect(result.runtime).toBe("opa-wasm");
    expect(result.schemaVersion).toBe(1);
  });

  it("rejects missing id", () => {
    const noId = { ...validMetadata, id: "" };
    expect(() => validatePackMetadataShape(noId)).toThrow("metadata.id must be a non-empty string");
  });

  it("rejects missing name", () => {
    const noName = { ...validMetadata, name: "" };
    expect(() => validatePackMetadataShape(noName)).toThrow("metadata.name must be a non-empty string");
  });

  it("rejects missing version", () => {
    const noVersion = { ...validMetadata, version: "" };
    expect(() => validatePackMetadataShape(noVersion)).toThrow("metadata.version must be a non-empty string");
  });

  it("rejects wrong runtime", () => {
    const wrongRuntime = { ...validMetadata, runtime: "javascript" };
    expect(() => validatePackMetadataShape(wrongRuntime)).toThrow("metadata.runtime must be 'opa-wasm'");
  });

  it("rejects wrong schemaVersion", () => {
    const wrongSchema = { ...validMetadata, schemaVersion: 2 };
    expect(() => validatePackMetadataShape(wrongSchema)).toThrow("metadata.schemaVersion must be 1");
  });

  it("rejects forbidden DSL content keys", () => {
    const withRules = { ...validMetadata, rules: [] };
    expect(() => validatePackMetadataShape(withRules)).toThrow("metadata must not contain 'rules' (forbidden DSL content)");
  });

  it("rejects forbidden conditions key", () => {
    const withConditions = { ...validMetadata, conditions: [] };
    expect(() => validatePackMetadataShape(withConditions)).toThrow("metadata must not contain 'conditions' (forbidden DSL content)");
  });

  it("rejects forbidden effects key", () => {
    const withEffects = { ...validMetadata, effects: {} };
    expect(() => validatePackMetadataShape(withEffects)).toThrow("metadata must not contain 'effects' (forbidden DSL content)");
  });

  it("rejects forbidden operators key", () => {
    const withOperators = { ...validMetadata, operators: {} };
    expect(() => validatePackMetadataShape(withOperators)).toThrow("metadata must not contain 'operators' (forbidden DSL content)");
  });

  it("rejects id mismatch with expected pack directory", () => {
    const wrongId = { ...validMetadata, id: "different-pack" };
    expect(() => validatePackMetadataShape(wrongId, "test-pack")).toThrow(
      "metadata.id 'different-pack' does not match expected pack directory 'test-pack'"
    );
  });

  it("accepts valid metadata without expectedId check", () => {
    const result = validatePackMetadataShape(validMetadata);
    expect(result.id).toBe("test-pack");
  });
});

describe("getActivePackId", () => {
  it("defaults to matchboard-default", () => {
    delete process.env.MATCHBOARD_POLICY_PACK_ID;
    expect(getActivePackId()).toBe("matchboard-default");
  });

  it("uses env var when set", () => {
    process.env.MATCHBOARD_POLICY_PACK_ID = "custom-example";
    expect(getActivePackId()).toBe("custom-example");
  });
});

describe("isRegoEnabled", () => {
  it("defaults to false", () => {
    delete process.env.MATCHBOARD_POLICY_REGO_ENABLED;
    expect(isRegoEnabled()).toBe(false);
  });

  it("returns true when enabled", () => {
    process.env.MATCHBOARD_POLICY_REGO_ENABLED = "true";
    expect(isRegoEnabled()).toBe(true);
  });

  it("returns false for non-true values", () => {
    process.env.MATCHBOARD_POLICY_REGO_ENABLED = "1";
    expect(isRegoEnabled()).toBe(false);
  });
});

describe("getRegoFailureMode", () => {
  it("defaults to fail_closed", () => {
    delete process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE;
    expect(getRegoFailureMode()).toBe("fail_closed");
  });

  it("returns fail_open when set", () => {
    process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE = "fail_open";
    expect(getRegoFailureMode()).toBe("fail_open");
  });

  it("defaults to fail_closed for unknown values", () => {
    process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE = "permissive";
    expect(getRegoFailureMode()).toBe("fail_closed");
  });
});

describe("loadPackMetadata", () => {
  it("loads matchboard-default metadata", () => {
    const metadata = loadPackMetadata("matchboard-default");
    expect(metadata).not.toBeNull();
    expect(metadata!.id).toBe("matchboard-default");
    expect(metadata!.name).toBe("Matchboard Default Rego Policy");
    expect(metadata!.runtime).toBe("opa-wasm");
    expect(metadata!.schemaVersion).toBe(1);
  });

  it("loads custom-example metadata", () => {
    const metadata = loadPackMetadata("custom-example");
    expect(metadata).not.toBeNull();
    expect(metadata!.id).toBe("custom-example");
    expect(metadata!.name).toBe("Custom Example Rego Policy");
  });

  it("returns null for non-existent pack", () => {
    const metadata = loadPackMetadata("non-existent-pack");
    expect(metadata).toBeNull();
  });
});

describe("validatePack", () => {
  it("validates matchboard-default pack", () => {
    const result = validatePack("matchboard-default");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validates custom-example pack", () => {
    const result = validatePack("custom-example");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("reports missing pack directory", () => {
    const result = validatePack("non-existent-pack");
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("Pack directory not found"));
  });

  it("reports missing Wasm artifact as warning, not error", () => {
    const result = validatePack("matchboard-default");
    const hasWasmWarning = result.warnings.some((w) => w.includes("Compiled Wasm artifact not found") || w.includes("compiled"));
    expect(hasWasmWarning).toBe(true);
  });
});

describe("listPacks", () => {
  it("finds matchboard-default and custom-example packs", () => {
    const packs = listPacks();
    const ids = packs.map((p) => p.id);
    expect(ids).toContain("matchboard-default");
    expect(ids).toContain("custom-example");
  });
});

describe("resolvePackDirectory", () => {
  it("resolves pack directory", () => {
    const dir = resolvePackDirectory("matchboard-default");
    expect(dir).toContain("matchboard-default");
  });
});

describe("resolveRegoDirectory", () => {
  it("resolves rego directory from metadata", () => {
    const metadata: PolicyPackMetadata = {
      id: "matchboard-default",
      name: "Matchboard Default Policy",
      version: "1.0.0",
      description: "",
      entrypoint: "matchboard/selection/decision",
      regoDirectory: "rego",
      compiledWasm: "compiled/matchboard_selection.wasm",
      fixturesDirectory: "fixtures",
      runtime: "opa-wasm",
      schemaVersion: 1,
    };
    const dir = resolveRegoDirectory("matchboard-default", metadata);
    expect(dir).toContain("matchboard-default");
    expect(dir).toContain("rego");
  });
});

describe("getActivePackDiagnostics", () => {
  it("returns disabled diagnostics when Rego is off", () => {
    delete process.env.MATCHBOARD_POLICY_REGO_ENABLED;
    const diag = getActivePackDiagnostics();
    expect(diag.regoEnabled).toBe(false);
    expect(diag.packId).toBeNull();
    expect(diag.artifactLoaded).toBe(false);
  });

  it("returns pack diagnostics when Rego is enabled", () => {
    process.env.MATCHBOARD_POLICY_REGO_ENABLED = "true";
    const diag = getActivePackDiagnostics();
    expect(diag.regoEnabled).toBe(true);
    expect(diag.packId).toBe("matchboard-default");
    expect(diag.packName).toBe("Matchboard Default Rego Policy");
    expect(diag.packVersion).toBe("1.0.0");
  });

  it("uses custom pack id when set", () => {
    process.env.MATCHBOARD_POLICY_REGO_ENABLED = "true";
    process.env.MATCHBOARD_POLICY_PACK_ID = "custom-example";
    const diag = getActivePackDiagnostics();
    expect(diag.packId).toBe("custom-example");
    expect(diag.packName).toBe("Custom Example Rego Policy");
  });
});

describe("getActivePackVersion", () => {
  it("returns default-typescript when Rego disabled", () => {
    delete process.env.MATCHBOARD_POLICY_REGO_ENABLED;
    expect(getActivePackVersion()).toBe("default-typescript");
  });

  it("returns pack version string when Rego enabled", () => {
    process.env.MATCHBOARD_POLICY_REGO_ENABLED = "true";
    const version = getActivePackVersion();
    expect(version).toContain("rego-matchboard-default");
  });
});

describe("computeArtifactHash", () => {
  it("returns null for non-existent path", () => {
    const hash = computeArtifactHash("/non/existent/path.wasm");
    expect(hash).toBeNull();
  });
});

describe("clearPackCaches", () => {
  it("does not throw when called", () => {
    expect(() => clearPackCaches()).not.toThrow();
  });
});