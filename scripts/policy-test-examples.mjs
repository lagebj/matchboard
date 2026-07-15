#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveOpaPath, REPO_ROOT } from "./policy-utils.mjs";

const EXAMPLES_REGO_DIR = join(REPO_ROOT, "policies", "examples", "rego");

function main() {
  const opaPath = resolveOpaPath();
  if (!opaPath) {
    console.error("OPA binary not found. Run 'npm run policy:sync' first, or install OPA globally.");
    process.exit(1);
  }

  console.log("=== Testing Example Policies ===\n");

  const testDirs = [];

  if (existsSync(EXAMPLES_REGO_DIR)) {
    testDirs.push({ label: "example policies", path: EXAMPLES_REGO_DIR });
  }

  const examplesPacksDir = join(REPO_ROOT, "policies", "examples", "packs");
  if (existsSync(examplesPacksDir)) {
    const packEntries = readdirSync(examplesPacksDir, { withFileTypes: true });
    for (const entry of packEntries) {
      if (!entry.isDirectory()) continue;
      const packDir = join(examplesPacksDir, entry.name);
      const metadataPath = join(packDir, "policy-pack.json");
      if (existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
          const regoDir = resolve(packDir, metadata.regoDirectory);
          if (existsSync(regoDir)) {
            testDirs.push({ label: `example pack '${entry.name}'`, path: regoDir });
          }
        } catch {}
      }
    }
  }

  if (testDirs.length === 0) {
    console.log("No example policy directories found.");
    return;
  }

  let allPassed = true;

  for (const { label, path } of testDirs) {
    console.log(`Testing ${label}...`);
    try {
      const result = execFileSync(opaPath, ["test", path, "-v"], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
      console.log(result);
    } catch (err) {
      console.error(`FAILED: ${label}`);
      console.error(err.stdout || err.message);
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error("\nSome example tests failed.");
    process.exit(1);
  }

  console.log("\n=== All Example Tests Passed ===");
}

main();