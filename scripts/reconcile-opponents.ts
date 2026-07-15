/**
 * Reconciliation script: Backfill opponentTeamId for completed matches and event matches.
 *
 * Under the new opponent lifecycle (ADR 0027), canonical OpponentTeam entities are
 * created on report completion, not on fixture creation. This script reconciles
 * existing data by:
 *
 * 1. Finding matches with completed reports (REPORTED/LOCKED) that have no opponentTeamId
 * 2. Creating or reusing OpponentTeam entities based on the opponent name snapshot
 * 3. Linking the match to the canonical opponent
 * 4. Doing the same for event matches with completed reports
 * 5. Removing provisional opponent teams that have no completed encounters
 *
 * This script is idempotent. Run it with: npx tsx scripts/reconcile-opponents.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeOpponentName, cleanOpponentDisplayName } from "../src/lib/opponents/opponent-team";

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

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL must be set");
const adapter = createAdapter(connectionString);
const prisma = new PrismaClient({ adapter });

async function reconcileOpponents() {
  console.log("Starting opponent reconciliation...");

  // Step 1: Find league matches with completed reports and no opponentTeamId
  const completedMatchIds = await prisma.postMatchReport.findMany({
    where: { status: { in: ["REPORTED", "LOCKED"] } },
    select: { matchId: true },
  });
  const completedMatchIdSet = new Set(completedMatchIds.map((r) => r.matchId));

  const matchesWithoutOpponent = await prisma.match.findMany({
    where: {
      opponentTeamId: null,
      opponent: { not: "" },
    },
    select: {
      id: true,
      opponent: true,
    },
  });

  const matchesToReconcile = matchesWithoutOpponent.filter((m) =>
    completedMatchIdSet.has(m.id),
  );

  console.log(`Found ${matchesToReconcile.length} league matches with completed reports and no opponentTeamId`);

  let matchLinked = 0;
  let matchCreated = 0;

  for (const match of matchesToReconcile) {
    const normalizedName = normalizeOpponentName(match.opponent);
    const displayName = cleanOpponentDisplayName(match.opponent);

    const opponent = await prisma.opponentTeam.upsert({
      where: { normalizedName },
      create: { displayName, normalizedName },
      update: { displayName },
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { opponentTeamId: opponent.id },
    });

    if (opponent.createdAt > new Date(Date.now() - 1000)) {
      matchCreated++;
    } else {
      matchLinked++;
    }
  }

  console.log(`League matches: ${matchCreated} new opponents created, ${matchLinked} existing opponents linked`);

  // Step 2: Find event matches with completed reports and no opponentTeamId
  const completedEventMatchIds = await prisma.eventPostMatchReport.findMany({
    where: { status: "LOCKED" },
    select: { eventMatchId: true },
  });
  const completedEventMatchIdSet = new Set(completedEventMatchIds.map((r) => r.eventMatchId));

  const eventMatchesWithoutOpponent = await prisma.eventMatch.findMany({
    where: {
      opponentTeamId: null,
      opponentName: { not: "" },
    },
    select: {
      id: true,
      opponentName: true,
    },
  });

  const eventMatchesToReconcile = eventMatchesWithoutOpponent.filter((em) =>
    completedEventMatchIdSet.has(em.id),
  );

  console.log(`Found ${eventMatchesToReconcile.length} event matches with completed reports and no opponentTeamId`);

  let eventLinked = 0;
  let eventCreated = 0;

  for (const em of eventMatchesToReconcile) {
    const normalizedName = normalizeOpponentName(em.opponentName);
    const displayName = cleanOpponentDisplayName(em.opponentName);

    const opponent = await prisma.opponentTeam.upsert({
      where: { normalizedName },
      create: { displayName, normalizedName },
      update: { displayName },
    });

    await prisma.eventMatch.update({
      where: { id: em.id },
      data: { opponentTeamId: opponent.id },
    });

    if (opponent.createdAt > new Date(Date.now() - 1000)) {
      eventCreated++;
    } else {
      eventLinked++;
    }
  }

  console.log(`Event matches: ${eventCreated} new opponents created, ${eventLinked} existing opponents linked`);

  // Step 3: Find provisional opponent teams with no completed encounters
  const opponentTeams = await prisma.opponentTeam.findMany({
    select: {
      id: true,
      displayName: true,
      _count: {
        select: {
          matches: true,
          eventMatches: true,
        },
      },
    },
  });

  let provisionalCount = 0;
  const provisionalIds: string[] = [];

  for (const ot of opponentTeams) {
    const totalMatches = ot._count.matches + ot._count.eventMatches;
    if (totalMatches === 0) {
      provisionalIds.push(ot.id);
      provisionalCount++;
    }
  }

  if (provisionalCount > 0) {
    console.log(`Found ${provisionalCount} provisional opponent teams with no encounters.`);
    console.log("These were likely created during fixture creation and can be removed.");
    console.log("IDs:", provisionalIds.join(", "));
    console.log("Run with --clean to remove them.");
  } else {
    console.log("No provisional opponent teams found.");
  }

  // Step 4: If --clean flag, remove provisional opponents
  if (process.argv.includes("--clean") && provisionalIds.length > 0) {
    const deleted = await prisma.opponentTeam.deleteMany({
      where: { id: { in: provisionalIds } },
    });
    console.log(`Removed ${deleted.count} provisional opponent teams.`);
  }

  console.log("Opponent reconciliation complete.");
}

reconcileOpponents()
  .catch((error) => {
    console.error("Reconciliation failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });