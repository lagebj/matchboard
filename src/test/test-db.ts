import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

let testDb: PrismaClient | null = null;

export function getTestDb(): PrismaClient {
  if (!testDb) {
    throw new Error("Test database not initialized. Call setupTestDb() first.");
  }
  return testDb;
}

function createAdapter(url: string) {
  if (url.includes(".neon.tech")) {
    return new PrismaNeon({ connectionString: url });
  }
  const pool = new pg.Pool({ connectionString: url });
  return new PrismaPg(pool);
}

export async function setupTestDb(): Promise<PrismaClient> {
  if (testDb) {
    await cleanTestDb(testDb);
    return testDb;
  }

  const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set for tests.");
  }

  const adapter = createAdapter(connectionString);
  testDb = new PrismaClient({ adapter, log: [] });
  await cleanTestDb(testDb);

  return testDb;
}

export async function teardownTestDb(): Promise<void> {
  if (testDb) {
    await testDb.$disconnect();
    testDb = null;
  }
}

export async function cleanTestDb(db: PrismaClient): Promise<void> {
  await db.selectionExplanation.deleteMany();
  await db.coachingIntent.deleteMany();
  await db.playerReadinessSignal.deleteMany();
  await db.matchExecutionFeedback.deleteMany();
  await db.teamReflection.deleteMany();
  await db.decisionRecord.deleteMany();
  await db.assistantIssue.deleteMany();
  await db.matchReportPlayerStat.deleteMany();
  await db.matchReportAbsence.deleteMany();
  await db.goal.deleteMany();
  await db.postMatchPlayerActual.deleteMany();
  await db.postMatchReport.deleteMany();
  await db.selectionAudit.deleteMany();
  await db.warning.deleteMany();
  await db.movementLedger.deleteMany();
  await db.selection.deleteMany();
  await db.availability.deleteMany();
  await db.playerLock.deleteMany();
  await db.match.deleteMany();
  await db.matchRound.deleteMany();
  await db.planningPeriod.deleteMany();
  await db.season.deleteMany();
  await db.player.deleteMany();
  await db.rotationPath.deleteMany();
  await db.team.deleteMany();
  await db.ruleConfig.deleteMany();
}

export type TestFixtureIds = {
  seasonId: string;
  planningPeriodId: string;
  matchRoundId: string;
  teams: Record<string, string>;
  players: Array<{
    id: string;
    coreTeamId: string;
    coreTeamName: string;
    firstName: string;
    lastName: string;
    primaryPosition: string;
    playerCode: number;
  }>;
  matches: Record<string, string>;
  rotationPathIds: string[];
};

export async function seedTestFixture(
  db: PrismaClient,
  options?: {
    teams?: Array<{
      name: string;
      targetSquadSize?: number;
      minCorePlayers?: number;
      targetSupportCount?: number;
      maxSupportCount?: number;
      minSupportPlayers?: number;
      supportPriority?: number;
      developmentSlots?: number;
      minAcceptedSquadSize?: number;
      maxSquadSize?: number;
    }>;
    playersPerTeam?: number;
    matchDates?: Record<string, Date>;
    rotationPaths?: Array<{
      from: string;
      to: string;
      role: "SUPPORT" | "DEVELOPMENT" | "BACKFILL" | "CONFIDENCE_REBUILD";
      cooldownRounds?: number;
      allowDoubleLoad?: boolean;
      minRestSpacingHours?: number;
      maxDoubleLoadsPerPeriod?: number;
    }>;
  },
): Promise<TestFixtureIds> {
  const teams = options?.teams ?? [
    { name: "Bla", targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
    { name: "Hvit", targetSquadSize: 12, minCorePlayers: 7, targetSupportCount: 4, maxSupportCount: 5, minSupportPlayers: 4, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 10, maxSquadSize: 14 },
    { name: "Rod", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 2, maxSupportCount: 3, minSupportPlayers: 2, supportPriority: 2, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
  ];

  const playersPerTeam = options?.playersPerTeam ?? 12;

  await db.ruleConfig.create({
    data: { name: "Test rules", minDaysBetweenAnyMatches: 3, warningThreshold: 5 },
  });

  const season = await db.season.create({
    data: { name: "Test Season" },
  });

  const period = await db.planningPeriod.create({
    data: {
      name: "Test Period",
      seasonId: season.id,
      startDate: new Date("2025-01-06"),
      endDate: new Date("2025-06-30"),
    },
  });

  const round = await db.matchRound.create({
    data: {
      name: "W19 Test",
      planningPeriodId: period.id,
      status: "DRAFT",
    },
  });

  const teamIds: Record<string, string> = {};
  for (const team of teams) {
    const created = await db.team.create({
      data: {
        name: team.name,
        targetSquadSize: team.targetSquadSize ?? 11,
        minCorePlayers: team.minCorePlayers ?? 8,
        targetSupportCount: team.targetSupportCount ?? 0,
        maxSupportCount: team.maxSupportCount ?? 5,
        minSupportPlayers: team.minSupportPlayers ?? 0,
        supportPriority: team.supportPriority ?? 0,
        developmentSlots: team.developmentSlots ?? 0,
        minAcceptedSquadSize: team.minAcceptedSquadSize ?? 9,
        maxSquadSize: team.maxSquadSize ?? 14,
      },
    });
    teamIds[team.name] = created.id;
  }

  const matchIds: Record<string, string> = {};
  const baseDate = new Date("2025-04-28T10:00:00Z");
  const matchDates = options?.matchDates ?? {};
  for (const team of teams) {
    const matchDate = matchDates[team.name] ?? baseDate;
    const match = await db.match.create({
      data: {
        matchRoundId: round.id,
        teamId: teamIds[team.name]!,
        opponent: `Opponent ${team.name}`,
        startsAt: matchDate,
        homeAway: "HOME",
        squadSize: team.targetSquadSize ?? 11,
        matchType: "FRIENDLY",
        gameFormat: "ELEVEN_A_SIDE",
      },
    });
    matchIds[team.name] = match.id;
  }

  const rotationPaths = options?.rotationPaths ?? [
    { from: "Bla", to: "Hvit", role: "SUPPORT" as const },
    { from: "Bla", to: "Rod", role: "SUPPORT" as const },
    { from: "Rod", to: "Hvit", role: "SUPPORT" as const },
    { from: "Bla", to: "Hvit", role: "BACKFILL" as const },
    { from: "Hvit", to: "Bla", role: "BACKFILL" as const },
    { from: "Rod", to: "Bla", role: "BACKFILL" as const },
    { from: "Rod", to: "Bla", role: "DEVELOPMENT" as const },
    { from: "Hvit", to: "Rod", role: "DEVELOPMENT" as const },
    { from: "Bla", to: "Rod", role: "DEVELOPMENT" as const },
  ];

  const rotationPathIds: string[] = [];
  for (const rp of rotationPaths) {
    const created = await db.rotationPath.create({
      data: {
        fromTeamId: teamIds[rp.from]!,
        toTeamId: teamIds[rp.to]!,
        role: rp.role,
        purpose: `${rp.from} ${rp.role.toLowerCase()} to ${rp.to}`,
        active: true,
        cooldownRounds: rp.cooldownRounds ?? 0,
        allowDoubleLoad: rp.allowDoubleLoad ?? false,
        minRestSpacingHours: rp.minRestSpacingHours ?? null,
        maxDoubleLoadsPerPeriod: rp.maxDoubleLoadsPerPeriod ?? null,
      },
    });
    rotationPathIds.push(created.id);
  }

  const positions = ["GK", "CB", "CM", "W", "ST"];
  const players: TestFixtureIds["players"] = [];
  let playerCode = 1000;

  for (const team of teams) {
    for (let i = 0; i < playersPerTeam; i++) {
      const pos = positions[i % positions.length];
      const player = await db.player.create({
        data: {
          playerCode: playerCode++,
          firstName: `${team.name.charAt(0)}Player`,
          lastName: `${i + 1}`,
          active: true,
          coreTeamId: teamIds[team.name]!,
          primaryPosition: pos,
          secondaryPosition: i % 3 === 0 ? "CB" : null,
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
        },
      });
      players.push({
        id: player.id,
        coreTeamId: teamIds[team.name]!,
        coreTeamName: team.name,
        firstName: player.firstName,
        lastName: player.lastName ?? "",
        primaryPosition: pos,
        playerCode: player.playerCode,
      });
    }
  }

  return {
    seasonId: season.id,
    planningPeriodId: period.id,
    matchRoundId: round.id,
    teams: teamIds,
    players,
    matches: matchIds,
    rotationPathIds,
  };
}