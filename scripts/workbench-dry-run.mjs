#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const FIXTURES_DIR = join(process.cwd(), "test", "fixtures", "workbench");
const WASM_PATH = process.env.MATCHBOARD_POLICY_WASM_PATH ?? join(process.cwd(), "policies", "compiled", "matchboard_selection.wasm");
const REGO_ENABLED = (process.env.MATCHBOARD_POLICY_REGO_ENABLED ?? "false") === "true";

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
  console.log("Usage: npm run workbench:dry-run -- [fixture-name|fixture-path]");
  console.log("");
  console.log("Options:");
  console.log("  --list     List available fixtures");
  console.log("  --help     Show this help message");
  console.log("");
  console.log("Environment variables:");
  console.log("  MATCHBOARD_POLICY_REGO_ENABLED   Enable Rego policy evaluation (default: false)");
  console.log("  MATCHBOARD_POLICY_WASM_PATH        Path to compiled Wasm policy");
  console.log("  MATCHBOARD_POLICY_REGO_FAILURE_MODE Failure mode for Rego (default: fail_closed)");
  console.log("");
  console.log("Examples:");
  console.log("  npm run workbench:dry-run -- --list");
  console.log("  npm run workbench:dry-run -- league-match-selection.json");
  console.log("  npm run workbench:dry-run -- test/fixtures/workbench/league-match-selection.json");
  console.log("  MATCHBOARD_POLICY_REGO_ENABLED=true npm run workbench:dry-run -- event-balanced-three-squads.json");
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

async function runDryRun(fixturePath) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

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
  console.log(`Rego enabled: ${REGO_ENABLED}`);

  const input = fixture.input ?? fixture;

  console.log("\n--- Default Matchboard Policy (TypeScript) ---");
  console.log("Default policy evaluation unavailable in standalone dry-run.");
  console.log("Use vitest to run default policy and workbench fixture tests:");
  console.log("  npx vitest run src/lib/workbench/__tests__/");

  if (REGO_ENABLED) {
    console.log("\n--- Rego Policy (Wasm) ---");
    try {
      if (!existsSync(WASM_PATH)) {
        console.error(`Compiled Wasm policy not found at: ${WASM_PATH}`);
        console.error("Run 'npm run policy:build' to compile Rego source.");
        process.exit(1);
      }

      const { loadPolicy } = await import("@open-policy-agent/opa-wasm");
      const wasmBuffer = readFileSync(WASM_PATH);
      const policy = await loadPolicy(wasmBuffer);
      const startTime = performance.now();
      const regoResult = policy.evaluate(input);
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
      const failureMode = process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE ?? "fail_closed";
      if (failureMode !== "fail_open") {
        process.exit(1);
      }
      console.log("(fail_open: continuing despite Rego failure)");
    }
  } else {
    console.log("\nRego policy is not enabled. Set MATCHBOARD_POLICY_REGO_ENABLED=true to enable.");
  }

  console.log("\n=== Dry Run Complete ===\n");
}

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  printUsage();
  process.exit(0);
}

if (args.includes("--list")) {
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

if (args.length === 0) {
  console.error("No fixture specified. Use --list to see available fixtures or --help for usage.");
  process.exit(1);
}

const fixturePath = resolveFixturePath(args[0]);
runDryRun(fixturePath).catch((err) => {
  console.error("Dry run failed:", err);
  process.exit(1);
});