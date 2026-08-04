/**
 * Verify FootballGroup Backfill
 *
 * Verifies that all organisations have default groups,
 * all teams are assigned to groups, all active players
 * have group memberships, and TeamAccess rows are mirrored.
 *
 * Usage:
 *   npx tsx scripts/verify-football-group-backfill.ts
 *
 * Required environment variables:
 *   DATABASE_URL — database connection
 */

import { db } from "../src/lib/db";
import { verifyBackfill } from "../src/lib/groups/group-verify";

async function main() {
  console.log("Verifying FootballGroup backfill...\n");

  const result = await verifyBackfill();

  for (const check of result.checks) {
    const icon = check.passed ? "✓" : "✗";
    console.log(`${icon} ${check.name}: ${check.count}/${check.expected}`);
    if (check.details) {
      console.log(`  ${check.details}`);
    }
  }

  console.log(`\n${result.summary}`);

  await db.$disconnect();

  if (!result.passed) {
    process.exit(1);
  }
}

main();