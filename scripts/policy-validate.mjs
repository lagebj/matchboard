#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveEntrypoints } from "./policy-metadata-utils.mjs";

const REPO_ROOT = join(import.meta.dirname, "..");
const PACKS_DIR = join(REPO_ROOT, "policies", "packs");
const EXAMPLES_PACKS_DIR = join(REPO_ROOT, "policies", "examples", "packs");

const FORBIDDEN_KEYS = ["rules", "conditions", "effects", "operators"];
const REQUIRED_STRING_FIELDS = ["id", "name", "version", "regoDirectory", "compiledWasm", "fixturesDirectory"];
const REQUIRED_FIELDS = [...REQUIRED_STRING_FIELDS, "description", "runtime", "schemaVersion"];
const VALID_FAILURE_MODES = ["degraded_fallback", "fail_closed"];

function validatePack(packId, baseDir, requireArtifact = false) {
  const packDir = join(baseDir, packId);
  const metadataPath = join(packDir, "policy-pack.json");
  const errors = [];
  const warnings = [];

  if (!existsSync(packDir)) {
    return { valid: false, packId, errors: [`Pack directory not found: ${packDir}`], warnings: [] };
  }

  if (!existsSync(metadataPath)) {
    return { valid: false, packId, errors: ["policy-pack.json not found"], warnings: [] };
  }

  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
  } catch (err) {
    return { valid: false, packId, errors: [`Invalid JSON in policy-pack.json: ${err.message}`], warnings: [] };
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof metadata[field] !== "string" || metadata[field].length === 0) {
      errors.push(`metadata.${field} must be a non-empty string`);
    }
  }

  if (typeof metadata.description !== "string") {
    errors.push("metadata.description must be a string");
  }

  if (metadata.runtime !== "opa-wasm") {
    errors.push("metadata.runtime must be 'opa-wasm'");
  }

  if (metadata.schemaVersion !== 1 && metadata.schemaVersion !== 2) {
    errors.push("metadata.schemaVersion must be 1 or 2");
  } else if (metadata.schemaVersion === 2) {
    const entrypoints = resolveEntrypoints(metadata);
    if (Object.keys(entrypoints).length === 0) {
      errors.push("metadata.entrypoints must be a non-empty object mapping names to Rego package paths");
    } else if (!entrypoints.selection) {
      errors.push("metadata.entrypoints must declare a 'selection' entrypoint");
    }
  } else if (typeof metadata.entrypoint !== "string" || metadata.entrypoint.length === 0) {
    errors.push("metadata.entrypoint must be a non-empty string (schemaVersion 1)");
  }

  if (metadata.failureMode !== undefined && !VALID_FAILURE_MODES.includes(metadata.failureMode)) {
    errors.push(`metadata.failureMode must be one of: ${VALID_FAILURE_MODES.join(", ")}`);
  }
  if (packId === "matchboard-default" && metadata.failureMode && metadata.failureMode !== "degraded_fallback") {
    errors.push("the built-in 'matchboard-default' pack must not declare a failureMode other than 'degraded_fallback'");
  }

  if (metadata.id !== packId) {
    errors.push(`metadata.id '${metadata.id}' does not match pack directory '${packId}'`);
  }

  for (const key of FORBIDDEN_KEYS) {
    if (metadata[key] !== undefined) {
      errors.push(`metadata must not contain '${key}' (forbidden DSL content)`);
    }
  }

  const isDeployable = metadata.deployable === true;

  if (errors.length > 0) {
    return { valid: false, packId, errors, warnings };
  }

  const regoDir = resolve(packDir, metadata.regoDirectory);
  if (!existsSync(regoDir)) {
    errors.push(`Rego directory not found: ${regoDir}`);
  } else {
    const regoFiles = readdirSync(regoDir).filter((f) => f.endsWith(".rego") && !f.endsWith("_test.rego"));
    if (regoFiles.length === 0) {
      errors.push("No Rego source files found (excluding test files)");
    }
  }

  const wasmPath = resolve(packDir, metadata.compiledWasm);
  if (!existsSync(wasmPath)) {
    if (isDeployable) {
      const message = `Compiled Wasm artifact not found: ${wasmPath}. Run 'npm run policy:sync' to compile deployable packs.`;
      if (requireArtifact) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    } else {
      warnings.push(`Compiled Wasm artifact not found: ${wasmPath}. Example packs do not need compiled Wasm.`);
    }
  } else if (isDeployable && !metadata.wasmHash) {
    warnings.push("Deployable pack has compiled Wasm but no wasmHash. Run 'npm run policy:sync' to update hashes.");
  }

  const fixturesDir = resolve(packDir, metadata.fixturesDirectory);
  if (!existsSync(fixturesDir)) {
    warnings.push(`Fixtures directory not found: ${fixturesDir}`);
  } else {
    const fixtureFiles = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
    if (fixtureFiles.length === 0) {
      warnings.push("No fixture files found in fixtures directory");
    }
  }

  const jsonFiles = readdirSync(packDir).filter((f) => f.endsWith(".json") && f !== "policy-pack.json");
  if (jsonFiles.length > 0) {
    for (const f of jsonFiles) {
      warnings.push(`Unexpected JSON file found: ${f}. Policy logic must be in Rego, not JSON DSL.`);
    }
  }

  return { valid: errors.length === 0, packId, deployable: isDeployable, errors, warnings };
}

function validatePacksInDir(baseDir, label) {
  if (!existsSync(baseDir)) return [];

  const entries = readdirSync(baseDir, { withFileTypes: true });
  return entries
    .filter((d) => d.isDirectory() && existsSync(join(baseDir, d.name, "policy-pack.json")))
    .map((d) => d.name);
}

function validateAll() {
  const args = process.argv.slice(2);
  let targetPackId = null;
  const requireArtifact = args.includes("--require-artifact");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pack" && args[i + 1]) {
      targetPackId = args[i + 1];
      break;
    }
  }

  const deployablePackIds = validatePacksInDir(PACKS_DIR, "deployable");
  const examplePackIds = validatePacksInDir(EXAMPLES_PACKS_DIR, "example");

  let allValid = true;

  if (targetPackId) {
    console.log(`\nValidating pack: ${targetPackId}`);
    const baseDir = existsSync(join(PACKS_DIR, targetPackId)) ? PACKS_DIR :
                    existsSync(join(EXAMPLES_PACKS_DIR, targetPackId)) ? EXAMPLES_PACKS_DIR : null;
    if (!baseDir) {
      console.error(`Pack '${targetPackId}' not found in deployable or example packs.`);
      process.exit(1);
    }
    const result = validatePack(targetPackId, baseDir, requireArtifact);
    reportResult(result);
    if (!result.valid) process.exit(1);
    return;
  }

  for (const packId of deployablePackIds) {
    console.log(`\nValidating deployable pack: ${packId}`);
    const result = validatePack(packId, PACKS_DIR, requireArtifact);
    reportResult(result);
    if (!result.valid) allValid = false;
  }

  for (const packId of examplePackIds) {
    console.log(`\nValidating example pack: ${packId}`);
    const result = validatePack(packId, EXAMPLES_PACKS_DIR);
    reportResult(result);
    if (!result.valid) allValid = false;
  }

  if (!allValid) {
    process.exit(1);
  }

  console.log("\nAll validated packs passed.");
}

function reportResult(result) {
  if (result.errors.length > 0) {
    console.error("  ERRORS:");
    for (const e of result.errors) {
      console.error(`    ✗ ${e}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("  WARNINGS:");
    for (const w of result.warnings) {
      console.log(`    ⚠ ${w}`);
    }
  }

  if (result.deployable !== undefined) {
    console.log(`  Deployable: ${result.deployable ? "YES" : "NO"}`);
  }

  if (result.valid) {
    console.log(`  ✓ Pack '${result.packId}' is valid.`);
  } else {
    console.error(`  ✗ Pack '${result.packId}' has validation errors.`);
  }
}

validateAll();