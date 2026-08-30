import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getActivePackId,
  loadPackMetadata,
  validatePackMetadataShape,
  resolvePackDirectory,
  resolveRegoDirectory,
  validatePack,
  listPacks,
  listExamplePacks,
  computeArtifactHash,
  getActivePackDiagnostics,
  getActivePackVersion,
  getPackEntrypoint,
  clearPackCaches,
  BUILT_IN_PACK_ID,
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
  const validMetadataV2: Record<string, unknown> = {
    id: "test-pack",
    name: "Test Pack",
    version: "1.0.0",
    description: "A test policy pack",
    schemaVersion: 2,
    entrypoints: { selection: "test/selection/decision" },
    regoDirectory: "rego",
    compiledWasm: "compiled/test_selection.wasm",
    fixturesDirectory: "fixtures",
    runtime: "opa-wasm",
  };

  it("accepts valid v2 metadata", () => {
    const result = validatePackMetadataShape(validMetadataV2, "test-pack");
    expect(result.id).toBe("test-pack");
    expect(result.name).toBe("Test Pack");
    expect(result.version).toBe("1.0.0");
    expect(result.runtime).toBe("opa-wasm");
    expect(result.schemaVersion).toBe(2);
    expect(result.entrypoints).toEqual({ selection: "test/selection/decision" });
    expect(result.failureMode).toBe("degraded_fallback");
  });

  it("accepts valid v1 metadata (single entrypoint string), normalized to entrypoints.selection", () => {
    const v1: Record<string, unknown> = {
      id: "legacy-pack",
      name: "Legacy Pack",
      version: "1.0.0",
      description: "A legacy schema-v1 pack",
      schemaVersion: 1,
      entrypoint: "legacy/selection/decision",
      regoDirectory: "rego",
      compiledWasm: "compiled/legacy.wasm",
      fixturesDirectory: "fixtures",
      runtime: "opa-wasm",
    };
    const result = validatePackMetadataShape(v1, "legacy-pack");
    expect(result.schemaVersion).toBe(1);
    expect(result.entrypoints).toEqual({ selection: "legacy/selection/decision" });
  });

  it("rejects v2 metadata missing a selection entrypoint", () => {
    const noSelection = { ...validMetadataV2, entrypoints: { situation: "test/situation/decision" } };
    expect(() => validatePackMetadataShape(noSelection)).toThrow("must declare a 'selection' entrypoint");
  });

  it("rejects v1 metadata missing entrypoint", () => {
    const noEntrypoint = { ...validMetadataV2, schemaVersion: 1, entrypoint: undefined };
    delete (noEntrypoint as Record<string, unknown>).entrypoints;
    expect(() => validatePackMetadataShape(noEntrypoint)).toThrow("metadata.entrypoint must be a non-empty string");
  });

  it("rejects an invalid schemaVersion", () => {
    const badSchema = { ...validMetadataV2, schemaVersion: 3 };
    expect(() => validatePackMetadataShape(badSchema)).toThrow("metadata.schemaVersion must be 1 or 2");
  });

  it("rejects missing id", () => {
    const noId = { ...validMetadataV2, id: "" };
    expect(() => validatePackMetadataShape(noId)).toThrow("metadata.id must be a non-empty string");
  });

  it("rejects missing name", () => {
    const noName = { ...validMetadataV2, name: "" };
    expect(() => validatePackMetadataShape(noName)).toThrow("metadata.name must be a non-empty string");
  });

  it("rejects missing version", () => {
    const noVersion = { ...validMetadataV2, version: "" };
    expect(() => validatePackMetadataShape(noVersion)).toThrow("metadata.version must be a non-empty string");
  });

  it("rejects wrong runtime", () => {
    const wrongRuntime = { ...validMetadataV2, runtime: "javascript" };
    expect(() => validatePackMetadataShape(wrongRuntime)).toThrow("metadata.runtime must be 'opa-wasm'");
  });

  it("rejects forbidden DSL content keys", () => {
    const withRules = { ...validMetadataV2, rules: [] };
    expect(() => validatePackMetadataShape(withRules)).toThrow("metadata must not contain 'rules' (forbidden DSL content)");
  });

  it("rejects forbidden conditions key", () => {
    const withConditions = { ...validMetadataV2, conditions: [] };
    expect(() => validatePackMetadataShape(withConditions)).toThrow("metadata must not contain 'conditions' (forbidden DSL content)");
  });

  it("rejects forbidden effects key", () => {
    const withEffects = { ...validMetadataV2, effects: {} };
    expect(() => validatePackMetadataShape(withEffects)).toThrow("metadata must not contain 'effects' (forbidden DSL content)");
  });

  it("rejects forbidden operators key", () => {
    const withOperators = { ...validMetadataV2, operators: {} };
    expect(() => validatePackMetadataShape(withOperators)).toThrow("metadata must not contain 'operators' (forbidden DSL content)");
  });

  it("rejects id mismatch with expected pack directory", () => {
    const wrongId = { ...validMetadataV2, id: "different-pack" };
    expect(() => validatePackMetadataShape(wrongId, "test-pack")).toThrow(
      "metadata.id 'different-pack' does not match expected pack directory 'test-pack'"
    );
  });

  it("accepts valid metadata without expectedId check", () => {
    const result = validatePackMetadataShape(validMetadataV2);
    expect(result.id).toBe("test-pack");
  });

  it("forces the built-in pack's failureMode to degraded_fallback regardless of its own metadata", () => {
    const builtIn = { ...validMetadataV2, id: BUILT_IN_PACK_ID, failureMode: "fail_closed" };
    const result = validatePackMetadataShape(builtIn, BUILT_IN_PACK_ID);
    expect(result.failureMode).toBe("degraded_fallback");
  });

  it("honors a declared failureMode for a non-built-in pack", () => {
    const custom = { ...validMetadataV2, failureMode: "fail_closed" };
    const result = validatePackMetadataShape(custom, "test-pack");
    expect(result.failureMode).toBe("fail_closed");
  });

  it("rejects an invalid failureMode value", () => {
    const bad = { ...validMetadataV2, failureMode: "ignore_everything" };
    expect(() => validatePackMetadataShape(bad)).toThrow("metadata.failureMode must be one of");
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

describe("getPackEntrypoint", () => {
  it("returns the declared entrypoint path", () => {
    const metadata: PolicyPackMetadata = {
      id: "p",
      name: "P",
      version: "1.0.0",
      description: "",
      entrypoints: { selection: "p/selection/decision" },
      regoDirectory: "rego",
      compiledWasm: "compiled/p.wasm",
      fixturesDirectory: "fixtures",
      runtime: "opa-wasm",
      schemaVersion: 2,
      failureMode: "degraded_fallback",
    };
    expect(getPackEntrypoint(metadata, "selection")).toBe("p/selection/decision");
  });

  it("throws for an undeclared entrypoint name", () => {
    const metadata: PolicyPackMetadata = {
      id: "p",
      name: "P",
      version: "1.0.0",
      description: "",
      entrypoints: { selection: "p/selection/decision" },
      regoDirectory: "rego",
      compiledWasm: "compiled/p.wasm",
      fixturesDirectory: "fixtures",
      runtime: "opa-wasm",
      schemaVersion: 2,
      failureMode: "degraded_fallback",
    };
    expect(() => getPackEntrypoint(metadata, "situation")).toThrow("has no declared 'situation' entrypoint");
  });
});

describe("loadPackMetadata", () => {
  it("loads matchboard-default metadata (schema v2, selection + situation entrypoints)", () => {
    const metadata = loadPackMetadata("matchboard-default");
    expect(metadata).not.toBeNull();
    expect(metadata!.id).toBe("matchboard-default");
    expect(metadata!.name).toBe("Matchboard Default Rego Policy");
    expect(metadata!.runtime).toBe("opa-wasm");
    expect(metadata!.schemaVersion).toBe(2);
    expect(metadata!.entrypoints.selection).toBe("matchboard/selection/decision");
    expect(metadata!.entrypoints.situation).toBe("matchboard/situation/decision");
    expect(metadata!.failureMode).toBe("degraded_fallback");
  });

  it("loads custom-example metadata from examples (schema v1)", () => {
    const metadata = loadPackMetadata("custom-example", true);
    expect(metadata).not.toBeNull();
    expect(metadata!.id).toBe("custom-example");
    expect(metadata!.name).toBe("Custom Example Rego Policy");
    expect(metadata!.schemaVersion).toBe(1);
    expect(metadata!.entrypoints).toEqual({ selection: "custom/selection/decision" });
  });

  it("returns null for custom-example without includeExamples", () => {
    const metadata = loadPackMetadata("custom-example");
    expect(metadata).toBeNull();
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

  it("validates custom-example pack from examples", () => {
    const result = validatePack("custom-example", { includeExamples: true });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("reports missing pack directory", () => {
    const result = validatePack("non-existent-pack");
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("Pack directory not found"));
  });

  it("treats a missing Wasm artifact as fatal when requireArtifact is set", () => {
    const result = validatePack("non-existent-pack", { requireArtifact: true });
    expect(result.valid).toBe(false);
  });
});

describe("listPacks", () => {
  it("finds matchboard-default as deployable pack", () => {
    const packs = listPacks();
    const ids = packs.map((p) => p.id);
    expect(ids).toContain("matchboard-default");
  });

  it("does not include example packs in deployable packs", () => {
    const packs = listPacks();
    const ids = packs.map((p) => p.id);
    expect(ids).not.toContain("custom-example");
  });

  it("reports both entrypoints for matchboard-default", () => {
    const packs = listPacks();
    const pack = packs.find((p) => p.id === "matchboard-default");
    expect(pack?.entrypoints).toEqual(expect.arrayContaining(["selection", "situation"]));
  });
});

describe("listExamplePacks", () => {
  it("finds custom-example as an example pack", () => {
    const packs = listExamplePacks();
    const ids = packs.map((p) => p.id);
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
      entrypoints: { selection: "matchboard/selection/decision" },
      regoDirectory: "rego",
      compiledWasm: "compiled/matchboard_selection.wasm",
      fixturesDirectory: "fixtures",
      runtime: "opa-wasm",
      schemaVersion: 2,
      failureMode: "degraded_fallback",
    };
    const dir = resolveRegoDirectory("matchboard-default", metadata);
    expect(dir).toContain("matchboard-default");
    expect(dir).toContain("rego");
  });
});

describe("getActivePackDiagnostics", () => {
  it("returns pack diagnostics for the active (built-in) pack", () => {
    const diag = getActivePackDiagnostics();
    expect(diag.packId).toBe("matchboard-default");
    expect(diag.packName).toBe("Matchboard Default Rego Policy");
    expect(diag.packVersion).toBe("2.0.0");
    expect(diag.entrypoints).toEqual(expect.arrayContaining(["selection", "situation"]));
    expect(diag.failureMode).toBe("degraded_fallback");
  });

  it("uses custom pack id when set to matchboard-default", () => {
    process.env.MATCHBOARD_POLICY_PACK_ID = "matchboard-default";
    const diag = getActivePackDiagnostics();
    expect(diag.packId).toBe("matchboard-default");
    expect(diag.packName).toBe("Matchboard Default Rego Policy");
  });
});

describe("getActivePackVersion", () => {
  it("returns a policy version string for the active pack", () => {
    const version = getActivePackVersion();
    expect(version).toContain("policy-matchboard-default");
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
