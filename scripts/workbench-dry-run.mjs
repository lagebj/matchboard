#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { getEntrypoint } from "./policy-metadata-utils.mjs";

const REPO_ROOT = join(import.meta.dirname, "..");
const PACKS_DIR = join(REPO_ROOT, "policies", "packs");
const FIXTURES_DIR = join(REPO_ROOT, "test", "fixtures", "workbench");
const LEGACY_WASM_PATH = join(REPO_ROOT, "policies", "compiled", "matchboard_selection.wasm");
const DEFAULT_PACK_ID = "matchboard-default";

function parseArgs() {
  const args = process.argv.slice(2);
  let packId = null;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pack" && args[i + 1]) {
      packId = args[i + 1];
      i++;
    } else if (!args[i].startsWith("--")) {
      positional.push(args[i]);
    }
  }

  return { packId, positional };
}

function resolveWasmPath(packId) {
  if (process.env.MATCHBOARD_POLICY_WASM_PATH) {
    return process.env.MATCHBOARD_POLICY_WASM_PATH;
  }

  if (packId) {
    const metadataPath = join(PACKS_DIR, packId, "policy-pack.json");
    if (!existsSync(metadataPath)) {
      console.error(`Pack '${packId}' metadata not found: ${metadataPath}`);
      process.exit(1);
    }
    try {
      const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
      return resolve(join(PACKS_DIR, packId), metadata.compiledWasm);
    } catch (err) {
      console.error(`Invalid metadata for pack '${packId}': ${err.message}`);
      process.exit(1);
    }
  }

  return LEGACY_WASM_PATH;
}

function loadPackMetadataRaw(packId) {
  const metadataPath = join(PACKS_DIR, packId, "policy-pack.json");
  if (!existsSync(metadataPath)) return null;
  try {
    return JSON.parse(readFileSync(metadataPath, "utf-8"));
  } catch {
    return null;
  }
}

function resolvePackInfo(packId) {
  if (!packId) return { id: null, name: null, version: null };
  const metadata = loadPackMetadataRaw(packId);
  if (!metadata) return { id: packId, name: null, version: null };
  return { id: metadata.id, name: metadata.name, version: metadata.version };
}

function listFixtures() {
  if (!existsSync(FIXTURES_DIR)) {
    console.error(`Fixtures directory not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

function printUsage() {
  console.log("Workbench Policy Dry Run");
  console.log("");
  console.log("Run policy evaluation against workbench fixtures without starting the app.");
  console.log("");
  console.log("Usage: npm run workbench:dry-run -- [options] [fixture-name|fixture-path]");
  console.log("");
  console.log("Options:");
  console.log("  --pack <pack-id>  Use policy pack instead of legacy Wasm path");
  console.log("  --list            List available fixtures");
  console.log("  --help            Show this help message");
  console.log("");
  console.log("Environment variables:");
  console.log("  MATCHBOARD_POLICY_WASM_PATH       Path to compiled Wasm policy (overrides --pack)");
  console.log("  MATCHBOARD_POLICY_PACK_ID         Policy pack to load (default: matchboard-default)");
  console.log("");
  console.log("Examples:");
  console.log("  npm run workbench:dry-run -- -list");
  console.log("  npm run workbench:dry-run -- league-match-selection.json");
  console.log("  npm run workbench:dry-run -- --pack matchboard-default event-selection-input.json");
  console.log("");
  console.log("Note: Default policy (TypeScript) evaluation is not available in standalone dry-run.");
  console.log("Use vitest to run default policy tests. This script only evaluates Rego Wasm policies.");
}

function resolveFixturePath(arg) {
  if (existsSync(arg)) {
    return resolve(arg);
  }
  const withDir = join(FIXTURES_DIR, arg);
  if (existsSync(withDir)) {
    return withDir;
  }
  const withExt = arg.endsWith(".json") ? withDir : `${withDir}.json`;
  if (existsSync(withExt)) {
    return withExt;
  }
  console.error(`Fixture not found: ${arg}`);
  console.error(`Searched: ${arg}, ${withDir}, ${withExt}`);
  process.exit(1);
}

async function runDryRun(fixturePath, packId) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));
  const wasmPath = resolveWasmPath(packId);
  const packInfo = resolvePackInfo(packId ?? process.env.MATCHBOARD_POLICY_PACK_ID);

  console.log("\n=== Workbench Policy Dry Run ===\n");
  console.log(`Fixture: ${fixture.id ?? fixturePath}`);
  console.log(`Label: ${fixture.label ?? "N/A"}`);
  console.log(`Description: ${fixture.description ?? "N/A"}`);
  console.log(`Mode: ${fixture.input?.context?.mode ?? "unknown"}`);
  console.log(`Decision type: ${fixture.input?.context?.decisionType ?? "unknown"}`);
  console.log(`Players: ${fixture.input?.players?.length ?? 0}`);
  console.log(`Teams: ${fixture.input?.teams?.length ?? 0}`);
  console.log(`Squads: ${fixture.input?.squads?.length ?? 0}`);
  console.log(`Matches: ${fixture.input?.matches?.length ?? 0}`);

  if (packInfo.id) {
    console.log(`Pack: ${packInfo.id} (v${packInfo.version ?? "?"}, ${packInfo.name ?? "?"})`);
  }
  console.log(`Wasm path: ${wasmPath}`);

  const input = fixture.input ?? fixture;

  console.log("\n--- Default Matchboard Policy (TypeScript) ---");
  console.log("Default policy evaluation unavailable in standalone dry-run.");
  console.log("Use vitest to run default policy and workbench fixture tests:");
  console.log("  npx vitest run src/lib/workbench/__tests__/");

  {
    console.log("\n--- Rego Policy (Wasm) ---");
    try {
      if (!existsSync(wasmPath)) {
        console.error(`Compiled Wasm policy not found at: ${wasmPath}`);
        if (packId) {
          console.error(`Run 'npm run policy:build -- --pack ${packId}' to compile.`);
        } else {
          console.error("Run 'npm run policy:build' to compile Rego source.");
        }
        process.exit(1);
      }

      const packMetadata = loadPackMetadataRaw(packId ?? DEFAULT_PACK_ID);
      const entrypointPath = packMetadata ? getEntrypoint(packMetadata, "selection") : undefined;

      const { loadPolicy } = await import("@open-policy-agent/opa-wasm");
      const wasmBuffer = readFileSync(wasmPath);
      const policy = await loadPolicy(wasmBuffer);
      const startTime = performance.now();
      const regoResult = policy.evaluate(input, entrypointPath);
      const duration = performance.now() - startTime;

      if (!Array.isArray(regoResult) || regoResult.length === 0) {
        console.error("Rego policy returned empty result.");
        process.exit(1);
      }

      const decision = regoResult[0]?.result ?? regoResult[0];
      console.log(`\nRego evaluation completed in ${Math.round(duration * 100) / 100}ms`);
      console.log("\nRego decision:");
      console.log(JSON.stringify(decision, null, 2));

      const blocked = decision?.blocked ?? [];
      const warnings = decision?.warnings ?? [];
      const scoreAdjustments = decision?.score_adjustments ?? [];
      const explanations = decision?.explanations ?? [];
      const tags = decision?.tags ?? [];

      console.log(`\nBlocked players: ${Array.isArray(blocked) ? blocked.length : Object.keys(blocked).length}`);
      console.log(`Warnings: ${warnings.length}`);
      console.log(`Score adjustments: ${scoreAdjustments.length}`);
      console.log(`Explanations: ${explanations.length}`);
      console.log(`Tags: ${tags.length}`);

      if (warnings.length > 0) {
        console.log("\nWarnings:");
        for (const w of warnings) {
          console.log(`  [${w.severity ?? "unknown"}] ${w.code ?? "unknown"}: ${w.message ?? ""}`);
        }
      }

      if (scoreAdjustments.length > 0) {
        console.log("\nScore adjustments:");
        for (const adj of scoreAdjustments) {
          console.log(`  ${adj.player_id ?? adj.playerId ?? "?"}: delta=${adj.delta ?? 0} (${adj.code ?? "?"}: ${adj.reason ?? ""})`);
        }
      }
    } catch (error) {
      console.error("Rego evaluation failed:", error.message);
      process.exit(1);
    }
  }

  console.log("\n=== Dry Run Complete ===\n");
}

const { packId, positional } = parseArgs();

if (positional.includes("--help") || positional.includes("-h")) {
  printUsage();
  process.exit(0);
}

if (positional.includes("--list")) {
  const fixtures = listFixtures();
  console.log("Available workbench fixtures:");
  for (const f of fixtures) {
    try {
      const data = JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf-8"));
      console.log(`  ${f.padEnd(50)} ${data.label ?? "N/A"} [${data.mode ?? "?"}/${data.decisionType ?? "?"}]`);
    } catch {
      console.log(`  ${f}`);
    }
  }
  process.exit(0);
}

const filteredArgs = positional.filter((a) => !a.startsWith("--"));

if (filteredArgs.length === 0) {
  console.error("No fixture specified. Use --list to see available fixtures or --help for usage.");
  process.exit(1);
}

const fixturePath = resolveFixturePath(filteredArgs[0]);
runDryRun(fixturePath, packId).catch((err) => {
  console.error("Dry run failed:", err);
  process.exit(1);
});