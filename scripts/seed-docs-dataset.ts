/**
 * Documentation dataset seed — Fjordvik FK (ADR-0103, user-documentation-experience Phase 2).
 *
 * A dedicated, deterministic-at-the-domain-level dataset used only for public documentation
 * screenshots and examples. This is a distinct profile from scripts/seed-test-dataset.ts's
 * generic E2E fixtures (DEMO_UNIVERSE.md "Seed isolation") — it exists to read well in prose
 * and screenshots, not to exercise every selection-engine edge case.
 *
 * Derived evidence (draft selections, finalized history, post-match evidence, combination
 * evidence) is produced by calling the real, production-owned domain operations
 * (generateMatchRound, finalizeMatchRound, completeReport, rebuildActualTimeline,
 * generateEventSquads) rather than hand-inserting rows that merely look like their output
 * (DEMO_UNIVERSE.md §11). Foundational input data (organisation, players, teams, matches,
 * availability, lineups, rotations) is created directly, mirroring how
 * scripts/seed-test-dataset.ts creates its own foundational data.
 *
 * Usage:
 *   DATABASE_URL="$TEST_DATABASE_URL" MATCHBOARD_ENV=test npx tsx scripts/seed-docs-dataset.ts
 *
 * Refuses to run when MATCHBOARD_ENV is not "test". Safely repeatable: cleans any prior
 * fjordvik-fk organisation before reseeding.
 *
 * This script's own row creation reads TEST_DATABASE_URL (falling back to DATABASE_URL), but the
 * generation/reporting/evidence domain operations it calls (generateMatchRound, completeReport,
 * etc., via seed-docs-scenarios.ts) go through src/lib/db.ts's application singleton, which reads
 * DATABASE_URL only. Export DATABASE_URL="$TEST_DATABASE_URL" for this whole session (seed, `npm
 * run dev`, and `npm run docs:screenshots` alike) or the two halves of this script will silently
 * operate on two different databases.
 */

import "dotenv/config";

function createAdapter(url: string) {
  // Same one-connection-pool pattern as seed-test-dataset.ts (see its own comment) — guarantees
  // every statement in this script shares one session, avoiding intermittent P2003 foreign-key
  // races against Neon's serverless driver.
  const { PrismaPg } = require("@prisma/adapter-pg");
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url, max: 1 });
  return new PrismaPg(pool);
}

const DOCS_NAMESPACE = "test-agent.matchboard.football"; // matches src/auth.ts's default TEST_AGENT_AUTH_NAMESPACE

// Dates are anchored to the real current time, not a fixed calendar date (DEMO_UNIVERSE.md §12
// explicitly allows adapting its suggested dates: "preserve the semantic relationships rather
// than these exact dates"). The alternative -- a server-side "frozen today" seam overriding
// every date-dependent read (league season "is current", Today's derivation, etc.) app-wide --
// was rejected: PROGRAMME.md §10.2 explicitly warns "do not rewrite broad domain time handling
// solely for screenshots", and this repository has no existing time abstraction to hook into
// (see ADR-0103). Anchoring to real "now" keeps the League season genuinely "current" and Today
// genuinely showing this data as upcoming/recent without touching any application code.
function daysFromNow(days: number, hourUtc = 9): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
}

export const REF = {
  seasonStart: daysFromNow(-70),
  seasonEnd: daysFromNow(70),
  historical1: daysFromNow(-42), // Rød vs Bergstad IF, 1st meeting
  historicalGranli: daysFromNow(-35), // Hvit vs Granli IL (variety)
  historical2: daysFromNow(-28), // Rød vs Bergstad IF, 2nd meeting
  historical3: daysFromNow(-14), // Blå vs Bergstad IF, 3rd meeting
  story: daysFromNow(-7), // Rød vs Bergstad IF, 4th meeting -- the connected story match
  upcomingRod: daysFromNow(9),
  upcomingBla: daysFromNow(9, 11),
  upcomingHvit: daysFromNow(10),
  event: daysFromNow(27),
};

// Fjordvik FK universe (DEMO_UNIVERSE.md).
const PLAYER_POOL: Array<{ firstName: string; lastName: string; position: "GK" | "CB" | "CM" | "W" | "ST" }> = [
  { firstName: "Elias", lastName: "Storm", position: "CM" },
  { firstName: "Noah", lastName: "Berg", position: "CB" },
  { firstName: "Theo", lastName: "Falk", position: "W" },
  { firstName: "Jakob", lastName: "Lund", position: "CB" },
  { firstName: "Oliver", lastName: "Strand", position: "CM" },
  { firstName: "Sander", lastName: "Viken", position: "ST" },
  { firstName: "Emil", lastName: "Ravn", position: "W" },
  { firstName: "Leo", lastName: "Hauge", position: "CM" },
  { firstName: "Isak", lastName: "Vale", position: "CB" },
  { firstName: "Aksel", lastName: "Nord", position: "GK" },
  { firstName: "Filip", lastName: "Solberg", position: "ST" },
  { firstName: "Mikkel", lastName: "Dahl", position: "CB" },
  { firstName: "Lucas", lastName: "Moen", position: "W" },
  { firstName: "Oskar", lastName: "Fjell", position: "CM" },
  { firstName: "Adrian", lastName: "Skog", position: "GK" },
  { firstName: "Henrik", lastName: "Aune", position: "ST" },
  { firstName: "Kasper", lastName: "Holm", position: "CB" },
  { firstName: "Benjamin", lastName: "Tveit", position: "CM" },
  { firstName: "Tobias", lastName: "Gran", position: "W" },
  { firstName: "William", lastName: "Eide", position: "ST" },
  { firstName: "Mateo", lastName: "Silva", position: "ST" },
  { firstName: "Luca", lastName: "Moretti", position: "CM" },
  { firstName: "Noah", lastName: "Mensah", position: "CB" },
  { firstName: "Adam", lastName: "Haddad", position: "W" },
  { firstName: "Elias", lastName: "Novak", position: "GK" },
  { firstName: "Amir", lastName: "Rahman", position: "CM" },
];

const OPPONENTS = [
  { displayName: "Stormhavn IL", normalizedName: "stormhavn il" },
  { displayName: "Solsiden SK", normalizedName: "solsiden sk" },
  { displayName: "Skogheim FK", normalizedName: "skogheim fk" },
  { displayName: "Bergstad IF", normalizedName: "bergstad if" },
  { displayName: "Havørn FK", normalizedName: "havørn fk" },
  { displayName: "Granli IL", normalizedName: "granli il" },
];

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

  console.log("Seeding Fjordvik FK documentation dataset...");

  const adapter = createAdapter(connectionString);
  const { PrismaClient } = require("../src/generated/prisma/client");
  const rawDb = new PrismaClient({ adapter, log: ["warn", "error"] });

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

  const { setTenantOrganisationId } = require("../src/lib/tenancy/tenant-async-storage");

  try {
    // ============ Clean any prior docs organisation (safely repeatable) ============
    const existing = await rawDb.organisation.findFirst({ where: { slug: "fjordvik-fk" }, select: { id: true } });
    if (existing) {
      console.log("Removing prior fjordvik-fk organisation...");
      await rawDb.organisation.delete({ where: { id: existing.id } });
    }
    // User rows are not scoped to (or cascade-deleted with) an Organisation -- Auth.js's User
    // model is shared across every organisation a person belongs to. Delete the docs-agent
    // users by email explicitly so reseeding is safely repeatable.
    await rawDb.user.deleteMany({ where: { email: { endsWith: `@${DOCS_NAMESPACE}` } } });

    // ============ Organisation ============
    const org = await db.organisation.create({ data: { name: "Fjordvik FK", slug: "fjordvik-fk" } });
    setTenantOrganisationId(org.id);
    console.log(`Created organisation: ${org.name} (${org.id})`);

    // ============ Docs coach user (Auth.js test-agent flow, ADR-0103/Phase 3) ============
    const coach = await db.user.create({ data: { email: `docs-coach@${DOCS_NAMESPACE}`, name: "Fjordvik FK Coach" } });
    await db.account.create({ data: { userId: coach.id, type: "oauth", provider: "google", providerAccountId: `synthetic-${coach.id}` } });
    const membership = await db.organisationMembership.create({ data: { userId: coach.id, organisationId: org.id, role: "COACH" } });

    // ============ Football group and teams ============
    const group = await db.footballGroup.create({ data: { name: "Fjordvik FK", slug: "fjordvik-fk-group", type: "AGE_GROUP", organisationId: org.id } });
    await db.groupAccess.create({ data: { membershipId: membership.id, footballGroupId: group.id, role: "GROUP_COACH", organisationId: org.id } });

    // generateSelection() calls getRules() with no orgFilter argument, so its auto-create
    // fallback (which does require an explicit orgFilter) never fires -- create the default
    // RuleConfig up front instead of relying on it.
    await db.ruleConfig.create({
      data: { organisationId: org.id, footballGroupId: group.id, minDaysBetweenAnyMatches: 3, name: "Default ruleset", version: 1, warningThreshold: 3 },
    });

    const teamRod = await db.team.create({ data: { name: "Fjordvik Rød", targetSquadSize: 9, minAcceptedSquadSize: 7, maxSquadSize: 12, supportPriority: 1, organisationId: org.id, footballGroupId: group.id } });
    const teamBla = await db.team.create({ data: { name: "Fjordvik Blå", targetSquadSize: 9, minAcceptedSquadSize: 7, maxSquadSize: 12, supportPriority: 2, organisationId: org.id, footballGroupId: group.id } });
    const teamHvit = await db.team.create({ data: { name: "Fjordvik Hvit", targetSquadSize: 9, minAcceptedSquadSize: 7, maxSquadSize: 12, supportPriority: 3, organisationId: org.id, footballGroupId: group.id } });
    const teams = [teamRod, teamBla, teamHvit];

    await db.rotationPath.createMany({
      data: [
        { fromTeamId: teamRod.id, toTeamId: teamBla.id, role: "SUPPORT", purpose: "leadership support", active: true, organisationId: org.id },
        { fromTeamId: teamRod.id, toTeamId: teamHvit.id, role: "SUPPORT", purpose: "leadership support", active: true, organisationId: org.id },
        { fromTeamId: teamBla.id, toTeamId: teamHvit.id, role: "SUPPORT", purpose: "experience support", active: true, organisationId: org.id },
        { fromTeamId: teamHvit.id, toTeamId: teamRod.id, role: "DEVELOPMENT", purpose: "development challenge", active: true, organisationId: org.id },
        { fromTeamId: teamHvit.id, toTeamId: teamBla.id, role: "DEVELOPMENT", purpose: "development challenge", active: true, organisationId: org.id },
      ],
    });

    // ============ Players ============
    // Plain i % teams.length would leave Fjordvik Blå with zero goalkeeper-position players
    // (Aksel Nord/Adrian Skog/Elias Novak all happen to land on Rød/Hvit under that modulo) --
    // spread the three GKs one per team explicitly so every team has real goalkeeper coverage,
    // and let every other player fall back to the plain round-robin.
    const GK_TEAM_OVERRIDE: Record<string, number> = { "Aksel Nord": 0, "Adrian Skog": 1, "Elias Novak": 2 };
    const players: Record<string, { id: string; team: (typeof teams)[number] }> = {};
    let playerCode = 1;
    for (let i = 0; i < PLAYER_POOL.length; i++) {
      const spec = PLAYER_POOL[i];
      const fullName = `${spec.firstName} ${spec.lastName}`;
      const teamIndex = GK_TEAM_OVERRIDE[fullName] ?? i % teams.length;
      const team = teams[teamIndex];
      const player = await db.player.create({
        data: {
          organisationId: org.id,
          playerCode: playerCode++,
          firstName: spec.firstName,
          lastName: spec.lastName,
          coreTeamId: team.id,
          primaryPosition: spec.position,
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: spec.position === "W" ? (i % 2 === 0 ? "LEFT" : "RIGHT") : "CENTER",
          goalkeeperAbility: spec.position === "GK" ? "YES" : "NO",
          effort: 7,
          decisionMaking: 6,
          teamplay: 7,
        },
      });
      players[`${spec.firstName} ${spec.lastName}`] = { id: player.id, team };
    }
    console.log(`Created ${Object.keys(players).length} players across ${teams.length} teams.`);

    const eliasStorm = players["Elias Storm"];
    const theoFalk = players["Theo Falk"];

    // ============ Opponent teams ============
    const opponentIds: Record<string, string> = {};
    for (const opp of OPPONENTS) {
      const created = await db.opponentTeam.create({ data: { displayName: opp.displayName, normalizedName: opp.normalizedName, organisationId: org.id } });
      opponentIds[opp.normalizedName] = created.id;
    }

    // ============ Season / league season ============
    const season = await db.season.create({ data: { name: "Fjordvik 2027", year: 2027, organisationId: org.id } });
    const leagueSeason = await db.leagueSeason.create({
      data: {
        name: "Fjordvik 2027 Spring",
        part: "SPRING",
        seasonId: season.id,
        organisationId: org.id,
        footballGroupId: group.id,
        startDate: REF.seasonStart,
        endDate: REF.seasonEnd,
      },
    });

    return { db, rawDb, org, group, teams, players, eliasStorm, theoFalk, opponentIds, leagueSeason, REF };
  } catch (err) {
    console.error("Seed failed during setup:", err);
    await rawDb.$disconnect();
    process.exit(1);
  }
}

main()
  .then(async (ctx) => {
    if (ctx) {
      const { seedScenarios } = await import("./seed-docs-scenarios");
      await seedScenarios(ctx);
      await ctx.rawDb.$disconnect();
      console.log("Fjordvik FK documentation dataset seeded successfully.");
    }
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
