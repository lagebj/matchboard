#!/usr/bin/env node
/**
 * Verifies a security scanner actually EXECUTED, distinct from whether it found anything
 * (AIP-6, ARR-0031, ADR-0091). Before this, every non-blocking scanner invocation in this repo
 * (`npm run security:semgrep`/`security:deps`/`security:secrets`, and their CI equivalents in
 * security.yml) ended in `|| true` — which silently converts BOTH "scanner ran, found nothing"
 * and "scanner crashed / never ran at all" into the exact same green outcome. This script is the
 * one place that distinction is decided: it treats "did the scanner write a valid JSON results
 * file" as the execution-success signal, deliberately without parsing each tool's internal
 * result schema (osv-scanner/gitleaks/semgrep each have a different shape, and this repo has no
 * live copy of those binaries to verify schema assumptions against) — a missing or unparseable
 * output file is reliable, tool-agnostic evidence the scanner did not complete normally, since
 * every one of these tools writes its JSON output file unconditionally on a successful run, with
 * an empty results array/list if nothing was found.
 *
 * Finding COUNT is reported as best-effort, informational context only — it is never the basis
 * for the exit code. Per this repo's current scanner policy (SECURITY.md, ADR-0091), Semgrep/
 * OSV-Scanner/Gitleaks findings are advisory evidence requiring human/agent triage before code
 * changes (AGENTS.md: "A scanner finding is evidence, not proof"), not an automated blocking
 * gate — only execution failure blocks.
 *
 * Usage: node scripts/check-scanner-execution.mjs --tool <name> --file <path-to-json-output>
 * Exit codes:
 *   0 — the scanner executed and produced a valid JSON output file (regardless of finding count)
 *   1 — the scanner did not produce a valid JSON output file (execution failure)
 */

import fs from "node:fs";

function getArg(args, name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

// Best-effort, non-authoritative: used only for the informational count printed below, never
// for the exit code. Each tool's actual shape is looked up defensively — an unexpected shape
// still exits 0 (the file existed and parsed as JSON, which is the real success signal) with an
// "unknown" count rather than being treated as a failure.
function countFindings(tool, data) {
  if (tool === "gitleaks") {
    return Array.isArray(data) ? data.length : null;
  }
  if (tool === "semgrep") {
    return Array.isArray(data?.results) ? data.results.length : null;
  }
  if (tool === "osv") {
    if (!Array.isArray(data?.results)) return null;
    return data.results.reduce((sum, pkgResult) => {
      const vulnGroups = Array.isArray(pkgResult?.packages) ? pkgResult.packages : [];
      return sum + vulnGroups.reduce((s, p) => s + (Array.isArray(p?.vulnerabilities) ? p.vulnerabilities.length : 0), 0);
    }, 0);
  }
  return null;
}

export function checkScannerExecution(tool, file) {
  if (!fs.existsSync(file)) {
    return {
      ok: false,
      message:
        `SCANNER EXECUTION FAILURE: ${tool} did not produce an output file at ${file}. ` +
        "This means the scanner itself failed to run (bad config, missing binary, crash) — " +
        "not that it found zero issues. Treating as a required-check failure, not a clean scan.",
    };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    return {
      ok: false,
      message:
        `SCANNER EXECUTION FAILURE: ${tool}'s output file at ${file} is not valid JSON ` +
        `(${error instanceof Error ? error.message : String(error)}). Treating as a required-check ` +
        "failure, not a clean scan.",
    };
  }

  const count = countFindings(tool, data);
  const countLabel = count === null ? "unknown (unexpected output shape)" : String(count);
  const lines = [`${tool}: scanner executed successfully. Findings: ${countLabel}.`];
  if (count && count > 0) {
    lines.push(
      `::warning::${count} ${tool} finding(s) detected — advisory only per current scanner policy (SECURITY.md). Review ${file}.`,
    );
  }
  return { ok: true, message: lines.join("\n") };
}

function main() {
  const args = process.argv.slice(2);
  const tool = getArg(args, "tool");
  const file = getArg(args, "file");

  if (!tool || !file) {
    console.error("Usage: node scripts/check-scanner-execution.mjs --tool <semgrep|osv|gitleaks> --file <path>");
    process.exit(1);
  }

  const result = checkScannerExecution(tool, file);
  if (result.ok) {
    console.log(result.message);
    process.exit(0);
  } else {
    console.error(result.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
