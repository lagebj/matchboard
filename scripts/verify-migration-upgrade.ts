/**
 * Migration upgrade-path verification (ARR-0026, AIP-5).
 *
 * verify-migration-from-zero.sh only proves the migration chain is internally consistent
 * against an EMPTY database — it says nothing about whether a migration is safe against a table
 * that already has rows, which is exactly the situation production-db-migrate.yml applies it to.
 * This script is invoked by scripts/verify-migration-upgrade.sh against an ephemeral Neon branch
 * forked from the persistent "test" branch (already populated with real, ongoing test/CI data at
 * its current migration state) — the same populated-copy-branch pattern
 * scripts/test-acceptance/deploy.sh already uses for per-PR isolation. No production data is
 * ever touched or copied into the repository.
 *
 * Usage: DIRECT_URL=<neon-admin-connection-string> npx tsx scripts/verify-migration-upgrade.ts
 */

import "dotenv/config";
import { execSync } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma/client";

function createAdapter(url: string) {
  if (url.includes(".neon.tech")) {
    const { PrismaNeon } = require("@prisma/adapter-neon") as typeof import("@prisma/adapter-neon");
    return new PrismaNeon({ connectionString: url });
  }
  const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
  const { Pool } = require("pg") as typeof import("pg");
  const pool = new Pool({ connectionString: url });
  return new PrismaPg(pool);
}

// A representative cross-section, not every table: tenant root (Organisation), core setup
// (Team, Player), planning (Match, MatchRound, Selection), and Learn-phase output
// (PostMatchReport, Goal) — enough to catch a migration that silently drops or orphans rows in
// any of the schema's major areas, without the maintenance cost of enumerating all ~70 models.
const REPRESENTATIVE_TABLES = [
  "organisation",
  "team",
  "player",
  "match",
  "matchRound",
  "selection",
  "postMatchReport",
  "goal",
] as const;

type Counts = Record<(typeof REPRESENTATIVE_TABLES)[number], number>;

async function countRows(client: PrismaClient): Promise<Counts> {
  const counts = {} as Counts;
  for (const table of REPRESENTATIVE_TABLES) {
    counts[table] = await (client as unknown as Record<string, { count: () => Promise<number> }>)[table]!.count();
  }
  return counts;
}

async function main() {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    console.error("DIRECT_URL environment variable is required.");
    process.exit(1);
  }

  const adapter = createAdapter(directUrl);
  const client = new PrismaClient({ adapter });

  try {
    console.log("== Checking migration status against the populated branch ==");
    let status: string;
    try {
      status = execSync("npx prisma migrate status", {
        env: { ...process.env, DIRECT_URL: directUrl },
        encoding: "utf-8",
      });
    } catch (error) {
      // `prisma migrate status` exits non-zero when migrations are pending — that is the
      // expected, common case here (this branch is forked from "test", which is only as
      // up-to-date as the last post-merge test-db-migrate.yml run; a PR introducing a new
      // migration is expected to be "pending" relative to it). Capture stdout either way.
      status = (error as { stdout?: string }).stdout ?? "";
    }
    console.log(status);

    if (status.includes("Database schema is up to date")) {
      console.log(
        "No pending migrations relative to the parent branch — nothing new to verify against populated data.",
      );
      return;
    }

    console.log("== Row counts before migration (representative tables) ==");
    const before = await countRows(client);
    console.log(before);

    console.log("== Applying pending migrations to the populated branch ==");
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DIRECT_URL: directUrl },
      stdio: "inherit",
    });

    console.log("== Row counts after migration (must not decrease) ==");
    const after = await countRows(client);
    console.log(after);

    const regressions = REPRESENTATIVE_TABLES.filter((t) => after[t] < before[t]);
    if (regressions.length > 0) {
      console.error(
        `Row count decreased after migration for: ${regressions.join(", ")} — possible data loss. Before: ${JSON.stringify(before)}, After: ${JSON.stringify(after)}`,
      );
      process.exit(1);
    }

    console.log("== Verifying the application can read expected records after migration ==");
    const orgCount = await client.organisation.count();
    if (orgCount === 0) {
      console.error("No organisations readable after migration — application would fail to start meaningfully.");
      process.exit(1);
    }
    const sampleOrg = await client.organisation.findFirst({ select: { id: true, name: true, slug: true } });
    console.log(`Sample read after migration: organisation "${sampleOrg?.name}" (slug: ${sampleOrg?.slug})`);

    console.log("");
    console.log("Migration upgrade-path verification PASSED");
    console.log("Pending migrations applied successfully to a populated previous-state database.");
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
