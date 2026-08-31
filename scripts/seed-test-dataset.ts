/**
 * Canonical Test Dataset Seed (v1)
 *
 * Creates the Phase 3 persistent synthetic test dataset:
 *   Organisation A (Matchboard Test Club) with Group A1 and Group A2
 *   Organisation B (Other Test Club) with Group B1
 *   Test personas: owner-a, admin-a, coach-all-a, coach-a1, coach-a2, viewer-a, owner-b, coach-b1
 *   ~58 players with realistic positions, attributes, and game scenarios
 *
 * Usage:
 *   MATCHBOARD_ENV=test npx tsx scripts/seed-test-dataset.ts
 *
 * This script:
 *   1. Verifies MATCHBOARD_ENV=test (refuses to run in production)
 *   2. Cleans all existing data (the test database is disposable)
 *   3. Seeds fresh canonical data
 *
 * NEVER run against a production database. The script verifies MATCHBOARD_ENV=test
 * and TEST_DATABASE_URL.
 */

import "dotenv/config";

const TEST_DATASET_VERSION = 1;

// ADR-0109: `isMatchRoundPlanningEditable()`/`isMatchPlanningEditable()` now check each match's
// real `startsAt` against real wall-clock "now" (previously only `MatchRound.status` mattered,
// so a hardcoded past calendar date on a "DRAFT" fixture round was invisible to the app). A
// hardcoded calendar date here inevitably drifts into the past as real time advances past it,
// which then makes these "still open for planning" fixture rounds incorrectly appear
// boundary-closed. Compute them relative to script-run time instead so they stay valid
// regardless of when this script is next run.
function daysFromNow(days: number, hour = 10): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function createAdapter(url: string) {
  // max: 1 — a pool capped at exactly one connection. `new Pool()` with its default size
  // manages multiple concurrent connections — sequential awaited db.X.create() calls could
  // land on different underlying sessions, and a just-created row is not guaranteed visible to
  // a different session's very next foreign-key check (verified: identical statements succeed
  // every time when run by hand in one psql session, but intermittently fail with
  // ForeignKeyConstraintViolation (P2003) through Prisma against the deployed Neon Test branch,
  // referencing rows created many statements — and seconds — earlier). Capping the pool at one
  // connection guarantees every statement in this script shares one session, while keeping the
  // Pool interface @prisma/adapter-pg is built around (a bare pg.Client broke the protocol
  // handshake with PrismaPg).
  const { PrismaPg } = require("@prisma/adapter-pg");
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url, max: 1 });
  return new PrismaPg(pool);
}

async function main() {
  const env = process.env.MATCHBOARD_ENV;
  if (env !== "test") {
    console.error(`Refusing to seed: MATCHBOARD_ENV is "${env}", not "test". This script must only run against a test database.`);
    process.exit(1);
  }

  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("TEST_DATABASE_URL (or DATABASE_URL) must be set for seeding.");
    process.exit(1);
  }

  console.log(`Seeding canonical test dataset v${TEST_DATASET_VERSION}...`);

  const adapter = createAdapter(connectionString);
  const { PrismaClient } = require("../src/generated/prisma/client");
  const rawDb = new PrismaClient({ adapter, log: ["warn", "error"] });

  // Neon's serverless driver does not guarantee that a just-created row is visible to the very
  // next statement's foreign-key check — a plain sequence of awaited db.X.create() calls
  // intermittently threw spurious ForeignKeyConstraintViolation (P2003) errors against the
  // deployed Test branch. Wrapping the whole seed in a single Prisma $transaction() was tried
  // and made things worse: per ADR-0057, this codebase's Neon adapter does not reliably preserve
  // session/write state across model queries inside $transaction() (writes silently failed to
  // persist despite the script reporting success). A retry-on-P2003 extension avoids both
  // problems — no transaction, no session-state dependency, just short backoff until the
  // referenced row becomes visible.
  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = 6;
    const baseDelayMs = 300;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        const isForeignKeyRace = err?.code === "P2003";
        if (!isForeignKeyRace || attempt === maxAttempts) throw err;
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
      }
    }
    throw new Error("unreachable");
  }

  const db = rawDb.$extends({
    query: {
      $allModels: {
        create({ args, query }: any) {
          return withRetry(() => query(args));
        },
        createMany({ args, query }: any) {
          return withRetry(() => query(args));
        },
      },
    },
  }) as typeof rawDb;

  try {
    // Clean all data (test database is disposable)
    console.log("Cleaning existing data...");
    await cleanAllData(rawDb);

    // ============ Organisation A: Matchboard Test Club ============
    const orgA = await db.organisation.create({
      data: { name: "Matchboard Test Club", slug: "test-club-a" },
    });
    console.log(`Created Organisation A: ${orgA.name} (${orgA.id})`);

    // Users for Org A
    const ownerA = await db.user.create({ data: { email: "owner-a@test-agent.matchboard.football", name: "Owner A" } });
    const adminA = await db.user.create({ data: { email: "admin-a@test-agent.matchboard.football", name: "Admin A" } });
    const coachAllA = await db.user.create({ data: { email: "coach-all-a@test-agent.matchboard.football", name: "Coach All A" } });
    const coachA1 = await db.user.create({ data: { email: "coach-a1@test-agent.matchboard.football", name: "Coach A1" } });
    const coachA2 = await db.user.create({ data: { email: "coach-a2@test-agent.matchboard.football", name: "Coach A2" } });
    const viewerA = await db.user.create({ data: { email: "viewer-a@test-agent.matchboard.football", name: "Viewer A" } });

    // Auth.js accounts
    for (const u of [ownerA, adminA, coachAllA, coachA1, coachA2, viewerA]) {
      await db.account.create({
        data: { userId: u.id, type: "oauth", provider: "google", providerAccountId: `synthetic-${u.id}` },
      });
    }

    // Memberships for Org A
    const memOwnerA = await db.organisationMembership.create({ data: { userId: ownerA.id, organisationId: orgA.id, role: "OWNER" } });
    const memAdminA = await db.organisationMembership.create({ data: { userId: adminA.id, organisationId: orgA.id, role: "ADMIN" } });
    const memCoachAllA = await db.organisationMembership.create({ data: { userId: coachAllA.id, organisationId: orgA.id, role: "COACH" } });
    const memCoachA1 = await db.organisationMembership.create({ data: { userId: coachA1.id, organisationId: orgA.id, role: "COACH" } });
    const memCoachA2 = await db.organisationMembership.create({ data: { userId: coachA2.id, organisationId: orgA.id, role: "COACH" } });
    const memViewerA = await db.organisationMembership.create({ data: { userId: viewerA.id, organisationId: orgA.id, role: "VIEWER" } });

    // Group A1 — ~28 players, 3 teams, completed and upcoming rounds
    const groupA1 = await db.footballGroup.create({
      data: { name: "Test Group A1", slug: "test-group-a1", type: "AGE_GROUP", organisationId: orgA.id },
    });

    // Group A2 — ~22 players, 2 teams, different season state
    const groupA2 = await db.footballGroup.create({
      data: { name: "Test Group A2", slug: "test-group-a2", type: "AGE_GROUP", organisationId: orgA.id },
    });

    // Group access (authorization matrix)
    await db.groupAccess.createMany({
      data: [
        { membershipId: memCoachAllA.id, footballGroupId: groupA1.id, role: "GROUP_COACH", organisationId: orgA.id },
        { membershipId: memCoachAllA.id, footballGroupId: groupA2.id, role: "GROUP_COACH", organisationId: orgA.id },
        { membershipId: memCoachA1.id, footballGroupId: groupA1.id, role: "GROUP_COACH", organisationId: orgA.id },
        { membershipId: memCoachA2.id, footballGroupId: groupA2.id, role: "GROUP_COACH", organisationId: orgA.id },
      ],
    });

    // Teams for Group A1
    const teamA1Blues = await db.team.create({
      data: { name: "A1 Blues", targetSquadSize: 11, minAcceptedSquadSize: 9, maxSquadSize: 14, supportPriority: 1, organisationId: orgA.id, footballGroupId: groupA1.id },
    });
    const teamA1Whites = await db.team.create({
      data: { name: "A1 Whites", targetSquadSize: 11, minAcceptedSquadSize: 9, maxSquadSize: 14, supportPriority: 2, organisationId: orgA.id, footballGroupId: groupA1.id },
    });
    const teamA1Reds = await db.team.create({
      data: { name: "A1 Reds", targetSquadSize: 11, minAcceptedSquadSize: 9, maxSquadSize: 14, supportPriority: 3, organisationId: orgA.id, footballGroupId: groupA1.id },
    });

    // Teams for Group A2
    const teamA2Eagles = await db.team.create({
      data: { name: "A2 Eagles", targetSquadSize: 9, minAcceptedSquadSize: 7, maxSquadSize: 12, supportPriority: 1, organisationId: orgA.id, footballGroupId: groupA2.id },
    });
    const teamA2Hawks = await db.team.create({
      data: { name: "A2 Hawks", targetSquadSize: 9, minAcceptedSquadSize: 7, maxSquadSize: 12, supportPriority: 2, organisationId: orgA.id, footballGroupId: groupA2.id },
    });

    // Season and league seasons for Group A1
    const seasonA1 = await db.season.create({ data: { name: "Test Season A 2026", year: 2026, organisationId: orgA.id } });
    const leagueA1Spring = await db.leagueSeason.create({
      data: { name: "Test A1 Spring 2026", part: "SPRING", seasonId: seasonA1.id, organisationId: orgA.id, footballGroupId: groupA1.id, startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30") },
    });

    // Completed round (W10)
    const roundA1W10 = await db.matchRound.create({ data: { name: "W10", leagueSeasonId: leagueA1Spring.id, organisationId: orgA.id, status: "FINALIZED" } });
    // Draft round (W11)
    const roundA1W11 = await db.matchRound.create({ data: { name: "W11", leagueSeasonId: leagueA1Spring.id, organisationId: orgA.id, status: "DRAFT" } });

    // Season and league season for Group A2
    const seasonA2 = await db.season.create({ data: { name: "Test Season A2 2026", year: 2026, organisationId: orgA.id } });
    const leagueA2Spring = await db.leagueSeason.create({
      data: { name: "Test A2 Spring 2026", part: "SPRING", seasonId: seasonA2.id, organisationId: orgA.id, footballGroupId: groupA2.id, startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30") },
    });
    const roundA2W10 = await db.matchRound.create({ data: { name: "W10", leagueSeasonId: leagueA2Spring.id, organisationId: orgA.id, status: "DRAFT" } });

    // Opponent teams for Org A
    const opponentsAData = [
      { displayName: "Riverside Juniors", normalizedName: "riverside juniors" },
      { displayName: "Lakeside Athletic", normalizedName: "lakeside athletic" },
      { displayName: "Hilltop United", normalizedName: "hilltop united" },
      { displayName: "Valley FC", normalizedName: "valley fc" },
      { displayName: "Metro Stars", normalizedName: "metro stars" },
    ];
    const opponentTeamIdsA: Record<string, string> = {};
    for (const opp of opponentsAData) {
      const created = await db.opponentTeam.create({ data: { displayName: opp.displayName, normalizedName: opp.normalizedName, organisationId: orgA.id } });
      opponentTeamIdsA[opp.normalizedName] = created.id;
    }

    // Matches for A1 W10 (finalized)
    await db.match.create({ data: { matchRoundId: roundA1W10.id, teamId: teamA1Blues.id, opponent: "Riverside Juniors", opponentTeamId: opponentTeamIdsA["riverside juniors"], startsAt: new Date("2026-05-25T10:00:00Z"), homeAway: "HOME", matchType: "LEAGUE", gameFormat: "ELEVEN_A_SIDE", squadSize: 11, organisationId: orgA.id } });
    await db.match.create({ data: { matchRoundId: roundA1W10.id, teamId: teamA1Whites.id, opponent: "Lakeside Athletic", opponentTeamId: opponentTeamIdsA["lakeside athletic"], startsAt: new Date("2026-05-25T12:00:00Z"), homeAway: "AWAY", matchType: "LEAGUE", gameFormat: "ELEVEN_A_SIDE", squadSize: 11, organisationId: orgA.id } });
    await db.match.create({ data: { matchRoundId: roundA1W10.id, teamId: teamA1Reds.id, opponent: "Hilltop United", opponentTeamId: opponentTeamIdsA["hilltop united"], startsAt: new Date("2026-05-25T14:00:00Z"), homeAway: "HOME", matchType: "LEAGUE", gameFormat: "ELEVEN_A_SIDE", squadSize: 11, organisationId: orgA.id } });

    // Matches for A1 W11 (draft, planning still open -- kept relative to "now", see daysFromNow)
    await db.match.create({ data: { matchRoundId: roundA1W11.id, teamId: teamA1Blues.id, opponent: "Valley FC", opponentTeamId: opponentTeamIdsA["valley fc"], startsAt: daysFromNow(14, 10), homeAway: "AWAY", matchType: "LEAGUE", gameFormat: "ELEVEN_A_SIDE", squadSize: 11, organisationId: orgA.id } });
    await db.match.create({ data: { matchRoundId: roundA1W11.id, teamId: teamA1Whites.id, opponent: "Metro Stars", opponentTeamId: opponentTeamIdsA["metro stars"], startsAt: daysFromNow(14, 12), homeAway: "HOME", matchType: "LEAGUE", gameFormat: "ELEVEN_A_SIDE", squadSize: 11, organisationId: orgA.id } });

    // Rotation paths for Group A1
    await db.rotationPath.createMany({
      data: [
        { fromTeamId: teamA1Blues.id, toTeamId: teamA1Whites.id, role: "SUPPORT", purpose: "leadership support", active: true, organisationId: orgA.id },
        { fromTeamId: teamA1Blues.id, toTeamId: teamA1Reds.id, role: "SUPPORT", purpose: "leadership support", active: true, organisationId: orgA.id },
        { fromTeamId: teamA1Whites.id, toTeamId: teamA1Reds.id, role: "SUPPORT", purpose: "experience support", active: true, organisationId: orgA.id },
        { fromTeamId: teamA1Reds.id, toTeamId: teamA1Blues.id, role: "DEVELOPMENT", purpose: "development challenge", active: true, organisationId: orgA.id },
        { fromTeamId: teamA1Reds.id, toTeamId: teamA1Whites.id, role: "DEVELOPMENT", purpose: "development challenge", active: true, organisationId: orgA.id },
        { fromTeamId: teamA1Whites.id, toTeamId: teamA1Blues.id, role: "BACKFILL", purpose: "squad repair", active: true, organisationId: orgA.id },
        { fromTeamId: teamA1Blues.id, toTeamId: teamA1Reds.id, role: "CONFIDENCE_REBUILD", purpose: "confidence rebuild", active: true, organisationId: orgA.id },
      ],
    });

    // Rotation paths for Group A2
    await db.rotationPath.createMany({
      data: [
        { fromTeamId: teamA2Eagles.id, toTeamId: teamA2Hawks.id, role: "SUPPORT", purpose: "leadership support", active: true, organisationId: orgA.id },
        { fromTeamId: teamA2Hawks.id, toTeamId: teamA2Eagles.id, role: "DEVELOPMENT", purpose: "development challenge", active: true, organisationId: orgA.id },
      ],
    });

    // Rule configs
    await db.ruleConfig.create({ data: { organisationId: orgA.id, footballGroupId: groupA1.id, name: "Test A1 Rules" } });
    await db.ruleConfig.create({ data: { organisationId: orgA.id, footballGroupId: groupA2.id, name: "Test A2 Rules" } });

    // Players for Group A1 (3 teams, ~30 players)
    const positions = ["GK", "CB", "CM", "W", "ST"] as const;
    const footPreferences = ["RIGHT", "LEFT"] as const;
    let playerCode = 2000;
    const a1TeamConfigs = [
      { team: teamA1Blues, count: 11 },
      { team: teamA1Whites, count: 10 },
      { team: teamA1Reds, count: 9 },
    ];

    const a1PlayerIds: string[] = [];
    for (const { team, count } of a1TeamConfigs) {
      for (let i = 0; i < count; i++) {
        const pos = positions[i % positions.length];
        const foot = footPreferences[i % footPreferences.length];
        const player = await db.player.create({
          data: {
            playerCode: playerCode++,
            firstName: `${team.name.replace("A1 ", "")}`,
            lastName: `Player${i + 1}`,
            coreTeamId: team.id,
            primaryPosition: pos,
            secondaryPosition: i % 3 === 0 ? "CB" : null,
            preferredFoot: foot,
            secondaryFoot: i % 4 === 0 ? "LEFT" : "WEAK",
            bestSide: i % 3 === 0 ? "LEFT" : i % 3 === 1 ? "RIGHT" : "CENTER",
            currentAvailability: i % 12 === 0 ? "UNAVAILABLE" : "AVAILABLE",
            organisationId: orgA.id,
            ...(i % 5 === 0 ? { goalkeeperAbility: pos === "GK" ? "YES" as const : "EMERGENCY" as const } : {}),
          },
        });
        a1PlayerIds.push(player.id);
        await db.footballGroupPlayer.create({ data: { playerId: player.id, footballGroupId: groupA1.id, organisationId: orgA.id } });
      }
    }

    // Players for Group A2 (2 teams, ~22 players)
    const a2PlayerIds: string[] = [];
    const a2TeamConfigs = [
      { team: teamA2Eagles, count: 11 },
      { team: teamA2Hawks, count: 11 },
    ];

    for (const { team, count } of a2TeamConfigs) {
      for (let i = 0; i < count; i++) {
        const pos = positions[i % positions.length];
        const foot = footPreferences[i % footPreferences.length];
        const player = await db.player.create({
          data: {
            playerCode: playerCode++,
            firstName: `${team.name.replace("A2 ", "")}`,
            lastName: `Player${i + 1}`,
            coreTeamId: team.id,
            primaryPosition: pos,
            secondaryPosition: i % 4 === 0 ? "CM" : null,
            preferredFoot: foot,
            secondaryFoot: i % 4 === 0 ? "LEFT" : "WEAK",
            bestSide: i % 3 === 0 ? "CENTER" : "RIGHT",
            currentAvailability: i % 10 === 0 ? "UNAVAILABLE" : "AVAILABLE",
            organisationId: orgA.id,
            ...(i % 4 === 0 ? { goalkeeperAbility: pos === "GK" ? "YES" as const : "EMERGENCY" as const } : {}),
          },
        });
        a2PlayerIds.push(player.id);
        await db.footballGroupPlayer.create({ data: { playerId: player.id, footballGroupId: groupA2.id, organisationId: orgA.id } });
      }
    }

    // ============ Organisation B: Other Test Club ============
    const orgB = await db.organisation.create({ data: { name: "Other Test Club", slug: "test-club-b" } });
    console.log(`Created Organisation B: ${orgB.name} (${orgB.id})`);

    const coachB1 = await db.user.create({ data: { email: "coach-b1@test-agent.matchboard.football", name: "Coach B1" } });
    const ownerB = await db.user.create({ data: { email: "owner-b@test-agent.matchboard.football", name: "Owner B" } });

    await db.account.create({ data: { userId: coachB1.id, type: "oauth", provider: "google", providerAccountId: `synthetic-${coachB1.id}` } });
    await db.account.create({ data: { userId: ownerB.id, type: "oauth", provider: "google", providerAccountId: `synthetic-${ownerB.id}` } });

    const memOwnerB = await db.organisationMembership.create({ data: { userId: ownerB.id, organisationId: orgB.id, role: "OWNER" } });
    const memCoachB1 = await db.organisationMembership.create({ data: { userId: coachB1.id, organisationId: orgB.id, role: "COACH" } });

    // Group B1
    const groupB1 = await db.footballGroup.create({
      data: { name: "Test Group B1", slug: "test-group-b1", type: "AGE_GROUP", organisationId: orgB.id },
    });

    await db.groupAccess.create({ data: { membershipId: memCoachB1.id, footballGroupId: groupB1.id, role: "GROUP_COACH", organisationId: orgB.id } });

    // Teams for Group B1
    const teamB1Lions = await db.team.create({
      data: { name: "B1 Lions", targetSquadSize: 11, minAcceptedSquadSize: 9, maxSquadSize: 14, supportPriority: 1, organisationId: orgB.id, footballGroupId: groupB1.id },
    });
    const teamB1Wolves = await db.team.create({
      data: { name: "B1 Wolves", targetSquadSize: 11, minAcceptedSquadSize: 9, maxSquadSize: 14, supportPriority: 2, organisationId: orgB.id, footballGroupId: groupB1.id },
    });

    // Season for Org B
    const seasonB1 = await db.season.create({ data: { name: "Test Season B 2026", year: 2026, organisationId: orgB.id } });
    const leagueB1Spring = await db.leagueSeason.create({
      data: { name: "Test B1 Spring 2026", part: "SPRING", seasonId: seasonB1.id, organisationId: orgB.id, footballGroupId: groupB1.id, startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30") },
    });

    const roundB1W10 = await db.matchRound.create({ data: { name: "W10", leagueSeasonId: leagueB1Spring.id, organisationId: orgB.id, status: "DRAFT" } });

    // Opponents for Org B
    const oppB1 = await db.opponentTeam.create({ data: { displayName: "Cross Town Rivals", normalizedName: "cross town rivals", organisationId: orgB.id } });
    const oppB2 = await db.opponentTeam.create({ data: { displayName: "Suburban FC", normalizedName: "suburban fc", organisationId: orgB.id } });

    await db.match.create({ data: { matchRoundId: roundB1W10.id, teamId: teamB1Lions.id, opponent: "Cross Town Rivals", opponentTeamId: oppB1.id, startsAt: daysFromNow(14, 10), homeAway: "HOME", matchType: "LEAGUE", gameFormat: "ELEVEN_A_SIDE", squadSize: 11, organisationId: orgB.id } });
    await db.match.create({ data: { matchRoundId: roundB1W10.id, teamId: teamB1Wolves.id, opponent: "Suburban FC", opponentTeamId: oppB2.id, startsAt: daysFromNow(14, 12), homeAway: "AWAY", matchType: "LEAGUE", gameFormat: "ELEVEN_A_SIDE", squadSize: 11, organisationId: orgB.id } });

    // Rotation paths for Group B1
    await db.rotationPath.createMany({
      data: [
        { fromTeamId: teamB1Lions.id, toTeamId: teamB1Wolves.id, role: "SUPPORT", purpose: "leadership support", active: true, organisationId: orgB.id },
        { fromTeamId: teamB1Wolves.id, toTeamId: teamB1Lions.id, role: "DEVELOPMENT", purpose: "development challenge", active: true, organisationId: orgB.id },
      ],
    });

    await db.ruleConfig.create({ data: { organisationId: orgB.id, footballGroupId: groupB1.id, name: "Test B1 Rules" } });

    // Players for Group B1 (2 teams, ~18 players)
    let b1PlayerCode = 3000;
    const b1TeamConfigs = [
      { team: teamB1Lions, count: 10 },
      { team: teamB1Wolves, count: 8 },
    ];

    const b1PlayerIds: string[] = [];
    for (const { team, count } of b1TeamConfigs) {
      for (let i = 0; i < count; i++) {
        const pos = positions[i % positions.length];
        const foot = footPreferences[i % footPreferences.length];
        const player = await db.player.create({
          data: {
            playerCode: b1PlayerCode++,
            firstName: `${team.name.replace("B1 ", "")}`,
            lastName: `Player${i + 1}`,
            coreTeamId: team.id,
            primaryPosition: pos,
            preferredFoot: foot,
            secondaryFoot: i % 3 === 0 ? "LEFT" : "WEAK",
            bestSide: "CENTER",
            currentAvailability: "AVAILABLE",
            organisationId: orgB.id,
            ...(pos === "GK" ? { goalkeeperAbility: "YES" as const } : {}),
          },
        });
        b1PlayerIds.push(player.id);
        await db.footballGroupPlayer.create({ data: { playerId: player.id, footballGroupId: groupB1.id, organisationId: orgB.id } });
      }
    }

    // Summary
    const totalPlayers = a1PlayerIds.length + a2PlayerIds.length + b1PlayerIds.length;
    console.log("");
    console.log("=== Canonical Test Dataset Seeded ===");
    console.log(`Version: ${TEST_DATASET_VERSION}`);
    console.log(`Organisation A: ${orgA.name} (${orgA.id})`);
    console.log(`  Group A1: ${groupA1.name} (${groupA1.id}) — ${a1PlayerIds.length} players, 3 teams`);
    console.log(`  Group A2: ${groupA2.name} (${groupA2.id}) — ${a2PlayerIds.length} players, 2 teams`);
    console.log(`Organisation B: ${orgB.name} (${orgB.id})`);
    console.log(`  Group B1: ${groupB1.name} (${groupB1.id}) — ${b1PlayerIds.length} players, 2 teams`);
    console.log(`Total players: ${totalPlayers}`);
    console.log(`Total personas: 8`);
    console.log("");
    console.log("Personas (test agent auth emails):");
    console.log(`  owner-a:       ${ownerA.email}`);
    console.log(`  admin-a:       ${adminA.email}`);
    console.log(`  coach-all-a:   ${coachAllA.email}`);
    console.log(`  coach-a1:      ${coachA1.email}`);
    console.log(`  coach-a2:      ${coachA2.email}`);
    console.log(`  viewer-a:      ${viewerA.email}`);
    console.log(`  owner-b:       ${ownerB.email}`);
    console.log(`  coach-b1:      ${coachB1.email}`);
    console.log("");
    console.log("Authorization matrix:");
    console.log("  coach-all-a → A1 ✓, A2 ✓, B1 ✗");
    console.log("  coach-a1    → A1 ✓, A2 ✗, B1 ✗");
    console.log("  coach-a2    → A1 ✗, A2 ✓, B1 ✗");
    console.log("  coach-b1    → A1 ✗, A2 ✗, B1 ✓");
    console.log(`TEST_DATASET_VERSION=${TEST_DATASET_VERSION}`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await rawDb.$disconnect();
  }
}

async function cleanAllData(db: any) {
  // Delete in dependency order
  const tables = [
    "teamBestLineupAssignment", "teamBestLineup",
    "selectionExplanation", "movementCandidate", "coachingIntent", "playerReadinessSignal",
    "playerDevelopmentObservation", "matchExecutionFeedback", "teamReflection",
    "decisionRecord", "teamSeasonSnapshotPlayer", "teamSeasonSnapshot", "seasonPeriodSnapshot", "policyDecisionLog",
    "matchReportPlayerStat", "matchReportAbsence", "assist", "goal", "postMatchPlayerActual", "postMatchReport",
    "matchLineupAssignment", "matchLineup", "matchRotation", "selectionAudit",
    "warning", "movementLedger", "selection", "availability", "playerLock",
    "playerProfileSuggestionEvidence", "playerProfileSuggestion",
    "match", "matchRound", "leagueSeason", "season",
    "eventMatchLineupAssignment", "eventMatchLineup", "eventMatchSupportAssignment",
    "eventSquadPlayer", "eventSquad", "eventPlayerAvailability",
    "eventGoalEvent", "eventAssistEvent", "eventPostMatchPlayer", "eventPostMatchReport",
    "eventMatch", "event",
    "liveMatchEvent", "liveMatchSession", "eventLiveMatchEvent", "eventLiveMatchSession",
    "fairPlayObservation",
    "formationSlot", "formation",
    "rotationPath", "groupMovementPath",
    "opponentSportingEvidence", "opponentEncounterObservation", "opponentTeam",
    "ruleConfig",
    "footballGroupPlayer", "player",
    "team", "footballGroup",
    "groupAccess", "organisationMembership", "organisationInvitation",
    "notificationDelivery", "notificationOutbox", "reviewRequest", "workOwnership",
    "machinePrincipal", "providerWebhookEvent",
    "account", "session", "verificationToken", "user",
    "organisation",
  ];

  for (const table of tables) {
    try {
      await db[table].deleteMany();
    } catch {
      // Some tables may not exist in this schema version
    }
  }
  console.log("  Data cleaned.");
}

main();