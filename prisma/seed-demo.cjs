/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv/config");

const path = require("node:path");
const Database = require("better-sqlite3");

const demoTeams = [
  {
    codeBase: 910000,
    developmentSlots: 0,
    id: "demo-team-rod",
    minSupportPlayers: 3,
    name: "ROD",
    playerNames: [
      ["Aksel", "Storm"],
      ["Jonas", "Fjell"],
      ["Theo", "Eng"],
      ["Felix", "Dal"],
      ["Oskar", "Vale"],
      ["Mikkel", "Roen"],
      ["Sander", "Holm"],
      ["Emil", "Foss"],
      ["Noah", "Brekke"],
      ["Liam", "Moe"],
      ["Tobias", "Vik"],
      ["Isak", "Lie"],
    ],
  },
  {
    codeBase: 920000,
    developmentSlots: 1,
    id: "demo-team-hvit",
    minSupportPlayers: 1,
    name: "HVIT",
    playerNames: [
      ["Ulrik", "Berg"],
      ["Sebastian", "Aune"],
      ["Mathias", "Sveen"],
      ["Elias", "Tande"],
      ["Herman", "Lund"],
      ["Oliver", "Rinde"],
      ["Vetle", "Haga"],
      ["Magnus", "Lerum"],
      ["Even", "Bakke"],
      ["Kristian", "Dale"],
      ["Adrian", "Solem"],
      ["Henrik", "Kvam"],
    ],
  },
  {
    codeBase: 930000,
    developmentSlots: 1,
    id: "demo-team-bla",
    minSupportPlayers: 0,
    name: "BLA",
    playerNames: [
      ["Daniel", "Moen"],
      ["Leon", "Furu"],
      ["Mats", "Vollen"],
      ["Erik", "Ryen"],
      ["Sivert", "Nes"],
      ["Kasper", "Boe"],
      ["Martin", "Aas"],
      ["Alfred", "Holen"],
      ["Nikolai", "Sunde"],
      ["William", "Lande"],
      ["Benjamin", "Nord"],
      ["Filip", "Rostad"],
    ],
  },
];

const playerTemplates = [
  {
    active: true,
    allowedFloatTeamNames: [],
    ballControl: 6,
    bestSide: "CENTER",
    canDropCoreMatch: false,
    concentration: 7,
    currentAvailability: "AVAILABLE",
    decisionMaking: 7,
    effort: 8,
    firstTouch: 6,
    isFloating: false,
    notes: null,
    oneVOneAttacking: 3,
    oneVOneDefending: 4,
    passing: 6,
    positioning: 8,
    preferredFoot: "RIGHT",
    primaryPosition: "Keeper",
    secondaryFoot: "WEAK",
    secondaryPosition: "Centre back",
    speed: 5,
    strength: 6,
    teamplay: 7,
    tertiaryPosition: null,
  },
  {
    active: true,
    allowedFloatTeamNamesByTeam: {
      BLA: ["HVIT"],
      HVIT: ["ROD"],
      ROD: ["HVIT"],
    },
    ballControl: 6,
    bestSide: "RIGHT",
    canDropCoreMatch: false,
    concentration: 7,
    currentAvailability: "AVAILABLE",
    decisionMaking: 6,
    effort: 8,
    firstTouch: 5,
    isFloating: true,
    notesByTeam: {
      BLA: "Reliable defender who can support HVIT.",
      HVIT: "Reliable defender who can support ROD.",
      ROD: "Reliable defender who can support HVIT.",
    },
    oneVOneAttacking: 4,
    oneVOneDefending: 8,
    passing: 5,
    positioning: 7,
    preferredFoot: "RIGHT",
    primaryPosition: "Centre back",
    secondaryFoot: "LEFT",
    secondaryPosition: "Right back",
    speed: 6,
    strength: 7,
    teamplay: 6,
    tertiaryPosition: null,
  },
  {
    active: true,
    allowedFloatTeamNamesByTeam: {
      BLA: ["HVIT", "ROD"],
      HVIT: ["BLA", "ROD"],
      ROD: ["HVIT", "BLA"],
    },
    ballControl: 7,
    bestSide: "CENTER",
    canDropCoreMatch: false,
    concentration: 6,
    currentAvailability: "AVAILABLE",
    decisionMaking: 7,
    effort: 8,
    firstTouch: 7,
    isFloating: true,
    notes: "Flexible midfielder with explicit float permissions.",
    oneVOneAttacking: 6,
    oneVOneDefending: 6,
    passing: 8,
    positioning: 7,
    preferredFoot: "RIGHT",
    primaryPosition: "Central midfield",
    secondaryFoot: "LEFT",
    secondaryPosition: "Striker",
    speed: 7,
    strength: 5,
    teamplay: 8,
    tertiaryPosition: "Wing",
  },
  {
    active: true,
    allowedFloatTeamNames: [],
    ballControl: 7,
    bestSide: "LEFT",
    canDropCoreMatch: true,
    concentration: 5,
    currentAvailability: "AVAILABLE",
    decisionMaking: 6,
    effort: 7,
    firstTouch: 6,
    isFloating: false,
    notes: null,
    oneVOneAttacking: 8,
    oneVOneDefending: 3,
    passing: 5,
    positioning: 6,
    preferredFoot: "LEFT",
    primaryPosition: "Forward",
    secondaryFoot: "RIGHT",
    secondaryPosition: "Wing",
    speed: 8,
    strength: 6,
    teamplay: 6,
    tertiaryPosition: null,
  },
  {
    active: true,
    allowedFloatTeamNames: [],
    ballControl: 5,
    bestSide: "RIGHT",
    canDropCoreMatch: false,
    concentration: 6,
    currentAvailability: "AVAILABLE",
    decisionMaking: 5,
    effort: 7,
    firstTouch: 5,
    isFloating: false,
    notes: "Wide player used as a simple core depth option.",
    oneVOneAttacking: 6,
    oneVOneDefending: 4,
    passing: 5,
    positioning: 5,
    preferredFoot: "RIGHT",
    primaryPosition: "Wing",
    secondaryFoot: "WEAK",
    secondaryPosition: "Forward",
    speed: 7,
    strength: 5,
    teamplay: 5,
    tertiaryPosition: null,
  },
  {
    active: true,
    allowedFloatTeamNamesByTeam: {
      BLA: ["HVIT"],
      HVIT: ["ROD"],
      ROD: ["HVIT"],
    },
    ballControl: 6,
    bestSide: "LEFT",
    canDropCoreMatch: false,
    concentration: 6,
    currentAvailability: "AVAILABLE",
    decisionMaking: 6,
    effort: 8,
    firstTouch: 6,
    isFloating: true,
    notesByTeam: {
      BLA: "Left-sided support option for HVIT.",
      HVIT: "Left-sided support option for ROD.",
      ROD: "Left-sided support option for HVIT.",
    },
    oneVOneAttacking: 5,
    oneVOneDefending: 5,
    passing: 6,
    positioning: 6,
    preferredFoot: "LEFT",
    primaryPosition: "Left back",
    secondaryFoot: "WEAK",
    secondaryPosition: "Wing",
    speed: 7,
    strength: 6,
    teamplay: 7,
    tertiaryPosition: null,
  },
  {
    active: true,
    allowedFloatTeamNames: [],
    ballControl: 7,
    bestSide: "CENTER",
    canDropCoreMatch: false,
    concentration: 7,
    currentAvailability: "AVAILABLE",
    decisionMaking: 7,
    effort: 8,
    firstTouch: 7,
    isFloating: false,
    notes: null,
    oneVOneAttacking: 5,
    oneVOneDefending: 7,
    passing: 7,
    positioning: 7,
    preferredFoot: "RIGHT",
    primaryPosition: "Defensive midfield",
    secondaryFoot: "LEFT",
    secondaryPosition: "Centre back",
    speed: 6,
    strength: 7,
    teamplay: 8,
    tertiaryPosition: null,
  },
  {
    active: true,
    allowedFloatTeamNamesByTeam: {
      BLA: ["ROD"],
      HVIT: ["BLA"],
      ROD: ["BLA"],
    },
    ballControl: 6,
    bestSide: "RIGHT",
    canDropCoreMatch: false,
    concentration: 6,
    currentAvailability: "AVAILABLE",
    decisionMaking: 6,
    effort: 7,
    firstTouch: 6,
    isFloating: true,
    notesByTeam: {
      BLA: "Attacking support option for ROD.",
      HVIT: "Attacking support option for BLA.",
      ROD: "Attacking support option for BLA.",
    },
    oneVOneAttacking: 7,
    oneVOneDefending: 3,
    passing: 6,
    positioning: 5,
    preferredFoot: "RIGHT",
    primaryPosition: "Attacking midfield",
    secondaryFoot: "LEFT",
    secondaryPosition: "Wing",
    speed: 7,
    strength: 5,
    teamplay: 6,
    tertiaryPosition: "Forward",
  },
  {
    active: true,
    allowedFloatTeamNames: [],
    ballControl: 6,
    bestSide: "RIGHT",
    canDropCoreMatch: false,
    concentration: 6,
    currentAvailability: "AVAILABLE",
    decisionMaking: 6,
    effort: 7,
    firstTouch: 6,
    isFloating: false,
    notes: null,
    oneVOneAttacking: 5,
    oneVOneDefending: 7,
    passing: 6,
    positioning: 7,
    preferredFoot: "RIGHT",
    primaryPosition: "Right back",
    secondaryFoot: "WEAK",
    secondaryPosition: "Centre back",
    speed: 7,
    strength: 6,
    teamplay: 6,
    tertiaryPosition: null,
  },
  {
    active: true,
    allowedFloatTeamNamesByTeam: {
      BLA: ["HVIT", "ROD"],
      HVIT: ["BLA"],
      ROD: ["HVIT"],
    },
    ballControl: 7,
    bestSide: "LEFT",
    canDropCoreMatch: false,
    concentration: 6,
    currentAvailability: "AVAILABLE",
    decisionMaking: 6,
    effort: 8,
    firstTouch: 7,
    isFloating: true,
    notes: "Energetic winger who can cover more than one level.",
    oneVOneAttacking: 8,
    oneVOneDefending: 4,
    passing: 6,
    positioning: 5,
    preferredFoot: "LEFT",
    primaryPosition: "Wing",
    secondaryFoot: "RIGHT",
    secondaryPosition: "Forward",
    speed: 8,
    strength: 5,
    teamplay: 6,
    tertiaryPosition: null,
  },
  {
    active: true,
    allowedFloatTeamNames: [],
    ballControl: 6,
    bestSide: "CENTER",
    canDropCoreMatch: false,
    concentration: 7,
    currentAvailability: "AVAILABLE",
    decisionMaking: 7,
    effort: 8,
    firstTouch: 6,
    isFloating: false,
    notes: null,
    oneVOneAttacking: 6,
    oneVOneDefending: 5,
    passing: 7,
    positioning: 6,
    preferredFoot: "RIGHT",
    primaryPosition: "Striker",
    secondaryFoot: "LEFT",
    secondaryPosition: "Central midfield",
    speed: 7,
    strength: 6,
    teamplay: 7,
    tertiaryPosition: "Wing",
  },
  {
    active: false,
    allowedFloatTeamNames: [],
    ballControl: 5,
    bestSide: "CENTER",
    canDropCoreMatch: false,
    concentration: 5,
    currentAvailability: "INJURED",
    decisionMaking: 5,
    effort: 6,
    firstTouch: 5,
    isFloating: false,
    notes: "Inactive demo player for exclusion checks.",
    oneVOneAttacking: 5,
    oneVOneDefending: 4,
    passing: 5,
    positioning: 5,
    preferredFoot: "RIGHT",
    primaryPosition: "Centre back",
    secondaryFoot: "WEAK",
    secondaryPosition: "Defensive midfield",
    speed: 5,
    strength: 6,
    teamplay: 5,
    tertiaryPosition: null,
  },
];

const demoTeamIdByName = Object.fromEntries(demoTeams.map((team) => [team.name, team.id]));
const demoTeamNameBySeedId = Object.fromEntries(demoTeams.map((team) => [team.id, team.name]));

function resolveTemplateValue(value, teamName) {
  if (!value) {
    return [];
  }

  return value[teamName] ?? [];
}

const demoPlayers = demoTeams.flatMap((team) =>
  playerTemplates.map((template, index) => {
    const [firstName, lastName] = team.playerNames[index];

    return {
      ...template,
      allowedFloatTeamIds: resolveTemplateValue(
        template.allowedFloatTeamNamesByTeam ?? template.allowedFloatTeamNames,
        team.name,
      ).map((teamName) => demoTeamIdByName[teamName]),
      coreTeamId: team.id,
      id: `demo-p-${team.name.toLowerCase()}-${String(index + 1).padStart(2, "0")}`,
      lastName,
      notes: template.notesByTeam?.[team.name] ?? template.notes ?? null,
      playerCode: team.codeBase + index + 1,
      firstName,
    };
  }),
);

function toSqliteBoolean(value) {
  return value ? 1 : 0;
}

function resolveSqlitePath(connectionString) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing.");
  }

  if (!connectionString.startsWith("file:")) {
    throw new Error(`Expected a SQLite DATABASE_URL, got: ${connectionString}`);
  }

  const sqlitePath = connectionString.slice("file:".length);

  if (path.isAbsolute(sqlitePath)) {
    return sqlitePath;
  }

  return path.resolve(process.cwd(), "prisma", sqlitePath);
}

function main() {
  const sqlitePath = resolveSqlitePath(process.env.DATABASE_URL);
  const db = new Database(sqlitePath);

  const upsertTeam = db.prepare(`
    INSERT INTO "Team" (
      "id",
      "name",
      "minSupportPlayers",
      "developmentSlots",
      "updatedAt"
    ) VALUES (
      @id,
      @name,
      @minSupportPlayers,
      @developmentSlots,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT("name") DO UPDATE SET
      "minSupportPlayers" = excluded."minSupportPlayers",
      "developmentSlots" = excluded."developmentSlots",
      "archivedAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
  `);

  const upsertPlayer = db.prepare(`
    INSERT INTO "Player" (
      "id",
      "playerCode",
      "firstName",
      "lastName",
      "active",
      "removedAt",
      "coreTeamId",
      "isFloating",
      "canDropCoreMatch",
      "primaryPosition",
      "secondaryPosition",
      "tertiaryPosition",
      "preferredFoot",
      "secondaryFoot",
      "bestSide",
      "currentAvailability",
      "ballControl",
      "passing",
      "firstTouch",
      "oneVOneAttacking",
      "positioning",
      "oneVOneDefending",
      "decisionMaking",
      "effort",
      "teamplay",
      "concentration",
      "speed",
      "strength",
      "notes",
      "updatedAt"
    ) VALUES (
      @id,
      @playerCode,
      @firstName,
      @lastName,
      @active,
      NULL,
      @coreTeamId,
      @isFloating,
      @canDropCoreMatch,
      @primaryPosition,
      @secondaryPosition,
      @tertiaryPosition,
      @preferredFoot,
      @secondaryFoot,
      @bestSide,
      @currentAvailability,
      @ballControl,
      @passing,
      @firstTouch,
      @oneVOneAttacking,
      @positioning,
      @oneVOneDefending,
      @decisionMaking,
      @effort,
      @teamplay,
      @concentration,
      @speed,
      @strength,
      @notes,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT("id") DO UPDATE SET
      "playerCode" = excluded."playerCode",
      "firstName" = excluded."firstName",
      "lastName" = excluded."lastName",
      "active" = excluded."active",
      "removedAt" = NULL,
      "coreTeamId" = excluded."coreTeamId",
      "isFloating" = excluded."isFloating",
      "canDropCoreMatch" = excluded."canDropCoreMatch",
      "primaryPosition" = excluded."primaryPosition",
      "secondaryPosition" = excluded."secondaryPosition",
      "tertiaryPosition" = excluded."tertiaryPosition",
      "preferredFoot" = excluded."preferredFoot",
      "secondaryFoot" = excluded."secondaryFoot",
      "bestSide" = excluded."bestSide",
      "currentAvailability" = excluded."currentAvailability",
      "ballControl" = excluded."ballControl",
      "passing" = excluded."passing",
      "firstTouch" = excluded."firstTouch",
      "oneVOneAttacking" = excluded."oneVOneAttacking",
      "positioning" = excluded."positioning",
      "oneVOneDefending" = excluded."oneVOneDefending",
      "decisionMaking" = excluded."decisionMaking",
      "effort" = excluded."effort",
      "teamplay" = excluded."teamplay",
      "concentration" = excluded."concentration",
      "speed" = excluded."speed",
      "strength" = excluded."strength",
      "notes" = excluded."notes",
      "updatedAt" = CURRENT_TIMESTAMP
  `);

  const clearFloatTeamsForPlayer = db.prepare(`
    DELETE FROM "PlayerFloatTeam"
    WHERE "playerId" = ?
  `);

  const deleteExistingDemoFloatTeams = db.prepare(`
    DELETE FROM "PlayerFloatTeam"
    WHERE "playerId" LIKE 'demo-p-%'
       OR "teamId" LIKE 'demo-team-%'
  `);

  const deleteExistingDemoPlayers = db.prepare(`
    DELETE FROM "Player"
    WHERE "id" LIKE 'demo-p-%'
  `);

  const insertFloatTeam = db.prepare(`
    INSERT OR IGNORE INTO "PlayerFloatTeam" (
      "playerId",
      "teamId"
    ) VALUES (?, ?)
  `);

  const readResolvedDemoTeams = db.prepare(`
    SELECT "id", "name"
    FROM "Team"
    WHERE "name" IN ('ROD', 'HVIT', 'BLA')
  `);

  const transaction = db.transaction(() => {
    deleteExistingDemoFloatTeams.run();
    deleteExistingDemoPlayers.run();

    for (const team of demoTeams) {
      upsertTeam.run(team);
    }

    const resolvedTeamIdByName = Object.fromEntries(
      readResolvedDemoTeams.all().map((team) => [team.name, team.id]),
    );

    for (const player of demoPlayers) {
      const coreTeamName = demoTeamNameBySeedId[player.coreTeamId];
      const resolvedCoreTeamId = resolvedTeamIdByName[coreTeamName];
      const resolvedAllowedFloatTeamIds = player.allowedFloatTeamIds.map(
        (teamId) => resolvedTeamIdByName[demoTeamNameBySeedId[teamId]],
      );

      if (!resolvedCoreTeamId || resolvedAllowedFloatTeamIds.some((teamId) => !teamId)) {
        throw new Error("Could not resolve seeded demo teams.");
      }

      upsertPlayer.run({
        ...player,
        active: toSqliteBoolean(player.active),
        canDropCoreMatch: toSqliteBoolean(player.canDropCoreMatch),
        coreTeamId: resolvedCoreTeamId,
        isFloating: toSqliteBoolean(player.isFloating),
      });

      clearFloatTeamsForPlayer.run(player.id);

      for (const teamId of resolvedAllowedFloatTeamIds) {
        insertFloatTeam.run(player.id, teamId);
      }
    }
  });

  transaction();

  console.log(`Demo seed complete. Upserted ${demoTeams.length} teams and ${demoPlayers.length} players.`);
}

main();
