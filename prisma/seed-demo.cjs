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
  const season = await db.season.create({
    data: { name: "Demo Season" },
  });

  const period = await db.leagueSeason.create({
    data: {
      name: "Spring 2026",
      part: "SPRING",
      seasonId: season.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const round = await db.matchRound.create({
    data: {
      name: "R1",
      leagueSeasonId: period.id,
    },
  });

  const teamA = await db.team.create({
    data: {
      name: "Team A",
      targetSquadSize: 11,
      minAcceptedSquadSize: 9,
      supportPriority: 100,
    },
  });
  const teamB = await db.team.create({
    data: { name: "Team B", targetSquadSize: 11, supportPriority: 50 },
  });
  const teamC = await db.team.create({
    data: { name: "Team C", targetSquadSize: 11, supportPriority: 30 },
  });

  const opponentTeamA = await db.opponentTeam.create({
    data: { displayName: "Opponent A", normalizedName: "opponent a" },
  });
  const opponentTeamB = await db.opponentTeam.create({
    data: { displayName: "Opponent B", normalizedName: "opponent b" },
  });
  const opponentTeamC = await db.opponentTeam.create({
    data: { displayName: "Opponent C", normalizedName: "opponent c" },
  });

  const _matchA = await db.match.create({
    data: {
      matchRoundId: round.id,
      teamId: teamA.id,
      opponent: "Opponent A",
      opponentTeamId: opponentTeamA.id,
      startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      homeAway: "HOME",
    },
  });
  const _matchB = await db.match.create({
    data: {
      matchRoundId: round.id,
      teamId: teamB.id,
      opponent: "Opponent B",
      opponentTeamId: opponentTeamB.id,
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      homeAway: "AWAY",
    },
  });
  const _matchC = await db.match.create({
    data: {
      matchRoundId: round.id,
      teamId: teamC.id,
      opponent: "Opponent C",
      opponentTeamId: opponentTeamC.id,
      startsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      homeAway: "HOME",
    },
  });

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
      },
    });
  }

  const players = [];
  for (let i = 1; i <= 34; i++) {
    const team = i % 3 === 1 ? teamA.id : i % 3 === 2 ? teamB.id : teamC.id;
    const pos = i % 5 === 0 ? "GK" : i % 5 === 1 ? "CB" : i % 5 === 2 ? "CM" : i % 5 === 3 ? "W" : "ST";
    const player = await createPlayer(`P${i}`, `Last${i}`, team, 1000 + i, pos);
    players.push(player);
  }

  await db.rotationPath.createMany({
    data: [
      { fromTeamId: teamA.id, toTeamId: teamB.id, role: "SUPPORT", purpose: "leadership", active: true },
      { fromTeamId: teamB.id, toTeamId: teamC.id, role: "SUPPORT", purpose: "leadership", active: true },
      { fromTeamId: teamB.id, toTeamId: teamA.id, role: "DEVELOPMENT", purpose: "harder match", active: true },
      { fromTeamId: teamC.id, toTeamId: teamB.id, role: "DEVELOPMENT", purpose: "harder match", active: true },
    ],
  });

  console.log("Demo data seeded.");
}

main()
  .catch((e) => console.error(e))
  .finally(() => db.$disconnect());
