import "dotenv/config";

function createAdapter(url) {
  if (url.includes(".neon.tech")) {
    const { PrismaNeon } = require("@prisma/adapter-neon");
    return new PrismaNeon({ connectionString: url });
  }
  const { PrismaPg } = require("@prisma/adapter-pg");
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url });
  return new PrismaPg(pool);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set for seeding.");
}

const adapter = createAdapter(connectionString);
const db = new (require("../src/generated/prisma/client").PrismaClient)({ adapter, log: ["warn", "error"] });

async function main() {
  // Organisation
  const org = await db.organisation.create({
    data: {
      name: "Demo FC",
      slug: "demo-fc",
    },
  });

  // Owner user (seeded by Auth.js adapter on first OAuth sign-in, but we create a placeholder for seed data)
  const ownerUser = await db.user.create({
    data: {
      email: "owner@demofc.example.com",
      name: "Demo Owner",
    },
  });

  const coachUser = await db.user.create({
    data: {
      email: "coach@demofc.example.com",
      name: "Demo Coach",
    },
  });

  // Memberships
  await db.organisationMembership.create({
    data: {
      userId: ownerUser.id,
      organisationId: org.id,
      role: "OWNER",
    },
  });

  await db.organisationMembership.create({
    data: {
      userId: coachUser.id,
      organisationId: org.id,
      role: "COACH",
    },
  });

  // Season and league season
  const season = await db.season.create({
    data: { name: "Demo Season", organisationId: org.id },
  });

  const period = await db.leagueSeason.create({
    data: {
      name: "Spring 2026",
      part: "SPRING",
      seasonId: season.id,
      organisationId: org.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const round = await db.matchRound.create({
    data: {
      name: "R1",
      leagueSeasonId: period.id,
      organisationId: org.id,
    },
  });

  // Football group
  const group = await db.footballGroup.create({
    data: {
      name: "Demo Group",
      organisationId: org.id,
      isSynthetic: false,
    },
  });

  // Teams
  const teamA = await db.team.create({
    data: {
      name: "Team A",
      targetSquadSize: 11,
      minAcceptedSquadSize: 9,
      supportPriority: 100,
      organisationId: org.id,
      groupId: group.id,
    },
  });
  const teamB = await db.team.create({
    data: {
      name: "Team B",
      targetSquadSize: 11,
      supportPriority: 50,
      organisationId: org.id,
      groupId: group.id,
    },
  });
  const teamC = await db.team.create({
    data: {
      name: "Team C",
      targetSquadSize: 11,
      supportPriority: 30,
      organisationId: org.id,
      groupId: group.id,
    },
  });

  // Group access for coach
  await db.groupAccess.createMany({
    data: [
      { membershipId: (await db.organisationMembership.findFirst({ where: { userId: coachUser.id, organisationId: org.id } })).id, footballGroupId: group.id, accessRole: "COACH" },
    ],
  });

  // Opponent teams
  const opponentTeamA = await db.opponentTeam.create({
    data: { displayName: "Opponent A", normalizedName: "opponent a", organisationId: org.id },
  });
  const opponentTeamB = await db.opponentTeam.create({
    data: { displayName: "Opponent B", normalizedName: "opponent b", organisationId: org.id },
  });
  const opponentTeamC = await db.opponentTeam.create({
    data: { displayName: "Opponent C", normalizedName: "opponent c", organisationId: org.id },
  });

  // Matches
  await db.match.create({
    data: {
      matchRoundId: round.id,
      teamId: teamA.id,
      opponent: "Opponent A",
      opponentTeamId: opponentTeamA.id,
      startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      homeAway: "HOME",
      organisationId: org.id,
    },
  });
  await db.match.create({
    data: {
      matchRoundId: round.id,
      teamId: teamB.id,
      opponent: "Opponent B",
      opponentTeamId: opponentTeamB.id,
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      homeAway: "AWAY",
      organisationId: org.id,
    },
  });
  await db.match.create({
    data: {
      matchRoundId: round.id,
      teamId: teamC.id,
      opponent: "Opponent C",
      opponentTeamId: opponentTeamC.id,
      startsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      homeAway: "HOME",
      organisationId: org.id,
    },
  });

  // Players
  async function createPlayer(first, last, coreTeamId, code, pos) {
    return await db.player.create({
      data: {
        playerCode: code,
        firstName: first,
        lastName: last,
        coreTeamId,
        primaryPosition: pos,
        secondaryPosition: "NONE",
        tertiaryPosition: "NONE",
        preferredFoot: "RIGHT",
        secondaryFoot: "WEAK",
        bestSide: "CENTER",
        currentAvailability: "CONFIRMED",
        organisationId: org.id,
      },
    });
  }

  for (let i = 1; i <= 34; i++) {
    const team = i % 3 === 1 ? teamA.id : i % 3 === 2 ? teamB.id : teamC.id;
    const pos = i % 5 === 0 ? "GK" : i % 5 === 1 ? "CB" : i % 5 === 2 ? "CM" : i % 5 === 3 ? "W" : "ST";
    await createPlayer(`P${i}`, `Last${i}`, team, 1000 + i, pos);
  }

  // Rotation paths
  await db.rotationPath.createMany({
    data: [
      { fromTeamId: teamA.id, toTeamId: teamB.id, role: "SUPPORT", purpose: "leadership", active: true, organisationId: org.id },
      { fromTeamId: teamB.id, toTeamId: teamC.id, role: "SUPPORT", purpose: "leadership", active: true, organisationId: org.id },
      { fromTeamId: teamB.id, toTeamId: teamA.id, role: "DEVELOPMENT", purpose: "harder match", active: true, organisationId: org.id },
      { fromTeamId: teamC.id, toTeamId: teamB.id, role: "DEVELOPMENT", purpose: "harder match", active: true, organisationId: org.id },
    ],
  });

  // Rule config
  await db.ruleConfig.create({
    data: {
      organisationId: org.id,
      key: "default",
      value: {},
    },
  });

  console.log("Demo data seeded for organisation:", org.slug);
  console.log("Owner email:", ownerUser.email);
  console.log("Coach email:", coachUser.email);
}

main()
  .catch((e) => console.error(e))
  .finally(() => db.$disconnect());