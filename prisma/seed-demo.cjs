import { db } from "../src/generated/prisma/client";

async function main() {
  // Create demo season
  const season = await db.season.create({
    data: { name: "Demo Season" },
  });

  // Planning period
  const period = await db.planningPeriod.create({
    data: {
      name: "Spring Block 1",
      seasonId: season.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Match round
  const round = await db.matchRound.create({
    data: {
      name: "R1",
      planningPeriodId: period.id,
    },
  });

  // Teams A, B, C
  const teamA = await db.team.create({
    data: {
      name: "Team A",
      targetSquadSize: 11,
      minimumAcceptedSquadSize: 9,
      supportPriority: 100,
    },
  });
  const teamB = await db.team.create({
    data: { name: "Team B", targetSquadSize: 11, supportPriority: 50 },
  });
  const teamC = await db.team.create({
    data: { name: "Team C", targetSquadSize: 11, supportPriority: 30 },
  });

  // Matches for each team in the round
  const _matchA = await db.match.create({
    data: {
      matchRoundId: round.id,
      teamId: teamA.id,
      opponent: "Opponent A",
      startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      homeAway: "HOME",
    },
  });
  const _matchB = await db.match.create({
    data: {
      matchRoundId: round.id,
      teamId: teamB.id,
      opponent: "Opponent B",
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      homeAway: "AWAY",
    },
  });
  const _matchC = await db.match.create({
    data: {
      matchRoundId: round.id,
      teamId: teamC.id,
      opponent: "Opponent C",
      startsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      homeAway: "HOME",
    },
  });

  // Helper to create a player
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

  // 34 players distributed across teams (example subset)
  const players = [];
  for (let i = 1; i <= 34; i++) {
    const team = i % 3 === 1 ? teamA.id : i % 3 === 2 ? teamB.id : teamC.id;
    const pos = i % 5 === 0 ? "GK" : i % 5 === 1 ? "CB" : i % 5 === 2 ? "CM" : i % 5 === 3 ? "W" : "ST";
    const player = await createPlayer(`P${i}`, `Last${i}`, team, 1000 + i, pos);
    players.push(player);
  }

  // Rotation paths (A->B support, B->C support, B->A development, C->B development)
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
