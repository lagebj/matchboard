#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, unlinkSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { resolveOpaPath, REPO_ROOT } from "./policy-utils.mjs";
import { buildEntrypointArgs } from "./policy-metadata-utils.mjs";

const PACKS_DIR = join(REPO_ROOT, "policies", "packs");

// `opa build -t wasm` is NOT byte-reproducible across host CPU architectures for identical Rego
// (ARR-0037 — verified in CI). The committed artifact is canonical for ONE architecture: amd64
// (`x64`), which is what GitHub's `ubuntu-24.04` runners and the `policy-verify` CI job use.
// On any other architecture (an arm64 devcontainer / Apple Silicon), a rebuild-hash `DRIFT` on
// a clean tree is EXPECTED, not a regression — so off the canonical arch it is reported as a
// WARNING and does not fail the check. The deterministic stored-hash check and `opa build`
// success (real Rego breakage) still hard-fail everywhere. `--strict` or a matching
// `MATCHBOARD_POLICY_CANONICAL_ARCH` forces the hard failure regardless (used by CI).
const CANONICAL_ARCH = process.env.MATCHBOARD_POLICY_CANONICAL_ARCH || "x64";
const IS_CANONICAL_ARCH = process.arch === CANONICAL_ARCH;
const STRICT = process.argv.includes("--strict");
const ENFORCE_REBUILD_HASH = IS_CANONICAL_ARCH || STRICT;

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
        ...buildEntrypointArgs(metadata),
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
        const label = ENFORCE_REBUILD_HASH ? "DRIFT" : "DRIFT (expected off canonical arch)";
        console.error(`  ${label}: Rebuilt Wasm hash differs from committed artifact`);
        console.error(`  Committed: ${currentHash}`);
        console.error(`  Rebuilt:   ${rebuiltHash}`);
        if (ENFORCE_REBUILD_HASH) {
          console.error(`  Run 'npm run policy:sync' to update.`);
          allVerified = false;
        } else {
          console.error(
            `  Host arch is '${process.arch}', not the canonical '${CANONICAL_ARCH}' (ARR-0037): ` +
              `opa build -t wasm is not byte-reproducible across architectures. The committed ` +
              `artifact is verified by CI's amd64 policy-verify job. Do NOT run 'npm run ` +
              `policy:sync' to "fix" this — it would commit a wrong-architecture artifact. ` +
              `Behavioural equivalence still holds (opa build succeeded, entrypoints present).`,
          );
        }
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
  if (!ENFORCE_REBUILD_HASH) {
    console.log(
      `(rebuild-hash comparison advisory only on '${process.arch}' — canonical arch is ` +
        `'${CANONICAL_ARCH}', enforced by CI; stored-hash + opa build checks passed)`,
    );
  } else {
    console.log("All committed Wasm artifacts are current and match fresh builds.");
  }
}

main().catch((err) => {
  console.error("Policy verify failed:", err.message);
  process.exit(1);
});