#!/usr/bin/env node

/**
 * Determines whether there are pending Prisma migrations against the currently-configured
 * datasource (DATABASE_URL/DIRECT_URL), and scans any pending migration's SQL for destructive
 * operations. Used by .github/workflows/production-db-migrate.yml to decide whether the
 * migration job (gated by the production-db GitHub Environment's required-reviewer approval)
 * should even be offered, and to surface a destructive-operation warning in the job summary the
 * approver sees before approving.
 *
 * Deliberately uses `prisma migrate status`'s exit code (0 = up to date, 1 = pending) as the
 * pending/not-pending signal, not `prisma migrate diff --exit-code`. The latter reports
 * pre-existing, unrelated schema drift (index/RLS differences between the declarative schema and
 * the actual migration history) on every run, even against a fully, freshly migrated database —
 * confirmed empirically before writing this script. It is not a reliable "anything pending" gate.
 *
 * Writes GITHUB_OUTPUT keys (has_pending, has_destructive) when running in GitHub Actions, and
 * appends a markdown summary to GITHUB_STEP_SUMMARY when set. Exits non-zero only when
 * `migrate status` itself fails unexpectedly (e.g. a migration stuck in a failed state) — a
 * pending migration is not a failure of this script.
 */

import { readFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const MIGRATIONS_DIR = resolve(ROOT, "prisma/migrations");

const DESTRUCTIVE_PATTERNS = [
  { label: "DROP TABLE", pattern: /\bDROP\s+TABLE\b/i },
  { label: "DROP COLUMN", pattern: /\bDROP\s+COLUMN\b/i },
  { label: "TRUNCATE", pattern: /\bTRUNCATE\b/i },
  { label: "DELETE FROM without WHERE", pattern: /\bDELETE\s+FROM\s+"?[A-Za-z_][\w]*"?\s*;/i },
  { label: "DROP TYPE", pattern: /\bDROP\s+TYPE\b/i },
];

function runMigrateStatus() {
  try {
    const stdout = execFileSync("npx", ["prisma", "migrate", "status"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { exitCode: 0, output: stdout };
  } catch (error) {
    // execFileSync throws on non-zero exit; exit code 1 with the expected "not yet applied"
    // message means pending migrations, not a real failure.
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    const exitCode = typeof error.status === "number" ? error.status : 1;
    return { exitCode, output };
  }
}

function parsePendingMigrationNames(output) {
  const lines = output.split("\n").map((l) => l.trim());
  const startIdx = lines.findIndex((l) =>
    /^Following migration.* have not yet been applied:$/i.test(l),
  );
  if (startIdx === -1) return [];
  const names = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") break;
    names.push(line);
  }
  return names;
}

// A FAILED migration ("Following migration have failed:") is a different state from a normal
// pending one ("...have not yet been applied:") — a previous `migrate deploy` attempt errored
// partway through. `prisma migrate status` exits 1 for both, but a FAILED migration needs
// `prisma migrate resolve` before anything else can run; treating it as ordinary "pending" would
// let the `migrate` job retry the exact same failing SQL. See
// .github/workflows/production-db-migrate.yml's "Recovering a FAILED migration" section.
function parseFailedMigrationNames(output) {
  const lines = output.split("\n").map((l) => l.trim());
  const startIdx = lines.findIndex((l) => /^Following migration.* have failed:$/i.test(l));
  if (startIdx === -1) return [];
  const names = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") break;
    names.push(line);
  }
  return names;
}

function scanMigrationForDestructiveOps(migrationName) {
  const sqlPath = resolve(MIGRATIONS_DIR, migrationName, "migration.sql");
  let sql;
  try {
    sql = readFileSync(sqlPath, "utf-8");
  } catch {
    return { migrationName, sqlPath, readError: true, findings: [] };
  }
  const findings = DESTRUCTIVE_PATTERNS.filter(({ pattern }) => pattern.test(sql)).map(
    ({ label }) => label,
  );
  return { migrationName, sqlPath, readError: false, findings };
}

function writeGithubOutput(key, value) {
  const outFile = process.env.GITHUB_OUTPUT;
  if (!outFile) return;
  appendFileSync(outFile, `${key}=${value}\n`);
}

function writeSummary(markdown) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) {
    console.log(markdown);
    return;
  }
  appendFileSync(summaryFile, `${markdown}\n`);
}

function main() {
  const { exitCode, output } = runMigrateStatus();

  if (exitCode !== 0 && exitCode !== 1) {
    console.error(output);
    console.error(
      `prisma migrate status exited with unexpected code ${exitCode} — this is a real ` +
        "failure (e.g. a migration stuck in a failed state), not a normal pending-migration " +
        "signal. Refusing to proceed.",
    );
    process.exit(exitCode);
  }

  if (exitCode === 0) {
    console.log("Database schema is up to date — no pending migrations.");
    writeGithubOutput("has_pending", "false");
    writeGithubOutput("has_destructive", "false");
    writeSummary("## Production DB migration check\n\nNo pending migrations. Nothing to do.");
    return;
  }

  const failedNames = parseFailedMigrationNames(output);
  if (failedNames.length > 0) {
    const lines = [
      "## Production DB migration check",
      "",
      "### One or more migrations are stuck in a FAILED state",
      "",
      ...failedNames.map((name) => `- \`${name}\``),
      "",
      "This is not a normal pending migration — a previous `migrate deploy` attempt errored " +
        "partway through applying it. The `migrate` job will not run until this is resolved: " +
        "trigger this workflow manually (workflow_dispatch) with `resolve_migration` set to the " +
        "exact name above. See this workflow file's \"Recovering a FAILED migration\" section.",
    ];
    writeSummary(lines.join("\n"));
    console.error(output);
    console.error(lines.join("\n"));
    writeGithubOutput("has_pending", "false");
    writeGithubOutput("has_destructive", "false");
    process.exit(1);
  }

  const pendingNames = parsePendingMigrationNames(output);
  if (pendingNames.length === 0) {
    console.error(output);
    console.error(
      "prisma migrate status exited 1 (pending) but no migration names could be parsed from " +
        "its output — the expected output format may have changed. Refusing to proceed blind.",
    );
    process.exit(1);
  }

  const scans = pendingNames.map(scanMigrationForDestructiveOps);
  const anyDestructive = scans.some((s) => s.findings.length > 0);
  const anyReadError = scans.some((s) => s.readError);

  const lines = ["## Production DB migration check", "", "### Pending migrations", ""];
  for (const scan of scans) {
    if (scan.readError) {
      lines.push(`- \`${scan.migrationName}\` — **could not read migration.sql** (see logs)`);
      continue;
    }
    if (scan.findings.length > 0) {
      lines.push(
        `- \`${scan.migrationName}\` — ⚠️ **DESTRUCTIVE**: ${scan.findings.join(", ")}`,
      );
    } else {
      lines.push(`- \`${scan.migrationName}\` — no destructive operations detected`);
    }
  }
  if (anyDestructive) {
    lines.push(
      "",
      "**⚠️ One or more pending migrations contain destructive operations (DROP/TRUNCATE/" +
        "DELETE). Review the migration SQL carefully before approving.**",
    );
  }
  writeSummary(lines.join("\n"));
  console.log(lines.join("\n"));

  writeGithubOutput("has_pending", "true");
  writeGithubOutput("has_destructive", String(anyDestructive));

  if (anyReadError) {
    console.error("Refusing to proceed: could not read one or more pending migration files.");
    process.exit(1);
  }
}

main();
