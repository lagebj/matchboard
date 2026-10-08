#!/usr/bin/env node

/**
 * ADR-0158 maintenance gate: low-noise dead/unreferenced-code check (Knip).
 *
 * Only enforces the "unused files" category (reachability-dead: nothing imports, routes to,
 * schedules, or reads it -- the bundle's own "delete it" bar). Knip's other categories (unused
 * exports/types/duplicate-exports/dependencies) are far noisier in this codebase (many small
 * exported types/interfaces that are only ever used via `import type` within their own
 * module, or re-exported through a barrel) and are not what this gate is for; running `npx knip`
 * directly still surfaces them for anyone who wants to look.
 *
 * Restricting categories via `--include`/`rules: "off"` has a real Knip quirk in this repo: it
 * silently breaks the Vitest plugin's entry detection for the component test suite
 * (`vitest.config.components.ts`), flooding "unused files" with every `*.test.tsx`. Running the
 * full default analysis and filtering in this wrapper avoids that quirk entirely.
 */

import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["knip", "--no-exit-code", "--reporter", "json"], {
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 64,
});

if (result.error) {
  console.error("Failed to run knip:", result.error);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (e) {
  console.error("Could not parse knip JSON output:");
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(1);
}

const unusedFiles = report.issues.filter((i) => i.files && i.files.length > 0).map((i) => i.file);

if (unusedFiles.length === 0) {
  console.log("✓ No unreferenced files found.");
  process.exit(0);
}

console.error(`✗ ${unusedFiles.length} unreferenced file(s) found (nothing imports, routes to, schedules, or reads them):\n`);
for (const f of unusedFiles) console.error(`  ${f}`);
console.error(
  "\nIf genuinely dead, delete the file. If it's a real entry point Knip can't infer " +
    "(a CLI script, a framework convention it doesn't know yet, a compile-time-only test), " +
    "declare it in knip.json's `entry` or `ignore` with a comment explaining why.",
);
process.exit(1);
