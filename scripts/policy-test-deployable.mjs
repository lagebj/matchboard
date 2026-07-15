#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveOpaPath, REPO_ROOT } from "./policy-utils.mjs";

const PACKS_DIR = join(REPO_ROOT, "policies", "packs");
const EXAMPLES_REGO_DIR = join(REPO_ROOT, "policies", "examples", "rego");

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

function main() {
  const args = process.argv.slice(2);
  let targetPackId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pack" && args[i + 1]) {
      targetPackId = args[i + 1];
      break;
    }
  }

  const opaPath = resolveOpaPath();
  if (!opaPath) process.exit(1);

  const packIds = listPackIds();

  let targets;
  if (targetPackId) {
    targets = [targetPackId];
  } else {
    targets = packIds.filter((id) => isDeployablePack(id));
  }

  if (targets.length === 0) {
    console.log("No deployable packs found to test.");
    if (packIds.length > 0) {
      console.log(`Available packs: ${packIds.join(", ")}`);
      console.log("Use --pack <id> to test a specific pack, or set deployable: true in policy-pack.json.");
    }
    return;
  }

  let allPassed = true;

  for (const packId of targets) {
    const metadataPath = join(PACKS_DIR, packId, "policy-pack.json");
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    const regoDir = resolve(join(PACKS_DIR, packId), metadata.regoDirectory);

    if (!existsSync(regoDir)) {
      console.error(`Rego directory not found for pack '${packId}': ${regoDir}`);
      allPassed = false;
      continue;
    }

    console.log(`Testing pack '${packId}'...`);
    console.log(`  Rego: ${regoDir}`);

    try {
      const result = execFileSync(opaPath, ["test", regoDir, "-v"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      console.log(result);
    } catch (err) {
      console.error(`FAILED: Pack '${packId}' tests`);
      console.error(err.stdout || err.message);
      allPassed = false;
    }
  }

  if (!allPassed) {
    process.exit(1);
  }

  console.log("All deployable pack tests passed.");
}

main();