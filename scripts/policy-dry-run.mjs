#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_FIXTURE = join(process.cwd(), "test", "fixtures", "policies", "event-selection-input.json");
const WASM_PATH = process.env.MATCHBOARD_POLICY_WASM_PATH ?? join(process.cwd(), "policies", "compiled", "matchboard_selection.wasm");
const REGO_ENABLED = (process.env.MATCHBOARD_POLICY_REGO_ENABLED ?? "false") === "true";

async function runDryRun() {
  const fixturePath = process.argv[2] ?? DEFAULT_FIXTURE;

  if (!existsSync(fixturePath)) {
    console.error(`Fixture not found: ${fixturePath}`);
    console.error("Provide a path to a JSON fixture file.");
    console.error("Usage: npm run policy:dry-run -- [fixture-path]");
    process.exit(1);
  }

  const input = JSON.parse(readFileSync(fixturePath, "utf-8"));

  console.log("\n=== Policy Dry Run ===\n");
  console.log(`Fixture: ${fixturePath}`);
  console.log(`Rego enabled: ${REGO_ENABLED}`);
  if (REGO_ENABLED) {
    console.log(`Wasm path: ${WASM_PATH}`);
  }
  console.log(`Players: ${input.players?.length ?? 0}`);
  console.log(`Teams: ${input.teams?.length ?? 0}`);
  console.log(`Squads: ${input.squads?.length ?? 0}`);

  console.log("\n--- Core Invariants (TypeScript) ---");
  console.log("Core invariants check unavailable in standalone dry-run.");
  console.log("Use vitest to run core invariant tests.");

  console.log("\n--- Default Matchboard Policy (TypeScript) ---");
  console.log("Default policy evaluation unavailable in standalone dry-run.");
  console.log("Use vitest to run default policy tests.");

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
  } else {
    console.log("\nRego policy is not enabled. Set MATCHBOARD_POLICY_REGO_ENABLED=true to enable.");
  }

  console.log("\n=== Dry Run Complete ===\n");
}

runDryRun().catch((err) => {
  console.error("Dry run failed:", err);
  process.exit(1);
});