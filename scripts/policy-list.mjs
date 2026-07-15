#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const PACKS_DIR = join(process.cwd(), "policies", "packs");

function listPacks() {
  if (!existsSync(PACKS_DIR)) {
    console.log("No packs directory found.");
    return;
  }

  const entries = readdirSync(PACKS_DIR, { withFileTypes: true });
  const packs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const metadataPath = join(PACKS_DIR, entry.name, "policy-pack.json");
    if (!existsSync(metadataPath)) continue;

    try {
      const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
      const wasmPath = resolve(join(PACKS_DIR, entry.name), metadata.compiledWasm);
      const hasCompiled = existsSync(wasmPath);

      packs.push({
        id: metadata.id,
        name: metadata.name,
        version: metadata.version,
        description: metadata.description ?? "",
        entrypoint: metadata.entrypoint,
        runtime: metadata.runtime,
        hasCompiled,
        directory: join(PACKS_DIR, entry.name),
      });
    } catch (err) {
      console.error(`Error reading pack '${entry.name}': ${err.message}`);
    }
  }

  if (packs.length === 0) {
    console.log("No policy packs found.");
    return;
  }

  console.log("\n=== Policy Packs ===\n");
  console.log(`MATCHBOARD_POLICY_PACK_ID=${process.env.MATCHBOARD_POLICY_PACK_ID ?? "(not set, defaults to matchboard-default)"}`);

  for (const pack of packs) {
    console.log(`\n  ${pack.id} (v${pack.version})`);
    console.log(`    Name: ${pack.name}`);
    console.log(`    Description: ${pack.description}`);
    console.log(`    Entrypoint: ${pack.entrypoint}`);
    console.log(`    Runtime: ${pack.runtime}`);
    console.log(`    Compiled: ${pack.hasCompiled ? "YES" : "NO — run 'npm run policy:build -- --pack " + pack.id + "'"}`);
    console.log(`    Directory: ${pack.directory}`);
  }

  console.log("\n=== End ===\n");
}

listPacks();