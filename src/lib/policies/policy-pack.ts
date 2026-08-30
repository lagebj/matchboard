import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

/**
 * Policy pack failure mode for the pack's OWN entrypoints (selection, situation, ...).
 *
 * "degraded_fallback" (the only mode the built-in "matchboard-default" pack may use,
 * regardless of its own metadata) means an unexpected runtime evaluation failure marks
 * the policy runtime DEGRADED and callers fall back to a safe, deterministic TypeScript
 * path rather than blocking normal coaching workflows.
 *
 * "fail_closed" is available to a non-built-in (custom/organization) pack that
 * explicitly declares it, for instances that want a broken custom policy to halt
 * selection mutation rather than silently degrade. It replaces the removed global
 * MATCHBOARD_POLICY_REGO_FAILURE_MODE env var with a pack-scoped, versioned decision.
 */
export type PolicyPackFailureMode = "degraded_fallback" | "fail_closed";

export const BUILT_IN_PACK_ID = "matchboard-default";

export type PolicyPackMetadata = {
  id: string;
  name: string;
  version: string;
  description: string;
  /** Name -> Rego package path (e.g. "selection" -> "matchboard/selection/decision"). Always includes "selection". */
  entrypoints: Record<string, string>;
  regoDirectory: string;
  compiledWasm: string;
  fixturesDirectory: string;
  runtime: string;
  /** 1 (legacy single `entrypoint` string) or 2 (named `entrypoints` map), as read from the source file. */
  schemaVersion: number;
  failureMode: PolicyPackFailureMode;
};

export type PolicyPackValidationResult = {
  valid: boolean;
  packId: string;
  errors: string[];
  warnings: string[];
};

export type PolicyPackDiagnostics = {
  packId: string | null;
  packVersion: string | null;
  packName: string | null;
  artifactHash: string | null;
  artifactLoaded: boolean;
  schemaVersion: number | null;
  entrypoints: string[];
  failureMode: PolicyPackFailureMode | null;
  validationErrors: string[];
  validationWarnings: string[];
};

const PACKS_DIR = join(process.cwd(), "policies", "packs");
const EXAMPLES_PACKS_DIR = join(process.cwd(), "policies", "examples", "packs");

function getPacksDirectory(): string {
  return process.env.MATCHBOARD_POLICY_PACKS_DIR ?? PACKS_DIR;
}

function getExamplesPacksDirectory(): string {
  return process.env.MATCHBOARD_EXAMPLES_PACKS_DIR ?? EXAMPLES_PACKS_DIR;
}

export function getActivePackId(): string {
  return process.env.MATCHBOARD_POLICY_PACK_ID ?? BUILT_IN_PACK_ID;
}

export function loadPackMetadata(packId: string, includeExamples = false): PolicyPackMetadata | null {
  const packsDir = getPacksDirectory();
  const metadataPath = join(packsDir, packId, "policy-pack.json");

  if (existsSync(metadataPath)) {
    try {
      const raw = readFileSync(metadataPath, "utf-8");
      const parsed = JSON.parse(raw);
      return validatePackMetadataShape(parsed, packId);
    } catch {
      return null;
    }
  }

  if (includeExamples) {
    const examplesDir = getExamplesPacksDirectory();
    const examplePath = join(examplesDir, packId, "policy-pack.json");
    if (existsSync(examplePath)) {
      try {
        const raw = readFileSync(examplePath, "utf-8");
        const parsed = JSON.parse(raw);
        return validatePackMetadataShape(parsed, packId);
      } catch {
        return null;
      }
    }
  }

  return null;
}

const FAILURE_MODES: PolicyPackFailureMode[] = ["degraded_fallback", "fail_closed"];

function normalizeEntrypoints(raw: Record<string, unknown>, errors: string[]): Record<string, string> {
  const schemaVersion = raw.schemaVersion;

  if (schemaVersion === 2) {
    const rawEntrypoints = raw.entrypoints;
    if (rawEntrypoints == null || typeof rawEntrypoints !== "object" || Array.isArray(rawEntrypoints)) {
      errors.push("metadata.entrypoints must be an object mapping names to Rego package paths");
      return {};
    }
    const entries = Object.entries(rawEntrypoints as Record<string, unknown>);
    const normalized: Record<string, string> = {};
    for (const [name, path] of entries) {
      if (typeof path !== "string" || path.length === 0) {
        errors.push(`metadata.entrypoints.${name} must be a non-empty string`);
        continue;
      }
      normalized[name] = path;
    }
    if (!normalized.selection) {
      errors.push("metadata.entrypoints must declare a 'selection' entrypoint");
    }
    return normalized;
  }

  if (schemaVersion === 1) {
    if (typeof raw.entrypoint !== "string" || raw.entrypoint.length === 0) {
      errors.push("metadata.entrypoint must be a non-empty string");
      return {};
    }
    return { selection: raw.entrypoint };
  }

  errors.push("metadata.schemaVersion must be 1 or 2");
  return {};
}

export function validatePackMetadataShape(
  raw: Record<string, unknown>,
  expectedId?: string,
): PolicyPackMetadata {
  const errors: string[] = [];

  if (typeof raw.id !== "string" || raw.id.length === 0) {
    errors.push("metadata.id must be a non-empty string");
  }
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    errors.push("metadata.name must be a non-empty string");
  }
  if (typeof raw.version !== "string" || raw.version.length === 0) {
    errors.push("metadata.version must be a non-empty string");
  }
  if (typeof raw.description !== "string") {
    errors.push("metadata.description must be a string");
  }
  if (typeof raw.regoDirectory !== "string" || raw.regoDirectory.length === 0) {
    errors.push("metadata.regoDirectory must be a non-empty string");
  }
  if (typeof raw.compiledWasm !== "string" || raw.compiledWasm.length === 0) {
    errors.push("metadata.compiledWasm must be a non-empty string");
  }
  if (typeof raw.fixturesDirectory !== "string" || raw.fixturesDirectory.length === 0) {
    errors.push("metadata.fixturesDirectory must be a non-empty string");
  }
  if (raw.runtime !== "opa-wasm") {
    errors.push("metadata.runtime must be 'opa-wasm'");
  }

  const entrypoints = normalizeEntrypoints(raw, errors);

  let failureMode: PolicyPackFailureMode = "degraded_fallback";
  if (raw.failureMode !== undefined) {
    if (typeof raw.failureMode !== "string" || !FAILURE_MODES.includes(raw.failureMode as PolicyPackFailureMode)) {
      errors.push(`metadata.failureMode must be one of: ${FAILURE_MODES.join(", ")}`);
    } else {
      failureMode = raw.failureMode as PolicyPackFailureMode;
    }
  }

  const forbiddenKeys = ["rules", "conditions", "effects", "operators"];
  for (const key of forbiddenKeys) {
    if (raw[key] !== undefined) {
      errors.push(`metadata must not contain '${key}' (forbidden DSL content)`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid policy pack metadata: ${errors.join("; ")}`);
  }

  if (expectedId && raw.id !== expectedId) {
    throw new Error(`metadata.id '${raw.id}' does not match expected pack directory '${expectedId}'`);
  }

  // The built-in pack's failure mode is fixed regardless of what its own metadata claims —
  // it is the always-available safety net and must never be configured into fail_closed.
  const effectiveFailureMode: PolicyPackFailureMode =
    raw.id === BUILT_IN_PACK_ID ? "degraded_fallback" : failureMode;

  return {
    id: raw.id as string,
    name: raw.name as string,
    version: raw.version as string,
    description: raw.description as string,
    entrypoints,
    regoDirectory: raw.regoDirectory as string,
    compiledWasm: raw.compiledWasm as string,
    fixturesDirectory: raw.fixturesDirectory as string,
    runtime: raw.runtime as string,
    schemaVersion: raw.schemaVersion as number,
    failureMode: effectiveFailureMode,
  };
}

export function getPackEntrypoint(metadata: PolicyPackMetadata, name: string): string {
  const path = metadata.entrypoints[name];
  if (!path) {
    throw new Error(`Pack '${metadata.id}' has no declared '${name}' entrypoint.`);
  }
  return path;
}

export function resolvePackDirectory(packId: string, includeExamples = false): string {
  const packsDir = getPacksDirectory();
  const deployDir = join(packsDir, packId);
  if (existsSync(deployDir)) return deployDir;

  if (includeExamples) {
    const examplesDir = getExamplesPacksDirectory();
    const exampleDir = join(examplesDir, packId);
    if (existsSync(exampleDir)) return exampleDir;
  }

  return deployDir;
}

export function resolveRegoDirectory(packId: string, metadata: PolicyPackMetadata, includeExamples = false): string {
  const packDir = resolvePackDirectory(packId, includeExamples);
  return resolve(packDir, metadata.regoDirectory);
}

export function resolveWasmPath(packId: string, metadata: PolicyPackMetadata, includeExamples = false): string {
  const packDir = resolvePackDirectory(packId, includeExamples);
  return resolve(packDir, metadata.compiledWasm);
}

export function resolveFixturesDirectory(packId: string, metadata: PolicyPackMetadata, includeExamples = false): string {
  const packDir = resolvePackDirectory(packId, includeExamples);
  return resolve(packDir, metadata.fixturesDirectory);
}

/**
 * Validate pack source/metadata correctness.
 *
 * `requireArtifact` distinguishes source-tree editing (missing Wasm is a warning — "run
 * policy:build") from build/deploy validation (missing Wasm for a deployable pack is fatal,
 * since the build pipeline is expected to have produced it by that stage).
 */
export function validatePack(
  packId: string,
  options?: { includeExamples?: boolean; requireArtifact?: boolean },
): PolicyPackValidationResult {
  const includeExamples = options?.includeExamples ?? false;
  const requireArtifact = options?.requireArtifact ?? false;
  const errors: string[] = [];
  const warnings: string[] = [];

  const packDir = resolvePackDirectory(packId, includeExamples);

  if (!existsSync(packDir)) {
    return { valid: false, packId, errors: [`Pack directory not found: ${packDir}`], warnings: [] };
  }

  const metadataPath = join(packDir, "policy-pack.json");
  if (!existsSync(metadataPath)) {
    return { valid: false, packId, errors: ["policy-pack.json not found"], warnings: [] };
  }

  let metadata: PolicyPackMetadata;
  try {
    const raw = JSON.parse(readFileSync(metadataPath, "utf-8"));
    metadata = validatePackMetadataShape(raw, packId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, packId, errors: [`Invalid metadata: ${message}`], warnings: [] };
  }

  const regoDir = resolveRegoDirectory(packId, metadata, includeExamples);
  if (!existsSync(regoDir)) {
    errors.push(`Rego directory not found: ${regoDir}`);
  } else {
    const regoFiles = readdirSync(regoDir).filter((f) => f.endsWith(".rego") && !f.endsWith("_test.rego"));
    if (regoFiles.length === 0) {
      errors.push("No Rego source files found (excluding test files)");
    }
  }

  const wasmPath = resolveWasmPath(packId, metadata, includeExamples);
  if (!existsSync(wasmPath)) {
    const message = `Compiled Wasm artifact not found: ${wasmPath}. Run 'npm run policy:build -- --pack ${packId}' to compile.`;
    if (requireArtifact) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  const fixturesDir = resolveFixturesDirectory(packId, metadata, includeExamples);
  if (!existsSync(fixturesDir)) {
    warnings.push(`Fixtures directory not found: ${fixturesDir}`);
  } else {
    const fixtureFiles = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
    if (fixtureFiles.length === 0) {
      warnings.push("No fixture files found in fixtures directory");
    }
  }

  const jsonDslFiles = readdirSync(packDir).filter((f) => f.endsWith(".json") && f !== "policy-pack.json");
  if (jsonDslFiles.length > 0) {
    for (const f of jsonDslFiles) {
      warnings.push(`Unexpected JSON file found: ${f}. Policy logic must be in Rego, not JSON DSL.`);
    }
  }

  return {
    valid: errors.length === 0,
    packId,
    errors,
    warnings,
  };
}

export function listPacks(): Array<{
  id: string;
  name: string;
  version: string;
  entrypoints: string[];
  compiledPresent: boolean;
  deployable: boolean;
}> {
  const packsDir = getPacksDirectory();

  if (!existsSync(packsDir)) {
    return [];
  }

  const entries = readdirSync(packsDir, { withFileTypes: true });
  const packs: Array<{
    id: string;
    name: string;
    version: string;
    entrypoints: string[];
    compiledPresent: boolean;
    deployable: boolean;
  }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const metadataPath = join(packsDir, entry.name, "policy-pack.json");
    if (!existsSync(metadataPath)) continue;

    try {
      const raw = JSON.parse(readFileSync(metadataPath, "utf-8"));
      const metadata = validatePackMetadataShape(raw, entry.name);
      const wasmPath = resolveWasmPath(entry.name, metadata);

      packs.push({
        id: metadata.id,
        name: metadata.name,
        version: metadata.version,
        entrypoints: Object.keys(metadata.entrypoints),
        compiledPresent: existsSync(wasmPath),
        deployable: raw.deployable !== false,
      });
    } catch {
      continue;
    }
  }

  return packs;
}

export function listExamplePacks(): Array<{
  id: string;
  name: string;
  version: string;
  entrypoints: string[];
  compiledPresent: boolean;
}> {
  const examplesDir = getExamplesPacksDirectory();

  if (!existsSync(examplesDir)) {
    return [];
  }

  const entries = readdirSync(examplesDir, { withFileTypes: true });
  const packs: Array<{
    id: string;
    name: string;
    version: string;
    entrypoints: string[];
    compiledPresent: boolean;
  }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const metadataPath = join(examplesDir, entry.name, "policy-pack.json");
    if (!existsSync(metadataPath)) continue;

    try {
      const raw = JSON.parse(readFileSync(metadataPath, "utf-8"));
      const metadata = validatePackMetadataShape(raw, entry.name);
      const wasmPath = join(examplesDir, entry.name, metadata.compiledWasm);

      packs.push({
        id: metadata.id,
        name: metadata.name,
        version: metadata.version,
        entrypoints: Object.keys(metadata.entrypoints),
        compiledPresent: existsSync(wasmPath),
      });
    } catch {
      continue;
    }
  }

  return packs;
}

export function computeArtifactHash(wasmPath: string): string | null {
  if (!existsSync(wasmPath)) {
    return null;
  }

  try {
    const buffer = readFileSync(wasmPath);
    return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  } catch {
    return null;
  }
}

export function getActivePackDiagnostics(): PolicyPackDiagnostics {
  const packId = getActivePackId();
  const metadata = loadPackMetadata(packId);
  const validation = validatePack(packId);

  if (!metadata) {
    return {
      packId,
      packVersion: null,
      packName: null,
      artifactHash: null,
      artifactLoaded: false,
      schemaVersion: null,
      entrypoints: [],
      failureMode: null,
      validationErrors: [`Pack '${packId}' not found or metadata invalid`],
      validationWarnings: [],
    };
  }

  const wasmPath = resolveWasmPath(packId, metadata);
  const artifactHash = computeArtifactHash(wasmPath);

  return {
    packId: metadata.id,
    packVersion: metadata.version,
    packName: metadata.name,
    artifactHash,
    artifactLoaded: artifactHash !== null,
    schemaVersion: metadata.schemaVersion,
    entrypoints: Object.keys(metadata.entrypoints),
    failureMode: metadata.failureMode,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
  };
}

let cachedArtifactHash: string | null = null;

export function getActivePackArtifactHash(): string | null {
  if (cachedArtifactHash !== null) {
    return cachedArtifactHash;
  }

  const packId = getActivePackId();
  const metadata = loadPackMetadata(packId);
  if (!metadata) {
    return null;
  }

  const wasmPath = resolveWasmPath(packId, metadata);
  cachedArtifactHash = computeArtifactHash(wasmPath);
  return cachedArtifactHash;
}

export function getActivePackVersion(): string {
  const packId = getActivePackId();
  const metadata = loadPackMetadata(packId);
  if (!metadata) {
    return `policy-unknown-${packId}`;
  }

  const hash = getActivePackArtifactHash();
  return `policy-${metadata.id}-${metadata.version}-${hash ?? "no-hash"}`;
}

export function clearPackCaches(): void {
  cachedArtifactHash = null;
}
