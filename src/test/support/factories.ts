import type { PrismaClient, SecondaryFoot, BestSide, AvailabilityStatus, EventType, FootballGroupType, FootPreference } from "@/generated/prisma/client";

let counter = 0;
function nextId(): number {
  return ++counter;
}

export function resetFactoryCounters(): void {
  counter = 0;
}

export async function createTestOrganisation(
  db: PrismaClient,
  overrides?: { name?: string; slug?: string },
) {
  const id = nextId();
  return db.organisation.create({
    data: {
      name: overrides?.name ?? `Test Org ${id}`,
      slug: overrides?.slug ?? `test-org-${id}-${Date.now()}`,
    },
  });
}

export async function createTestGroup(
  db: PrismaClient,
  organisationId: string,
  overrides?: { name?: string; slug?: string; type?: string },
) {
  const id = nextId();
  return db.footballGroup.create({
    data: {
      name: overrides?.name ?? `Test Group ${id}`,
      slug: overrides?.slug ?? `test-group-${id}-${Date.now()}`,
      type: (overrides?.type as FootballGroupType) ?? "AGE_GROUP",
      organisationId,
    },
  });
}

export type CreateTestTeamOverrides = {
  name?: string;
  targetSquadSize?: number;
  minCorePlayers?: number;
  targetSupportCount?: number;
  maxSupportCount?: number;
  minSupportPlayers?: number;
  supportPriority?: number;
  developmentSlots?: number;
  minAcceptedSquadSize?: number;
  maxSquadSize?: number;
};

export async function createTestTeam(
  db: PrismaClient,
  organisationId: string,
  groupId: string,
  overrides?: CreateTestTeamOverrides,
) {
  return db.team.create({
    data: {
      name: overrides?.name ?? `Team ${nextId()}`,
      targetSquadSize: overrides?.targetSquadSize ?? 11,
      minCorePlayers: overrides?.minCorePlayers ?? 8,
      targetSupportCount: overrides?.targetSupportCount ?? 0,
      maxSupportCount: overrides?.maxSupportCount ?? 5,
      minSupportPlayers: overrides?.minSupportPlayers ?? 0,
      supportPriority: overrides?.supportPriority ?? 0,
      developmentSlots: overrides?.developmentSlots ?? 0,
      minAcceptedSquadSize: overrides?.minAcceptedSquadSize ?? 9,
      maxSquadSize: overrides?.maxSquadSize ?? 14,
      organisationId,
      footballGroupId: groupId,
    },
  });
}

export async function createTestTeams(
  db: PrismaClient,
  organisationId: string,
  groupId: string,
  count: number,
  overrides?: Partial<CreateTestTeamOverrides>,
) {
  const teams = [];
  for (let i = 0; i < count; i++) {
    teams.push(await createTestTeam(db, organisationId, groupId, overrides));
  }
  return teams;
}

export type CreateTestPlayerOverrides = {
  firstName?: string;
  lastName?: string;
  primaryPosition?: string;
  secondaryPosition?: string | null;
  preferredFoot?: string;
  secondaryFoot?: string;
  bestSide?: string;
  currentAvailability?: string;
  playerCode?: number;
  active?: boolean;
};

export async function createTestPlayer(
  db: PrismaClient,
  organisationId: string,
  coreTeamId: string,
  overrides?: CreateTestPlayerOverrides,
) {
  const id = nextId();
  return db.player.create({
    data: {
      playerCode: overrides?.playerCode ?? 1000 + id,
      firstName: overrides?.firstName ?? `Player`,
      lastName: overrides?.lastName ?? `${id}`,
      active: overrides?.active ?? true,
      coreTeamId,
      primaryPosition: overrides?.primaryPosition ?? "CM",
      secondaryPosition: overrides?.secondaryPosition ?? null,
      preferredFoot: (overrides?.preferredFoot ?? "RIGHT") as FootPreference,
      secondaryFoot: (overrides?.secondaryFoot ?? "WEAK") as SecondaryFoot,
      bestSide: (overrides?.bestSide ?? "CENTER") as BestSide,
      currentAvailability: (overrides?.currentAvailability ?? "AVAILABLE") as AvailabilityStatus,
      organisationId,
    },
  });
}

export async function createTestPlayers(
  db: PrismaClient,
  organisationId: string,
  coreTeamId: string,
  count: number,
  overrides?: Partial<CreateTestPlayerOverrides>,
) {
  const positions = ["GK", "CB", "CM", "W", "ST"];
  const players = [];
  for (let i = 0; i < count; i++) {
    players.push(
      await createTestPlayer(db, organisationId, coreTeamId, {
        ...overrides,
        primaryPosition: overrides?.primaryPosition ?? positions[i % positions.length],
      }),
    );
  }
  return players;
}

export async function createTestSeason(
  db: PrismaClient,
  organisationId: string,
  overrides?: { name?: string; year?: number },
) {
  return db.season.create({
    data: {
      name: overrides?.name ?? "Test Season",
      year: overrides?.year ?? 2026,
      organisationId,
    },
  });
}

export async function createTestLeagueSeason(
  db: PrismaClient,
  organisationId: string,
  groupId: string,
  seasonId: string,
  overrides?: { name?: string; part?: string; startDate?: Date; endDate?: Date },
) {
  return db.leagueSeason.create({
    data: {
      name: overrides?.name ?? "Test Period",
      part: (overrides?.part as "SPRING" | "FALL") ?? "SPRING",
      seasonId,
      startDate: overrides?.startDate ?? new Date("2025-01-06"),
      endDate: overrides?.endDate ?? new Date("2025-06-30"),
      organisationId,
      footballGroupId: groupId,
    },
  });
}

export async function createTestRound(
  db: PrismaClient,
  organisationId: string,
  leagueSeasonId: string,
  overrides?: { name?: string; status?: string },
) {
  return db.matchRound.create({
    data: {
      name: overrides?.name ?? `W${nextId()} Test`,
      leagueSeasonId,
      status: (overrides?.status as "DRAFT" | "FINALIZED" | "BLOCKED" | "READY") ?? "DRAFT",
      organisationId,
    },
  });
}

export async function createTestMatch(
  db: PrismaClient,
  organisationId: string,
  matchRoundId: string,
  teamId: string,
  opponentTeamId: string | null,
  overrides?: {
    opponent?: string;
    startsAt?: Date;
    homeAway?: string;
    squadSize?: number;
    matchType?: string;
    gameFormat?: string;
  },
) {
  return db.match.create({
    data: {
      matchRoundId,
      teamId,
      opponent: overrides?.opponent ?? "Test Opponent",
      opponentTeamId,
      startsAt: overrides?.startsAt ?? new Date("2025-04-28T10:00:00Z"),
      homeAway: (overrides?.homeAway as "HOME" | "AWAY") ?? "HOME",
      squadSize: overrides?.squadSize ?? 11,
      matchType: (overrides?.matchType as "FRIENDLY" | "LEAGUE") ?? "FRIENDLY",
      gameFormat: (overrides?.gameFormat as "ELEVEN_A_SIDE" | "SEVEN_A_SIDE" | "FIVE_A_SIDE" | "THREE_A_SIDE" | "NINE_A_SIDE") ?? "ELEVEN_A_SIDE",
      organisationId,
    },
  });
}

export async function createTestOpponentTeam(
  db: PrismaClient,
  organisationId: string,
  overrides?: { displayName?: string },
) {
  const name = overrides?.displayName ?? `Opponent ${nextId()}`;
  const { normalizeOpponentName, cleanOpponentDisplayName } = await import("@/lib/opponents/opponent-team");
  const normalizedName = normalizeOpponentName(name);
  const displayName = cleanOpponentDisplayName(name);
  return db.opponentTeam.upsert({
    where: { organisationId_normalizedName: { organisationId, normalizedName } },
    update: { displayName },
    create: { displayName, normalizedName, organisationId },
  });
}

export async function createTestEvent(
  db: PrismaClient,
  organisationId: string,
  groupId: string,
  overrides?: {
    name?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    gameFormat?: string;
  },
) {
  return db.event.create({
    data: {
      name: overrides?.name ?? `Test Event ${nextId()}`,
      eventType: (overrides?.type as EventType) ?? "CUP",
      startsAt: overrides?.startDate ?? new Date("2025-05-01"),
      endDate: overrides?.endDate ?? new Date("2025-05-02"),
      gameFormat: (overrides?.gameFormat as "ELEVEN_A_SIDE" | "SEVEN_A_SIDE" | "FIVE_A_SIDE" | "THREE_A_SIDE" | "NINE_A_SIDE") ?? "FIVE_A_SIDE",
      organisationId,
      footballGroupId: groupId,
    },
  });
}

export type CreateTestEventSquadOverrides = {
  name?: string;
  intent?: string;
  targetSize?: number;
  minSize?: number;
  maxSize?: number;
  generationOrder?: number;
  status?: string;
};

export async function createTestEventSquad(
  db: PrismaClient,
  organisationId: string,
  eventId: string,
  overrides?: CreateTestEventSquadOverrides,
) {
  return db.eventSquad.create({
    data: {
      name: overrides?.name ?? `Squad ${nextId()}`,
      intent: (overrides?.intent as "COMPETITIVE" | "BALANCED" | "MANUAL") ?? "BALANCED",
      targetSize: overrides?.targetSize ?? 5,
      minSize: overrides?.minSize ?? 4,
      maxSize: overrides?.maxSize ?? 7,
      generationOrder: overrides?.generationOrder ?? 1,
      status: (overrides?.status as "DRAFT" | "LOCKED") ?? "DRAFT",
      eventId,
      organisationId,
    },
  });
}

export async function createTestAvailability(
  db: PrismaClient,
  organisationId: string,
  playerId: string,
  matchRoundId: string,
  overrides?: { status?: string },
) {
  return db.availability.create({
    data: {
      playerId,
      matchRoundId,
      status: (overrides?.status as "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN") ?? "AVAILABLE",
      organisationId,
    },
  });
}

export async function createTestRotationPath(
  db: PrismaClient,
  organisationId: string,
  fromTeamId: string,
  toTeamId: string,
  overrides?: { role?: string; active?: boolean; purpose?: string },
) {
  return db.rotationPath.create({
    data: {
      fromTeamId,
      toTeamId,
      role: (overrides?.role as "SUPPORT" | "DEVELOPMENT" | "BACKFILL" | "CONFIDENCE_REBUILD") ?? "SUPPORT",
      purpose: overrides?.purpose ?? "Test rotation path",
      active: overrides?.active ?? true,
      cooldownRounds: 0,
      allowDoubleLoad: false,
      organisationId,
    },
  });
}

export async function createTestUser(
  db: PrismaClient,
  overrides?: { email?: string; name?: string },
) {
  const id = nextId();
  return db.user.create({
    data: {
      email: overrides?.email ?? `test-${id}@example.com`,
      name: overrides?.name ?? `Test User ${id}`,
    },
  });
}

export async function createTestAccount(
  db: PrismaClient,
  userId: string,
  overrides?: { provider?: string },
) {
  return db.account.create({
    data: {
      userId,
      type: "oauth",
      provider: overrides?.provider ?? "google",
      providerAccountId: `account-${nextId()}`,
    },
  });
}

export async function createTestMembership(
  db: PrismaClient,
  organisationId: string,
  userId: string,
  overrides?: { role?: string },
) {
  return db.organisationMembership.create({
    data: {
      organisationId,
      userId,
      role: (overrides?.role as "OWNER" | "ADMIN" | "COACH" | "VIEWER") ?? "COACH",
    },
  });
}

export async function createTestOrganisationWithMembership(
  db: PrismaClient,
  overrides?: {
    orgName?: string;
    userName?: string;
    userEmail?: string;
    role?: string;
  },
) {
  const org = await createTestOrganisation(db, { name: overrides?.orgName });
  const user = await createTestUser(db, {
    email: overrides?.userEmail,
    name: overrides?.userName,
  });
  const membership = await createTestMembership(db, org.id, user.id, { role: overrides?.role });
  await createTestAccount(db, user.id);
  return { org, user, membership };
}

export async function createTestPermissionScenario(
  db: PrismaClient,
) {
  const owner = await createTestOrganisationWithMembership(db, { role: "OWNER" });
  const admin = await createTestOrganisationWithMembership(db, { role: "ADMIN" });
  const coach = await createTestOrganisationWithMembership(db, { role: "COACH" });
  const viewer = await createTestOrganisationWithMembership(db, { role: "VIEWER" });

  const outsiderOrg = await createTestOrganisation(db, { name: "Outsider Org" });
  const outsiderUser = await createTestUser(db, { email: "outsider@example.com" });
  await createTestAccount(db, outsiderUser.id);
  await createTestMembership(db, outsiderOrg.id, outsiderUser.id, { role: "COACH" });

  return {
    owner: { ...owner, org: owner.org, user: owner.user, membership: owner.membership },
    admin: { ...admin, org: admin.org, user: admin.user, membership: admin.membership },
    coach: { ...coach, org: coach.org, user: coach.user, membership: coach.membership },
    viewer: { ...viewer, org: viewer.org, user: viewer.user, membership: viewer.membership },
    outsider: { org: outsiderOrg, user: outsiderUser },
  };
}

export async function createTestCrossTenantScenario(db: PrismaClient) {
  const orgA = await createTestOrganisation(db, { name: "Organisation A" });
  const orgB = await createTestOrganisation(db, { name: "Organisation B" });

  const groupA = await createTestGroup(db, orgA.id, { name: "Group A" });
  const groupB = await createTestGroup(db, orgB.id, { name: "Group B" });

  const coachA = await createTestUser(db, { email: "coach-a@example.com" });
  const coachB = await createTestUser(db, { email: "coach-b@example.com" });
  await createTestAccount(db, coachA.id);
  await createTestAccount(db, coachB.id);
  await createTestMembership(db, orgA.id, coachA.id, { role: "COACH" });
  await createTestMembership(db, orgB.id, coachB.id, { role: "COACH" });

  return {
    orgA,
    orgB,
    groupA,
    groupB,
    coachA,
    coachB,
    membershipA: await db.organisationMembership.findFirst({ where: { userId: coachA.id, organisationId: orgA.id } }),
    membershipB: await db.organisationMembership.findFirst({ where: { userId: coachB.id, organisationId: orgB.id } }),
  };
}

export async function cleanEventTables(db: PrismaClient): Promise<void> {
  await db.eventMatchLineupAssignment.deleteMany().catch(() => {});
  await db.eventMatchLineup.deleteMany().catch(() => {});
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
}