#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, unlinkSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { resolveOpaPath, REPO_ROOT } from "./policy-utils.mjs";

const PACKS_DIR = join(REPO_ROOT, "policies", "packs");

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

async function main() {
  console.log("=== Policy Verify ===\n");

  const opaPath = resolveOpaPath();
  if (!opaPath) {
    console.error("OPA binary not found. Run 'npm run policy:sync' first.");
    process.exit(1);
  }

  const packDirs = readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(PACKS_DIR, d.name, "policy-pack.json")));

  let allVerified = true;

  for (const dir of packDirs) {
    const packId = dir.name;
    const metadataPath = join(PACKS_DIR, packId, "policy-pack.json");
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    const wasmPath = resolve(join(PACKS_DIR, packId), metadata.compiledWasm);

    console.log(`Checking pack: ${packId}`);

    if (!existsSync(wasmPath)) {
      console.error(`  MISSING: Wasm artifact not found at ${wasmPath}`);
      allVerified = false;
      continue;
    }

    const currentHash = computeFileHash(wasmPath);
    const storedHash = metadata.wasmHash;

    if (!storedHash) {
      console.error(`  WARNING: No wasmHash in policy-pack.json. Run 'npm run policy:sync' to populate.`);
      allVerified = false;
      continue;
    }

    if (currentHash !== storedHash) {
      console.error(`  MISMATCH: Stored hash ${storedHash}`);
      console.error(`  MISMATCH: Actual hash ${currentHash}`);
      console.error(`  The Wasm artifact has been modified since last sync. Run 'npm run policy:sync' to update.`);
      allVerified = false;
      continue;
    }

    if (!isDeployablePack(packId)) {
      console.log(`  SKIP: Non-deployable pack (wasm hash OK)`);
      continue;
    }

    const regoDir = resolve(join(PACKS_DIR, packId), metadata.regoDirectory);
    const tempBundle = join(tmpdir(), `matchboard-verify-${packId}-${Date.now()}.tar.gz`);
    const tempExtractDir = join(tmpdir(), `matchboard-verify-extract-${packId}-${Date.now()}`);

    try {
      execFileSync(opaPath, [
        "build",
        regoDir,
        "-t", "wasm",
        "-e", metadata.entrypoint,
        "-o", tempBundle,
      ], { stdio: "pipe" });

      mkdirSync(tempExtractDir, { recursive: true });
      execFileSync("tar", ["-xzf", tempBundle, "-C", tempExtractDir], { stdio: "pipe" });

      const rebuiltWasm = join(tempExtractDir, "policy.wasm");
      if (!existsSync(rebuiltWasm)) {
        console.error(`  FAIL: Could not rebuild Wasm for verification`);
        allVerified = false;
        continue;
      }

      const rebuiltHash = computeFileHash(rebuiltWasm);

      if (rebuiltHash !== currentHash) {
        console.error(`  DRIFT: Rebuilt Wasm hash differs from committed artifact`);
        console.error(`  Committed: ${currentHash}`);
        console.error(`  Rebuilt:   ${rebuiltHash}`);
        console.error(`  Run 'npm run policy:sync' to update.`);
        allVerified = false;
      } else {
        console.log(`  VERIFIED: Committed Wasm matches fresh build`);
      }
    } catch (err) {
      console.error(`  FAIL: Could not rebuild Wasm for ${packId}: ${err.message}`);
      allVerified = false;
    } finally {
      try { unlinkSync(tempBundle); } catch {}
      try { rmSync(tempExtractDir, { recursive: true, force: true }); } catch {}
    }
  }

  if (!allVerified) {
    console.log("\n=== Verification FAILED ===");
    console.log("Some Wasm artifacts are out of date or missing.");
    console.log("Run 'npm run policy:sync' to rebuild.");
    process.exit(1);
  }

  console.log("\n=== Verification PASSED ===");
  console.log("All committed Wasm artifacts are current and match fresh builds.");
}

main().catch((err) => {
  console.error("Policy verify failed:", err.message);
  process.exit(1);
});