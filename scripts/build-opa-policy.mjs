#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const args = process.argv.slice(2);
let packId = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--pack" && args[i + 1]) {
    packId = args[i + 1];
    i++;
  }
}

const LEGACY_REGO_DIR = join(process.cwd(), "policies", "rego");
const LEGACY_COMPILED_DIR = join(process.cwd(), "policies", "compiled");
const PACKS_DIR = join(process.cwd(), "policies", "packs");

function checkOpaCli() {
  try {
    execFileSync("opa", ["version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function buildLegacy() {
  if (!checkOpaCli()) {
    console.error("OPA CLI not found. Install it from https://www.openpolicyagent.org/docs/latest/#running-opa");
    console.error("  macOS: brew install opa");
    console.error("  Linux: curl -L -o /usr/local/bin/opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64_static");
    console.error("  Then: chmod +x /usr/local/bin/opa");
    process.exit(1);
  }

  if (!existsSync(LEGACY_REGO_DIR)) {
    console.error(`Legacy Rego source directory not found: ${LEGACY_REGO_DIR}`);
    process.exit(1);
  }

  mkdirSync(LEGACY_COMPILED_DIR, { recursive: true });

  const wasmOutput = join(LEGACY_COMPILED_DIR, "matchboard_selection.wasm");
  const entrypoint = "matchboard/selection/decision";
  const tempBundle = join(tmpdir(), `matchboard-policy-${Date.now()}.tar.gz`);
  const tempExtractDir = join(tmpdir(), `matchboard-extract-${Date.now()}`);

  try {
    console.log("Building legacy Rego policy...");
    execFileSync("opa", [
      "build",
      LEGACY_REGO_DIR,
      "-t", "wasm",
      "-e", entrypoint,
      "-o", tempBundle,
    ], { stdio: "pipe" });

    console.log("Extracting policy.wasm from bundle...");
    mkdirSync(tempExtractDir, { recursive: true });
    execFileSync("tar", ["-xzf", tempBundle, "-C", tempExtractDir], { stdio: "pipe" });

    const wasmPath = join(tempExtractDir, "policy.wasm");
    if (!existsSync(wasmPath)) {
      console.error("policy.wasm not found in bundle.");
      process.exit(1);
    }

    writeFileSync(wasmOutput, readFileSync(wasmPath));
    console.log(`Compiled Wasm artifact written to: ${wasmOutput}`);
    console.log("Legacy build complete.");
  } catch (error) {
    console.error("Legacy build failed:", error.message);
    process.exit(1);
  } finally {
    try { unlinkSync(tempBundle); } catch {}
    try { rmSync(tempExtractDir, { recursive: true, force: true }); } catch {}
  }
}

function buildPack(targetPackId) {
  if (!checkOpaCli()) {
    console.error("OPA CLI not found. Install it from https://www.openpolicyagent.org/docs/latest/#running-opa");
    process.exit(1);
  }

  const packDir = join(PACKS_DIR, targetPackId);
  const metadataPath = join(packDir, "policy-pack.json");

  if (!existsSync(packDir)) {
    console.error(`Pack directory not found: ${packDir}`);
    console.error(`Available packs: ${listPackIds().join(", ") || "(none)"}`);
    process.exit(1);
  }

  if (!existsSync(metadataPath)) {
    console.error(`Pack metadata not found: ${metadataPath}`);
    process.exit(1);
  }

  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
  } catch (err) {
    console.error(`Invalid metadata JSON: ${err.message}`);
    process.exit(1);
  }

  if (metadata.id !== targetPackId) {
    console.error(`metadata.id '${metadata.id}' does not match pack directory '${targetPackId}'`);
    process.exit(1);
  }

  const regoDir = resolve(packDir, metadata.regoDirectory);
  const wasmOutput = resolve(packDir, metadata.compiledWasm);
  const entrypoint = metadata.entrypoint;

  if (!existsSync(regoDir)) {
    console.error(`Rego directory not found: ${regoDir}`);
    process.exit(1);
  }

  mkdirSync(resolve(packDir, "compiled"), { recursive: true });

  const tempBundle = join(tmpdir(), `matchboard-policy-${targetPackId}-${Date.now()}.tar.gz`);
  const tempExtractDir = join(tmpdir(), `matchboard-extract-${targetPackId}-${Date.now()}`);

  try {
    console.log(`Building policy pack '${targetPackId}' (v${metadata.version})...`);
    console.log(`  Entrypoint: ${entrypoint}`);
    console.log(`  Rego source: ${regoDir}`);

    execFileSync("opa", [
      "build",
      regoDir,
      "-t", "wasm",
      "-e", entrypoint,
      "-o", tempBundle,
    ], { stdio: "pipe" });

    mkdirSync(tempExtractDir, { recursive: true });
    execFileSync("tar", ["-xzf", tempBundle, "-C", tempExtractDir], { stdio: "pipe" });

    const extractedWasm = join(tempExtractDir, "policy.wasm");
    if (!existsSync(extractedWasm)) {
      console.error("policy.wasm not found in bundle. Bundle contents:");
      try {
        const listing = execFileSync("tar", ["-tzf", tempBundle], { encoding: "utf-8" });
        console.error(listing);
      } catch {}
      process.exit(1);
    }

    writeFileSync(wasmOutput, readFileSync(extractedWasm));
    console.log(`Compiled Wasm artifact written to: ${wasmOutput}`);

    const hash = createHash("sha256").update(readFileSync(wasmOutput)).digest("hex").slice(0, 16);
    console.log(`Artifact hash: ${hash}`);

    console.log(`Pack '${targetPackId}' build complete.`);
  } catch (error) {
    console.error(`Pack '${targetPackId}' build failed:`, error.message);
    process.exit(1);
  } finally {
    try { unlinkSync(tempBundle); } catch {}
    try { rmSync(tempExtractDir, { recursive: true, force: true }); } catch {}
  }
}

function listPackIds() {
  if (!existsSync(PACKS_DIR)) return [];
  return readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(PACKS_DIR, d.name, "policy-pack.json")))
    .map((d) => d.name);
}

import { createHash } from "node:crypto";

if (packId) {
  buildPack(packId);
} else {
  console.log("No --pack specified. Building legacy policy...");
  console.log("Use --pack <pack-id> to build a specific policy pack.");
  console.log(`Available packs: ${listPackIds().join(", ") || "(none)"}`);
  console.log();
  buildLegacy();
}