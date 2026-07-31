import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { normalizeOpponentName, cleanOpponentDisplayName } from "@/lib/opponents/opponent-team";

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

  const connectionString = process.env.TEST_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL must be set for tests. Refusing to use DATABASE_URL as fallback — it may point to a production database.",
    );
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
  await db.selectionExplanation.deleteMany().catch(() => {});
  await db.movementCandidate.deleteMany().catch(() => {});
  await db.coachingIntent.deleteMany().catch(() => {});
  await db.playerReadinessSignal.deleteMany().catch(() => {});
  await db.matchExecutionFeedback.deleteMany().catch(() => {});
  await db.teamReflection.deleteMany().catch(() => {});
  await db.decisionRecord.deleteMany().catch(() => {});
  await db.teamSeasonSnapshotPlayer.deleteMany().catch(() => {});
  await db.teamSeasonSnapshot.deleteMany().catch(() => {});
  await db.seasonPeriodSnapshot.deleteMany().catch(() => {});
  await db.policyDecisionLog.deleteMany().catch(() => {});
  await db.matchReportPlayerStat.deleteMany().catch(() => {});
  await db.matchReportAbsence.deleteMany().catch(() => {});
  await db.assist.deleteMany().catch(() => {});
  await db.goal.deleteMany().catch(() => {});
  await db.postMatchPlayerActual.deleteMany().catch(() => {});
  await db.postMatchReport.deleteMany().catch(() => {});
  await db.selectionAudit.deleteMany().catch(() => {});
  await db.warning.deleteMany().catch(() => {});
  await db.movementLedger.deleteMany().catch(() => {});
  await db.selection.deleteMany().catch(() => {});
  await db.availability.deleteMany().catch(() => {});
  await db.playerLock.deleteMany().catch(() => {});
  await db.match.deleteMany().catch(() => {});
  await db.matchRound.deleteMany().catch(() => {});
  await db.leagueSeason.deleteMany().catch(() => {});
  await db.season.deleteMany().catch(() => {});
  await db.eventMatchSupportAssignment.deleteMany().catch(() => {});
  await db.eventSquadPlayer.deleteMany().catch(() => {});
  await db.eventSquad.deleteMany().catch(() => {});
  await db.eventPlayerAvailability.deleteMany().catch(() => {});
  await db.eventGoalEvent.deleteMany().catch(() => {});
  await db.eventAssistEvent.deleteMany().catch(() => {});
  await db.eventPostMatchPlayer.deleteMany().catch(() => {});
  await db.eventPostMatchReport.deleteMany().catch(() => {});
  await db.eventMatch.deleteMany().catch(() => {});
  await db.event.deleteMany().catch(() => {});
  await db.player.deleteMany().catch(() => {});
  await db.rotationPath.deleteMany().catch(() => {});
  await db.team.deleteMany().catch(() => {});
  await db.opponentTeam.deleteMany().catch(() => {});
  await db.ruleConfig.deleteMany().catch(() => {});
  await db.teamAccess.deleteMany().catch(() => {});
  await db.organisationInvitation.deleteMany().catch(() => {});
  await db.organisationMembership.deleteMany().catch(() => {});
  await db.machinePrincipal.deleteMany().catch(() => {});
  await db.organisation.deleteMany().catch(() => {});
  await db.account.deleteMany().catch(() => {});
  await db.session.deleteMany().catch(() => {});
  await db.verificationToken.deleteMany().catch(() => {});
  await db.user.deleteMany().catch(() => {});
}

export type TestFixtureIds = {
  organisationId: string | null;
  seasonId: string;
  leagueSeasonId: string;
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
  opponentTeamIds: Record<string, string>;
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
    createOrganisation?: boolean;
  },
): Promise<TestFixtureIds> {
  const teams = options?.teams ?? [
    { name: "Bla", targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 3, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
    { name: "Hvit", targetSquadSize: 12, minCorePlayers: 7, targetSupportCount: 4, maxSupportCount: 5, minSupportPlayers: 4, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 10, maxSquadSize: 14 },
    { name: "Rod", targetSquadSize: 11, minCorePlayers: 6, targetSupportCount: 2, maxSupportCount: 3, minSupportPlayers: 2, supportPriority: 2, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
  ];

  const playersPerTeam = options?.playersPerTeam ?? 12;

  const createOrganisation = options?.createOrganisation ?? false;
  let organisationId: string | null = null;
  if (createOrganisation) {
    const org = await db.organisation.create({
      data: { name: "Test Organisation", slug: `test-org-${Date.now()}` },
    });
    organisationId = org.id;
  }

  await db.ruleConfig.create({
    data: { name: "Test rules", minDaysBetweenAnyMatches: 3, warningThreshold: 5, ...(organisationId ? { organisationId } : {}) },
  });

  const season = await db.season.create({
    data: { name: "Test Season", year: 2026, ...(organisationId ? { organisationId } : {}) },
  });

  const period = await db.leagueSeason.create({
    data: {
      name: "Test Period",
      part: "SPRING",
      seasonId: season.id,
      startDate: new Date("2025-01-06"),
      endDate: new Date("2025-06-30"),
      ...(organisationId ? { organisationId } : {}),
    },
  });

  const round = await db.matchRound.create({
    data: {
      name: "W19 Test",
      leagueSeasonId: period.id,
      status: "DRAFT",
      ...(organisationId ? { organisationId } : {}),
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
        ...(organisationId ? { organisationId } : {}),
      },
    });
    teamIds[team.name] = created.id;
  }

  const matchIds: Record<string, string> = {};
  const opponentTeamIds: Record<string, string> = {};
  const baseDate = new Date("2025-04-28T10:00:00Z");
  const matchDates = options?.matchDates ?? {};
  for (const team of teams) {
    const opponentName = `Opponent ${team.name}`;
    const normalizedName = normalizeOpponentName(opponentName);
    const displayName = cleanOpponentDisplayName(opponentName);
    const opponentTeam = await db.opponentTeam.upsert({
      where: { normalizedName },
      update: { displayName },
      create: { displayName, normalizedName, ...(organisationId ? { organisationId } : {}) },
    });
    const opponentTeamId = opponentTeam.id;
    opponentTeamIds[normalizedName] = opponentTeamId;
    const matchDate = matchDates[team.name] ?? baseDate;
    const match = await db.match.create({
      data: {
        matchRoundId: round.id,
        teamId: teamIds[team.name]!,
        opponent: opponentName,
        opponentTeamId,
        startsAt: matchDate,
        homeAway: "HOME",
        squadSize: team.targetSquadSize ?? 11,
        matchType: "FRIENDLY",
        gameFormat: "ELEVEN_A_SIDE",
        ...(organisationId ? { organisationId } : {}),
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
        ...(organisationId ? { organisationId } : {}),
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
          ...(organisationId ? { organisationId } : {}),
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
    organisationId,
    seasonId: season.id,
    leagueSeasonId: period.id,
    matchRoundId: round.id,
    teams: teamIds,
    players,
    matches: matchIds,
    opponentTeamIds,
    rotationPathIds,
  };
}