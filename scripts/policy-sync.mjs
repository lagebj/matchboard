#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { resolveOpaPath, REPO_ROOT } from "./policy-utils.mjs";

const PACKS_DIR = join(REPO_ROOT, "policies", "packs");

function listPackIds() {
  if (!existsSync(PACKS_DIR)) return [];
  return readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(PACKS_DIR, d.name, "policy-pack.json")))
    .map((d) => d.name);
}

function isDeployablePack(packId) {
  const metadataPath = join(PACKS_DIR, packId, "policy-pack.json");
  if (!existsSync(metadataPath)) return false;
  try {
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    return metadata.deployable === true;
  } catch {
    return false;
  }
}

function computeFileHash(filePath) {
  const data = readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

function updatePackHash(packId, wasmPath) {
  const metadataPath = join(PACKS_DIR, packId, "policy-pack.json");
  const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
  const hash = computeFileHash(wasmPath);
  metadata.wasmHash = hash;
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
  return hash;
}

function runOpaTests(opaPath, regoDir, label) {
  console.log(`\nRunning OPA tests for ${label}...`);
  try {
    const result = execFileSync(opaPath, ["test", regoDir], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    console.log(result);
    return true;
  } catch (err) {
    console.error(`OPA tests FAILED for ${label}:`);
    console.error(err.stdout || err.message);
    return false;
  }
}

function buildWasm(opaPath, regoDir, entrypoint, wasmOutput, packId) {
  const tempBundle = join(tmpdir(), `matchboard-policy-${packId}-${Date.now()}.tar.gz`);
  const tempExtractDir = join(tmpdir(), `matchboard-extract-${packId}-${Date.now()}`);

  try {
    console.log(`  Compiling ${packId}...`);
    execFileSync(opaPath, [
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
      console.error(`  policy.wasm not found in bundle for ${packId}`);
      return false;
    }

    mkdirSync(resolve(wasmOutput, ".."), { recursive: true });
    writeFileSync(wasmOutput, readFileSync(extractedWasm));
    console.log(`  Compiled: ${wasmOutput}`);
    return true;
  } catch (err) {
    console.error(`  Build failed for ${packId}: ${err.message}`);
    return false;
  } finally {
    try { unlinkSync(tempBundle); } catch {}
    try { rmSync(tempExtractDir, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  console.log("=== Policy Sync ===\n");

  console.log("Step 1: Resolve OPA binary...");
  const opaPath = resolveOpaPath();

  if (!opaPath) {
    console.log("OPA not found locally. Running bootstrap...");
    try {
      execFileSync("node", [join(REPO_ROOT, "scripts", "bootstrap-opa.mjs")], {
        stdio: "inherit",
        cwd: REPO_ROOT,
      });
    } catch {
      console.error("OPA bootstrap failed. Cannot continue.");
      process.exit(1);
    }

    const resolvedOpa = resolveOpaPath();
    if (!resolvedOpa) {
      console.error("OPA binary not available after bootstrap. Cannot continue.");
      process.exit(1);
    }
  }

  const resolvedOpa = opaPath || resolveOpaPath();
  if (!resolvedOpa) {
    console.error("OPA binary not available. Cannot continue.");
    process.exit(1);
  }

  console.log(`Using OPA: ${resolvedOpa}`);

  console.log("\nStep 2: Test deployable packs...");
  const packIds = listPackIds();
  const deployablePacks = packIds.filter((id) => isDeployablePack(id));

  if (deployablePacks.length === 0) {
    console.log("No deployable packs found.");
  }

  let allTestsPassed = true;

  for (const packId of deployablePacks) {
    const metadataPath = join(PACKS_DIR, packId, "policy-pack.json");
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    const regoDir = resolve(join(PACKS_DIR, packId), metadata.regoDirectory);

    if (!existsSync(regoDir)) {
      console.error(`  Rego directory not found for ${packId}: ${regoDir}`);
      allTestsPassed = false;
      continue;
    }

    if (!runOpaTests(resolvedOpa, regoDir, `pack '${packId}'`)) {
      allTestsPassed = false;
    }
  }

  if (!allTestsPassed) {
    console.error("\nTest failures detected. Fix tests before compiling.");
    process.exit(1);
  }

  console.log("\nStep 3: Compile deployable packs to Wasm...");
  for (const packId of deployablePacks) {
    const metadataPath = join(PACKS_DIR, packId, "policy-pack.json");
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    const regoDir = resolve(join(PACKS_DIR, packId), metadata.regoDirectory);
    const wasmOutput = resolve(join(PACKS_DIR, packId), metadata.compiledWasm);

    if (!buildWasm(resolvedOpa, regoDir, metadata.entrypoint, wasmOutput, packId)) {
      console.error(`Compilation failed for ${packId}.`);
      process.exit(1);
    }

    const hash = updatePackHash(packId, wasmOutput);
    console.log(`  Hash: ${hash}`);
  }

  console.log("\nStep 4: Validate pack metadata...");
  try {
    execFileSync("node", [join(REPO_ROOT, "scripts", "policy-validate.mjs")], {
      stdio: "inherit",
      cwd: REPO_ROOT,
    });
  } catch {
    console.error("Pack validation failed.");
    process.exit(1);
  }

  console.log("\n=== Policy Sync Complete ===");
  console.log(`Deployable packs: ${deployablePacks.join(", ") || "(none)"}`);
  console.log("Wasm artifacts are up to date with verified hashes.");
}

main().catch((err) => {
  console.error("Policy sync failed:", err.message);
  process.exit(1);
});