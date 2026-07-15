import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

export type PolicyPackMetadata = {
  id: string;
  name: string;
  version: string;
  description: string;
  entrypoint: string;
  regoDirectory: string;
  compiledWasm: string;
  fixturesDirectory: string;
  runtime: string;
  schemaVersion: number;
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
  regoEnabled: boolean;
  failureMode: string;
  validationErrors: string[];
  validationWarnings: string[];
};

const PACKS_DIR = join(process.cwd(), "policies", "packs");

function getPacksDirectory(): string {
  return process.env.MATCHBOARD_POLICY_PACKS_DIR ?? PACKS_DIR;
}

export function getActivePackId(): string {
  return process.env.MATCHBOARD_POLICY_PACK_ID ?? "matchboard-default";
}

export function loadPackMetadata(packId: string): PolicyPackMetadata | null {
  const packsDir = getPacksDirectory();
  const metadataPath = join(packsDir, packId, "policy-pack.json");

  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    const raw = readFileSync(metadataPath, "utf-8");
    const parsed = JSON.parse(raw);
    return validatePackMetadataShape(parsed, packId);
  } catch {
    return null;
  }
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
  if (typeof raw.entrypoint !== "string" || raw.entrypoint.length === 0) {
    errors.push("metadata.entrypoint must be a non-empty string");
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
  if (typeof raw.schemaVersion !== "number" || raw.schemaVersion !== 1) {
    errors.push("metadata.schemaVersion must be 1");
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

  return {
    id: raw.id as string,
    name: raw.name as string,
    version: raw.version as string,
    description: raw.description as string,
    entrypoint: raw.entrypoint as string,
    regoDirectory: raw.regoDirectory as string,
    compiledWasm: raw.compiledWasm as string,
    fixturesDirectory: raw.fixturesDirectory as string,
    runtime: raw.runtime as string,
    schemaVersion: raw.schemaVersion as number,
  };
}

export function resolvePackDirectory(packId: string): string {
  const packsDir = getPacksDirectory();
  return join(packsDir, packId);
}

export function resolveRegoDirectory(packId: string, metadata: PolicyPackMetadata): string {
  const packDir = resolvePackDirectory(packId);
  return resolve(packDir, metadata.regoDirectory);
}

export function resolveWasmPath(packId: string, metadata: PolicyPackMetadata): string {
  const packDir = resolvePackDirectory(packId);
  return resolve(packDir, metadata.compiledWasm);
}

export function resolveFixturesDirectory(packId: string, metadata: PolicyPackMetadata): string {
  const packDir = resolvePackDirectory(packId);
  return resolve(packDir, metadata.fixturesDirectory);
}

export function validatePack(packId: string): PolicyPackValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const packsDir = getPacksDirectory();
  const packDir = join(packsDir, packId);

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

  const regoDir = resolveRegoDirectory(packId, metadata);
  if (!existsSync(regoDir)) {
    errors.push(`Rego directory not found: ${regoDir}`);
  } else {
    const regoFiles = readdirSync(regoDir).filter((f) => f.endsWith(".rego") && !f.endsWith("_test.rego"));
    if (regoFiles.length === 0) {
      errors.push("No Rego source files found (excluding test files)");
    }
  }

  const wasmPath = resolveWasmPath(packId, metadata);
  if (!existsSync(wasmPath)) {
    warnings.push(`Compiled Wasm artifact not found: ${wasmPath}. Run 'npm run policy:build -- --pack ${packId}' to compile.`);
  }

  const fixturesDir = resolveFixturesDirectory(packId, metadata);
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
  entrypoint: string;
  compiledPresent: boolean;
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
    entrypoint: string;
    compiledPresent: boolean;
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
        entrypoint: metadata.entrypoint,
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
  const regoEnabled = (process.env.MATCHBOARD_POLICY_REGO_ENABLED ?? "false") === "true";
  const failureMode = (process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE ?? "fail_closed") === "fail_open"
    ? "fail_open"
    : "fail_closed";

  if (!regoEnabled) {
    return {
      packId: null,
      packVersion: null,
      packName: null,
      artifactHash: null,
      artifactLoaded: false,
      regoEnabled: false,
      failureMode,
      validationErrors: [],
      validationWarnings: [],
    };
  }

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
      regoEnabled: true,
      failureMode,
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
    regoEnabled: true,
    failureMode,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
  };
}

let cachedArtifactHash: string | null = null;

export function getActivePackArtifactHash(): string | null {
  if (!isRegoEnabled()) {
    return null;
  }

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
  if (!isRegoEnabled()) {
    return "default-typescript";
  }

  const packId = getActivePackId();
  const metadata = loadPackMetadata(packId);
  if (!metadata) {
    return `rego-unknown-${packId}`;
  }

  const hash = getActivePackArtifactHash();
  return `rego-${metadata.id}-${metadata.version}-${hash ?? "no-hash"}`;
}

export function clearPackCaches(): void {
  cachedArtifactHash = null;
}

export function isRegoEnabled(): boolean {
  return (process.env.MATCHBOARD_POLICY_REGO_ENABLED ?? "false") === "true";
}

export function getRegoFailureMode(): "fail_closed" | "fail_open" {
  return (process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE ?? "fail_closed") === "fail_open" ? "fail_open" : "fail_closed";
}