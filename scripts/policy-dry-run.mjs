#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");
const PACKS_DIR = join(REPO_ROOT, "policies", "packs");
const LEGACY_WASM_PATH = join(REPO_ROOT, "policies", "compiled", "matchboard_selection.wasm");
const REGO_ENABLED = (process.env.MATCHBOARD_POLICY_REGO_ENABLED ?? "false") === "true";

function parseArgs() {
  const args = process.argv.slice(2);
  let packId = null;
  let fixturePath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pack" && args[i + 1]) {
      packId = args[i + 1];
      i++;
    } else if (!args[i].startsWith("--")) {
      fixturePath = args[i];
    }
  }

  return { packId, fixturePath };
}

function resolvePackWasm(packId) {
  const metadataPath = join(PACKS_DIR, packId, "policy-pack.json");
  if (!existsSync(metadataPath)) {
    console.error(`Pack '${packId}' metadata not found: ${metadataPath}`);
    process.exit(1);
  }

  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
  } catch (err) {
    console.error(`Invalid metadata: ${err.message}`);
    process.exit(1);
  }

  return resolve(join(PACKS_DIR, packId), metadata.compiledWasm);
}

function resolvePackFixture(packId, fixtureName) {
  if (!fixtureName) return null;
  const metadataPath = join(PACKS_DIR, packId, "policy-pack.json");
  if (!existsSync(metadataPath)) return null;

  try {
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    const fixturesDir = resolve(join(PACKS_DIR, packId), metadata.fixturesDirectory);
    const fullPath = resolve(fixturesDir, fixtureName);
    if (existsSync(fullPath)) return fullPath;
  } catch {}

  return null;
}

function listPackFixtures(packId) {
  const metadataPath = join(PACKS_DIR, packId, "policy-pack.json");
  if (!existsSync(metadataPath)) return [];

  try {
    const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
    const fixturesDir = resolve(join(PACKS_DIR, packId), metadata.fixturesDirectory);
    if (!existsSync(fixturesDir)) return [];
    return readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
}

async function runDryRun() {
  const { packId, fixturePath } = parseArgs();

  const defaultFixture = packId
    ? null
    : join(process.cwd(), "test", "fixtures", "policies", "event-selection-input.json");
  const resolvedFixture = fixturePath ?? defaultFixture;

  const wasmPath = packId
    ? resolvePackWasm(packId)
    : (process.env.MATCHBOARD_POLICY_WASM_PATH ?? LEGACY_WASM_PATH);

  console.log("\n=== Policy Dry Run ===\n");
  console.log(`Rego enabled: ${REGO_ENABLED}`);

  if (packId) {
    console.log(`Pack: ${packId}`);
  }

  if (REGO_ENABLED) {
    console.log(`Wasm path: ${wasmPath}`);
  }

  if (!REGO_ENABLED) {
    console.log("\nRego policy is not enabled. Set MATCHBOARD_POLICY_REGO_ENABLED=true to enable.");
    console.log("\n=== Dry Run Complete ===\n");
    return;
  }

  if (!existsSync(wasmPath)) {
    console.error(`Compiled Wasm policy not found at: ${wasmPath}`);
    console.error(packId
      ? `Run 'npm run policy:build -- --pack ${packId}' to compile.`
      : "Run 'npm run policy:build' to compile Rego source.");
    process.exit(1);
  }

  if (packId && !resolvedFixture) {
    const fixtures = listPackFixtures(packId);
    console.log(`\nNo fixture specified. Available fixtures for pack '${packId}':`);
    if (fixtures.length === 0) {
      console.log("  (none found)");
    } else {
      for (const f of fixtures) {
        console.log(`  ${f}`);
      }
    }
    console.log("\nUsage: npm run policy:dry-run -- --pack <pack-id> <fixture-name>");
    console.log("   or: npm run policy:dry-run -- --pack <pack-id> /path/to/fixture.json");
    process.exit(1);
  }

  if (!resolvedFixture || !existsSync(resolvedFixture)) {
    console.error(`Fixture not found: ${resolvedFixture ?? "(not specified)"}`);
    process.exit(1);
  }

  console.log(`Fixture: ${resolvedFixture}`);

  const input = JSON.parse(readFileSync(resolvedFixture, "utf-8"));
  console.log(`Players: ${input.players?.length ?? 0}`);
  console.log(`Teams: ${input.teams?.length ?? 0}`);
  console.log(`Squads: ${input.squads?.length ?? 0}`);

  console.log("\n--- Core Invariants (TypeScript) ---");
  console.log("Core invariants check unavailable in standalone dry-run.");
  console.log("Use vitest to run core invariant tests.");

  console.log("\n--- Default Matchboard Policy (TypeScript) ---");
  console.log("Default policy evaluation unavailable in standalone dry-run.");
  console.log("Use vitest to run default policy tests.");

  console.log("\n--- Rego Policy (Wasm) ---");
  try {
    const { loadPolicy } = await import("@open-policy-agent/opa-wasm");
    const wasmBuffer = readFileSync(wasmPath);
    const policy = await loadPolicy(wasmBuffer);

    const result = policy.evaluate(input);

    if (!Array.isArray(result) || result.length === 0) {
      console.error("Rego policy returned empty result.");
      process.exit(1);
    }

    const decision = result[0]?.result ?? result[0];
    console.log("\nRego decision:");
    console.log(JSON.stringify(decision, null, 2));

    const blocked = decision?.blocked ?? [];
    const warnings = decision?.warnings ?? [];
    const scoreAdjustments = decision?.score_adjustments ?? [];
    const explanations = decision?.explanations ?? [];
    const tags = decision?.tags ?? [];

    console.log(`\nBlocked players: ${blocked.length}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log(`Score adjustments: ${scoreAdjustments.length}`);
    console.log(`Explanations: ${explanations.length}`);
    console.log(`Tags: ${tags.length}`);

    if (warnings.length > 0) {
      console.log("\nWarnings:");
      for (const w of warnings) {
        console.log(`  [${w.severity}] ${w.code}: ${w.message}`);
      }
    }

    if (scoreAdjustments.length > 0) {
      console.log("\nScore adjustments:");
      for (const adj of scoreAdjustments) {
        console.log(`  ${adj.player_id}: delta=${adj.delta} (${adj.code}: ${adj.reason})`);
      }
    }
  } catch (error) {
    console.error("Rego evaluation failed:", error.message);
    const failureMode = process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE ?? "fail_closed";
    if (failureMode !== "fail_open") {
      process.exit(1);
    }
    console.log("(fail_open: continuing with default policy only)");
  }

  console.log("\n=== Dry Run Complete ===\n");
}

runDryRun().catch((err) => {
  console.error("Dry run failed:", err);
  process.exit(1);
});