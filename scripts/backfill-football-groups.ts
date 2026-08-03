/**
 * Backfill FootballGroup Data
 *
 * Creates default FootballGroup per organisation, assigns teams,
 * mirrors TeamAccess to GroupAccess, and creates primary
 * FootballGroupPlayer memberships for active players.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   npx tsx scripts/backfill-football-groups.ts
 *
 * Required environment variables:
 *   DATABASE_URL — database connection
 */

import { db } from "../src/lib/db";
import { backfillAllOrganisations } from "../src/lib/groups/group-backfill";

async function main() {
  console.log("Starting FootballGroup backfill...\n");

  const result = await backfillAllOrganisations();

  console.log("--- Backfill Summary ---");
  console.log(`Groups created: ${result.groupsCreated}`);
  console.log(`Teams assigned to groups: ${result.teamsAssigned}`);
  console.log(`GroupAccess rows created: ${result.groupAccessCreated}`);
  console.log(`FootballGroupPlayer memberships created: ${result.groupPlayersCreated}`);
  console.log("\nBackfill complete.");

  await db.$disconnect();
}

main();