#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { REPO_ROOT } from "./policy-utils.mjs";
import { resolveEntrypoints } from "./policy-metadata-utils.mjs";

const PACKS_DIR = join(REPO_ROOT, "policies", "packs");
const EXAMPLES_PACKS_DIR = join(REPO_ROOT, "policies", "examples", "packs");

function listPacksInDir(baseDir, label) {
  if (!existsSync(baseDir)) return [];

  const entries = readdirSync(baseDir, { withFileTypes: true });
  const packs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const metadataPath = join(baseDir, entry.name, "policy-pack.json");
    if (!existsSync(metadataPath)) continue;

    try {
      const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
      const wasmPath = resolve(join(baseDir, entry.name), metadata.compiledWasm);
      const hasCompiled = existsSync(wasmPath);
      const isDeployable = metadata.deployable === true;

      packs.push({
        id: metadata.id,
        name: metadata.name,
        version: metadata.version,
        description: metadata.description ?? "",
        entrypoints: resolveEntrypoints(metadata),
        schemaVersion: metadata.schemaVersion,
        failureMode: metadata.failureMode ?? "degraded_fallback",
        runtime: metadata.runtime,
        hasCompiled,
        deployable: isDeployable,
        directory: join(baseDir, entry.name),
        category: label,
        wasmHash: metadata.wasmHash ?? null,
      });
    } catch (err) {
      console.error(`Error reading pack '${entry.name}': ${err.message}`);
    }
  }

  return packs;
}

function listPacks() {
  const deployablePacks = listPacksInDir(PACKS_DIR, "deployable");
  const examplePacks = listPacksInDir(EXAMPLES_PACKS_DIR, "example");
  const allPacks = [...deployablePacks, ...examplePacks];

  if (allPacks.length === 0) {
    console.log("No policy packs found.");
    return;
  }

  console.log("\n=== Policy Packs ===\n");
  console.log(`MATCHBOARD_POLICY_PACK_ID=${process.env.MATCHBOARD_POLICY_PACK_ID ?? "(not set, defaults to matchboard-default)"}`);

  for (const pack of allPacks) {
    console.log(`\n  ${pack.id} (v${pack.version}) [${pack.category}]`);
    console.log(`    Name: ${pack.name}`);
    console.log(`    Description: ${pack.description}`);
    console.log(`    Schema version: ${pack.schemaVersion}`);
    console.log(`    Entrypoints: ${Object.entries(pack.entrypoints).map(([name, path]) => `${name}=${path}`).join(", ") || "(none declared)"}`);
    console.log(`    Failure mode: ${pack.failureMode}`);
    console.log(`    Runtime: ${pack.runtime}`);
    console.log(`    Deployable: ${pack.deployable ? "YES" : "NO"}`);
    console.log(`    Compiled: ${pack.hasCompiled ? "YES" : "NO — run 'npm run policy:sync' to compile deployable packs"}`);
    if (pack.wasmHash) {
      console.log(`    Wasm Hash: ${pack.wasmHash}`);
    }
    console.log(`    Directory: ${pack.directory}`);
  }

  console.log("\n=== End ===\n");
}

listPacks();