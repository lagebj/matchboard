require("dotenv/config");

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
    data: { name: "Demo Season", year: new Date().getFullYear(), organisationId: org.id },
  });

  // Football group
  const group = await db.footballGroup.create({
    data: {
      name: "Demo Group",
      slug: "demo-group",
      organisationId: org.id,
      isActive: true,
    },
  });

  const period = await db.leagueSeason.create({
    data: {
      name: "Spring 2026",
      part: "SPRING",
      seasonId: season.id,
      organisationId: org.id,
      footballGroupId: group.id,
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

  // Teams
  const teamA = await db.team.create({
    data: {
      name: "Team A",
      targetSquadSize: 11,
      minAcceptedSquadSize: 9,
      supportPriority: 100,
      organisationId: org.id,
      footballGroupId: group.id,
    },
  });
  const teamB = await db.team.create({
    data: {
      name: "Team B",
      targetSquadSize: 11,
      supportPriority: 50,
      organisationId: org.id,
      footballGroupId: group.id,
    },
  });
  const teamC = await db.team.create({
    data: {
      name: "Team C",
      targetSquadSize: 11,
      supportPriority: 30,
      organisationId: org.id,
      footballGroupId: group.id,
    },
  });

  // Group access for coach
  await db.groupAccess.createMany({
    data: [
      { membershipId: (await db.organisationMembership.findFirst({ where: { userId: coachUser.id, organisationId: org.id } })).id, footballGroupId: group.id, organisationId: org.id, role: "GROUP_COACH" },
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
  const matchA = await db.match.create({
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
        currentAvailability: "AVAILABLE",
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
      footballGroupId: group.id,
    },
  });

  // --- GuestPlayer demonstration (ADR-0106) ---
  // A second League season and an extra round, so Oliver Hansen can demonstrate reuse of one
  // identity across both a specific round number ("Round 7") and across two seasons -- a
  // GuestPlayer is a reusable, Group-owned identity, not a per-season or per-round record.
  const fallSeason = await db.leagueSeason.create({
    data: {
      name: "Fall 2026",
      part: "FALL",
      seasonId: season.id,
      organisationId: org.id,
      footballGroupId: group.id,
      startDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 210 * 24 * 60 * 60 * 1000),
    },
  });
  const fallRound = await db.matchRound.create({
    data: { name: "R1", leagueSeasonId: fallSeason.id, organisationId: org.id },
  });
  const springRound7 = await db.matchRound.create({
    data: { name: "R7", leagueSeasonId: period.id, organisationId: org.id },
  });

  const guestOliver = await db.guestPlayer.create({
    data: { name: "Oliver Hansen", sourceLabel: "G2016", organisationId: org.id, footballGroupId: group.id },
  });
  const guestNoah = await db.guestPlayer.create({
    data: { name: "Noah Berg", sourceLabel: "G2016", organisationId: org.id, footballGroupId: group.id },
  });
  const guestEmil = await db.guestPlayer.create({
    data: { name: "Emil Larsen", sourceLabel: "G2014", organisationId: org.id, footballGroupId: group.id },
  });

  // Oliver: League Round 7 participation, reused (same identity, no duplication) in Fall R1.
  await db.leagueRoundParticipant.create({
    data: { matchRoundId: springRound7.id, guestPlayerId: guestOliver.id, organisationId: org.id },
  });
  await db.leagueRoundParticipant.create({
    data: { matchRoundId: fallRound.id, guestPlayerId: guestOliver.id, organisationId: org.id },
  });

  // Emil: historical League Match participation, preserved after the identity is deactivated
  // below (never hard-deleted).
  await db.leagueRoundParticipant.create({
    data: { matchRoundId: round.id, guestPlayerId: guestEmil.id, organisationId: org.id },
  });
  await db.leagueMatchGuestAssignment.create({
    data: { matchId: matchA.id, matchRoundId: round.id, guestPlayerId: guestEmil.id, organisationId: org.id },
  });
  await db.guestPlayer.update({
    where: { id: guestEmil.id },
    data: { active: false, deactivatedAt: new Date() },
  });

  // Demo Cup: Oliver and Noah both attend the Event; Oliver has a partial-availability
  // exception for the second match while remaining available for the Event overall.
  const demoEvent = await db.event.create({
    data: {
      name: "Demo Cup",
      eventType: "CUP",
      gameFormat: "SEVEN_A_SIDE",
      matchDurationMinutes: 20,
      startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      organisationId: org.id,
      footballGroupId: group.id,
    },
  });
  const demoSquad = await db.eventSquad.create({
    data: {
      eventId: demoEvent.id,
      name: "Demo Cup Squad",
      intent: "BALANCED",
      targetSize: 9,
      generationOrder: 0,
      organisationId: org.id,
    },
  });
  await db.eventMatch.create({
    data: {
      eventId: demoEvent.id,
      eventSquadId: demoSquad.id,
      category: "CUP",
      opponentName: "Opponent A",
      startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      organisationId: org.id,
    },
  });
  const demoMatch2 = await db.eventMatch.create({
    data: {
      eventId: demoEvent.id,
      eventSquadId: demoSquad.id,
      category: "CUP",
      opponentName: "Opponent B",
      startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      organisationId: org.id,
    },
  });

  for (const guest of [guestOliver, guestNoah]) {
    await db.eventPlayerAvailability.create({
      data: { eventId: demoEvent.id, guestPlayerId: guest.id, status: "AVAILABLE", organisationId: org.id },
    });
    await db.eventSquadPlayer.create({
      data: { eventId: demoEvent.id, eventSquadId: demoSquad.id, guestPlayerId: guest.id, source: "MANUAL", selectionReason: "Manually assigned by coach", organisationId: org.id },
    });
  }

  // Oliver attends the Event overall, but is unavailable for the second match specifically.
  await db.eventMatchAvailability.create({
    data: { eventMatchId: demoMatch2.id, guestPlayerId: guestOliver.id, note: "Family commitment", organisationId: org.id },
  });

  console.log("Demo data seeded for organisation:", org.slug);
  console.log("Owner email:", ownerUser.email);
  console.log("Coach email:", coachUser.email);
  console.log("Guest players: Oliver Hansen (G2016, active), Noah Berg (G2016, active), Emil Larsen (G2014, inactive)");
}

main()
  .catch((e) => console.error(e))
  .finally(() => db.$disconnect());