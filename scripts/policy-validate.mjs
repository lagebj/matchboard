#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const PACKS_DIR = join(process.cwd(), "policies", "packs");

const FORBIDDEN_KEYS = ["rules", "conditions", "effects", "operators"];
const REQUIRED_STRING_FIELDS = ["id", "name", "version", "entrypoint", "regoDirectory", "compiledWasm", "fixturesDirectory"];
const REQUIRED_FIELDS = [...REQUIRED_STRING_FIELDS, "description", "runtime", "schemaVersion"];

function validatePack(packId) {
  const packDir = join(PACKS_DIR, packId);
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

  if (typeof metadata.schemaVersion !== "number" || metadata.schemaVersion !== 1) {
    errors.push("metadata.schemaVersion must be 1");
  }

  if (metadata.id !== packId) {
    errors.push(`metadata.id '${metadata.id}' does not match pack directory '${packId}'`);
  }

  for (const key of FORBIDDEN_KEYS) {
    if (metadata[key] !== undefined) {
      errors.push(`metadata must not contain '${key}' (forbidden DSL content)`);
    }
  }

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
    warnings.push(`Compiled Wasm artifact not found: ${wasmPath}. Run 'npm run policy:build -- --pack ${packId}' to compile.`);
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

  return { valid: errors.length === 0, packId, errors, warnings };
}

function validateAll() {
  if (!existsSync(PACKS_DIR)) {
    console.log("No packs directory found.");
    return;
  }

  const entries = readdirSync(PACKS_DIR, { withFileTypes: true });
  const packIds = entries
    .filter((d) => d.isDirectory() && existsSync(join(PACKS_DIR, d.name, "policy-pack.json")))
    .map((d) => d.name);

  if (packIds.length === 0) {
    console.log("No policy packs found.");
    return;
  }

  const targetPackId = process.argv[2] === "--pack" ? process.argv[3] : null;
  const targets = targetPackId ? [targetPackId] : packIds;

  let allValid = true;

  for (const packId of targets) {
    console.log(`\nValidating pack: ${packId}`);
    const result = validatePack(packId);

    if (result.errors.length > 0) {
      console.error("  ERRORS:");
      for (const e of result.errors) {
        console.error(`    ✗ ${e}`);
      }
      allValid = false;
    }

    if (result.warnings.length > 0) {
      console.log("  WARNINGS:");
      for (const w of result.warnings) {
        console.log(`    ⚠ ${w}`);
      }
    }

    if (result.valid) {
      console.log(`  ✓ Pack '${packId}' is valid.`);
    } else {
      console.error(`  ✗ Pack '${packId}' has validation errors.`);
    }
  }

  if (!allValid) {
    process.exit(1);
  }

  console.log("\nAll validated packs passed.");
}

validateAll();