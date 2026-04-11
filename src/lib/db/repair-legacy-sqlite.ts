import fs from "node:fs";
import Database from "better-sqlite3";

const LEGACY_SCHEMA_REPAIR_SQL = `
BEGIN IMMEDIATE;

PRAGMA foreign_keys = OFF;

ALTER TABLE "Player" RENAME TO "legacy_Player";
ALTER TABLE "Match" RENAME TO "legacy_Match";
ALTER TABLE "MatchSelection" RENAME TO "legacy_MatchSelection";
ALTER TABLE "MatchSelectionPlayer" RENAME TO "legacy_MatchSelectionPlayer";
ALTER TABLE "RuleConfig" RENAME TO "legacy_RuleConfig";

DROP INDEX IF EXISTS "Player_playerCode_key";

DROP TABLE IF EXISTS "PlayerFloatTeam";
DROP TABLE IF EXISTS "Team";

CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "minSupportPlayers" INTEGER NOT NULL DEFAULT 0,
    "developmentSlots" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");
CREATE INDEX "Team_archivedAt_name_idx" ON "Team"("archivedAt", "name");

INSERT INTO "Team" ("id", "name", "minSupportPlayers", "developmentSlots", "archivedAt", "createdAt", "updatedAt")
SELECT DISTINCT
  'legacy-team:' || "teamName",
  "teamName",
  0,
  0,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT TRIM("coreTeam") AS "teamName" FROM "legacy_Player"
  UNION
  SELECT TRIM("targetTeam") AS "teamName" FROM "legacy_Match"
  UNION
  SELECT TRIM("sourceTeam") AS "teamName" FROM "legacy_MatchSelectionPlayer"
  UNION
  SELECT TRIM("targetTeam") AS "teamName" FROM "legacy_MatchSelectionPlayer"
)
WHERE "teamName" IS NOT NULL
  AND "teamName" <> '';

CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerCode" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "removedAt" DATETIME,
    "coreTeamId" TEXT NOT NULL,
    "isFloating" BOOLEAN NOT NULL DEFAULT false,
    "canDropCoreMatch" BOOLEAN NOT NULL DEFAULT false,
    "maxDevelopmentMatches" INTEGER,
    "primaryPosition" TEXT NOT NULL,
    "secondaryPosition" TEXT,
    "tertiaryPosition" TEXT,
    "preferredFoot" TEXT NOT NULL DEFAULT 'RIGHT',
    "secondaryFoot" TEXT NOT NULL DEFAULT 'WEAK',
    "bestSide" TEXT NOT NULL DEFAULT 'CENTER',
    "currentAvailability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "ballControl" INTEGER NOT NULL DEFAULT 0,
    "passing" INTEGER NOT NULL DEFAULT 0,
    "firstTouch" INTEGER NOT NULL DEFAULT 0,
    "oneVOneAttacking" INTEGER NOT NULL DEFAULT 0,
    "positioning" INTEGER NOT NULL DEFAULT 0,
    "oneVOneDefending" INTEGER NOT NULL DEFAULT 0,
    "decisionMaking" INTEGER NOT NULL DEFAULT 0,
    "effort" INTEGER NOT NULL DEFAULT 0,
    "teamplay" INTEGER NOT NULL DEFAULT 0,
    "concentration" INTEGER NOT NULL DEFAULT 0,
    "speed" INTEGER NOT NULL DEFAULT 0,
    "strength" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_coreTeamId_fkey" FOREIGN KEY ("coreTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Player_playerCode_key" ON "Player"("playerCode");
CREATE INDEX "Player_coreTeamId_active_removedAt_idx" ON "Player"("coreTeamId", "active", "removedAt");
CREATE INDEX "Player_removedAt_firstName_lastName_idx" ON "Player"("removedAt", "firstName", "lastName");

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
  "maxDevelopmentMatches",
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
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  CAST(1000 + ROW_NUMBER() OVER (ORDER BY COALESCE("createdAt", CURRENT_TIMESTAMP), "id") AS INTEGER),
  "firstName",
  "lastName",
  "active",
  NULL,
  'legacy-team:' || TRIM("coreTeam"),
  CASE WHEN "canFloatUp" = 1 OR "canFloatDown" = 1 THEN 1 ELSE 0 END,
  "canDropCoreMatch",
  NULL,
  TRIM(COALESCE(NULLIF("preferredPositions", ''), 'Unknown')),
  NULLIF(TRIM(COALESCE("secondaryPositions", '')), ''),
  NULL,
  'RIGHT',
  'WEAK',
  'CENTER',
  'AVAILABLE',
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  "notes",
  COALESCE("createdAt", CURRENT_TIMESTAMP),
  COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
FROM "legacy_Player";

CREATE TABLE "PlayerFloatTeam" (
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "PlayerFloatTeam_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerFloatTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    PRIMARY KEY ("playerId", "teamId")
);

CREATE INDEX "PlayerFloatTeam_teamId_idx" ON "PlayerFloatTeam"("teamId");

INSERT INTO "PlayerFloatTeam" ("playerId", "teamId")
SELECT DISTINCT "playerId", "teamId"
FROM (
  SELECT "legacy_Player"."id" AS "playerId", "Team"."id" AS "teamId"
  FROM "legacy_Player"
  JOIN "Team" ON "Team"."name" = 'BLA'
  WHERE "legacy_Player"."canFloatUp" = 1
    AND TRIM("legacy_Player"."coreTeam") = 'HVIT'

  UNION

  SELECT "legacy_Player"."id" AS "playerId", "Team"."id" AS "teamId"
  FROM "legacy_Player"
  JOIN "Team" ON "Team"."name" = 'HVIT'
  WHERE "legacy_Player"."canFloatDown" = 1
    AND TRIM("legacy_Player"."coreTeam") = 'BLA'

  UNION

  SELECT "legacy_Player"."id" AS "playerId", "Team"."id" AS "teamId"
  FROM "legacy_Player"
  JOIN "Team" ON "Team"."name" = 'HVIT'
  WHERE "legacy_Player"."canFloatUp" = 1
    AND TRIM("legacy_Player"."coreTeam") = 'ROD'

  UNION

  SELECT "legacy_Player"."id" AS "playerId", "Team"."id" AS "teamId"
  FROM "legacy_Player"
  JOIN "Team" ON "Team"."name" = 'ROD'
  WHERE "legacy_Player"."canFloatDown" = 1
    AND TRIM("legacy_Player"."coreTeam") = 'HVIT'
);

CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "targetTeamId" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "squadSize" INTEGER NOT NULL,
    "matchType" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Match_startsAt_createdAt_idx" ON "Match"("startsAt", "createdAt");
CREATE INDEX "Match_targetTeamId_startsAt_idx" ON "Match"("targetTeamId", "startsAt");

INSERT INTO "Match" (
  "id",
  "startsAt",
  "endsAt",
  "targetTeamId",
  "opponent",
  "squadSize",
  "matchType",
  "notes",
  "createdAt",
  "updatedAt"
)
SELECT
  "legacy_Match"."id",
  "legacy_Match"."matchDate",
  NULL,
  'legacy-team:' || TRIM("legacy_Match"."targetTeam"),
  COALESCE(NULLIF(TRIM(COALESCE("legacy_Match"."opponent", '')), ''), 'Unknown opponent'),
  "legacy_Match"."squadSize",
  "legacy_Match"."matchType",
  "legacy_Match"."notes",
  COALESCE("legacy_Match"."createdAt", CURRENT_TIMESTAMP),
  COALESCE("legacy_Match"."createdAt", CURRENT_TIMESTAMP)
FROM "legacy_Match";

CREATE TABLE "RuleConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Default ruleset',
    "enforceCorePlayers" BOOLEAN NOT NULL DEFAULT true,
    "allowCoreMatchDrop" BOOLEAN NOT NULL DEFAULT true,
    "maxCoreMatchDropsPerPlayer" INTEGER NOT NULL DEFAULT 1,
    "maxTotalFloatMatches" INTEGER NOT NULL DEFAULT 3,
    "preventConsecutiveFloat" BOOLEAN NOT NULL DEFAULT true,
    "minDaysBetweenAnyMatches" INTEGER NOT NULL DEFAULT 3,
    "blockCoreMatchIfFloatingWithinDays" INTEGER NOT NULL DEFAULT 2,
    "preferPositionBalance" BOOLEAN NOT NULL DEFAULT true,
    "preferLowRecentLoad" BOOLEAN NOT NULL DEFAULT true,
    "preferLowerFloatCount" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "RuleConfig" (
  "id",
  "name",
  "enforceCorePlayers",
  "allowCoreMatchDrop",
  "maxCoreMatchDropsPerPlayer",
  "maxTotalFloatMatches",
  "preventConsecutiveFloat",
  "minDaysBetweenAnyMatches",
  "blockCoreMatchIfFloatingWithinDays",
  "preferPositionBalance",
  "preferLowRecentLoad",
  "preferLowerFloatCount",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  'Migrated ruleset',
  "enforceCorePlayers",
  "allowDropCoreMatch",
  1,
  "maxTotalFloatMatches",
  "preventConsecutiveFloat",
  "minDaysBetweenAnyMatches",
  "blockCoreMatchIfFloatWithinDays",
  "preferPositionBalance",
  "preferLowRecentLoad",
  "preferLowerFloatCount",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "legacy_RuleConfig";

CREATE TABLE "MatchSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "overrideNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" DATETIME,
    CONSTRAINT "MatchSelection_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MatchSelection_matchId_createdAt_idx" ON "MatchSelection"("matchId", "createdAt");
CREATE INDEX "MatchSelection_status_finalizedAt_idx" ON "MatchSelection"("status", "finalizedAt");

INSERT INTO "MatchSelection" (
  "id",
  "matchId",
  "status",
  "overrideNotes",
  "createdAt",
  "finalizedAt"
)
SELECT
  "id",
  "matchId",
  "status",
  "overrideNotes",
  COALESCE("generatedAt", CURRENT_TIMESTAMP),
  "finalizedAt"
FROM "legacy_MatchSelection";

CREATE TABLE "MatchSelectionPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "selectionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roleType" TEXT NOT NULL,
    "sourceTeamNameSnapshot" TEXT NOT NULL,
    "targetTeamNameSnapshot" TEXT NOT NULL,
    "explanation" TEXT,
    "chosenPosition" TEXT,
    "wasAutoSelected" BOOLEAN NOT NULL DEFAULT false,
    "wasManuallyAdded" BOOLEAN NOT NULL DEFAULT false,
    "wasManuallyRemoved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchSelectionPlayer_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "MatchSelection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchSelectionPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "MatchSelectionPlayer_playerId_createdAt_idx" ON "MatchSelectionPlayer"("playerId", "createdAt");
CREATE INDEX "MatchSelectionPlayer_selectionId_wasManuallyRemoved_idx" ON "MatchSelectionPlayer"("selectionId", "wasManuallyRemoved");

INSERT INTO "MatchSelectionPlayer" (
  "id",
  "selectionId",
  "playerId",
  "roleType",
  "sourceTeamNameSnapshot",
  "targetTeamNameSnapshot",
  "explanation",
  "chosenPosition",
  "wasAutoSelected",
  "wasManuallyAdded",
  "wasManuallyRemoved",
  "createdAt"
)
SELECT
  "legacy_MatchSelectionPlayer"."id",
  "legacy_MatchSelectionPlayer"."selectionId",
  "legacy_MatchSelectionPlayer"."playerId",
  "legacy_MatchSelectionPlayer"."roleType",
  COALESCE(
    NULLIF(TRIM(COALESCE("legacy_MatchSelectionPlayer"."sourceTeam", '')), ''),
    TRIM("legacy_Player"."coreTeam"),
    'Unknown team'
  ),
  COALESCE(
    NULLIF(TRIM(COALESCE("legacy_MatchSelectionPlayer"."targetTeam", '')), ''),
    TRIM("legacy_Match"."targetTeam"),
    'Unknown team'
  ),
  "legacy_MatchSelectionPlayer"."explanation",
  NULL,
  COALESCE("legacy_MatchSelectionPlayer"."wasAutoSelected", 0),
  COALESCE("legacy_MatchSelectionPlayer"."wasManuallyAdded", 0),
  COALESCE("legacy_MatchSelectionPlayer"."wasManuallyRemoved", 0),
  COALESCE("legacy_MatchSelection"."generatedAt", CURRENT_TIMESTAMP)
FROM "legacy_MatchSelectionPlayer"
LEFT JOIN "legacy_Player" ON "legacy_Player"."id" = "legacy_MatchSelectionPlayer"."playerId"
LEFT JOIN "legacy_MatchSelection" ON "legacy_MatchSelection"."id" = "legacy_MatchSelectionPlayer"."selectionId"
LEFT JOIN "legacy_Match" ON "legacy_Match"."id" = "legacy_MatchSelection"."matchId";

DROP TABLE "legacy_MatchSelectionPlayer";
DROP TABLE "legacy_MatchSelection";
DROP TABLE "legacy_Match";
DROP TABLE "legacy_Player";
DROP TABLE "legacy_RuleConfig";

PRAGMA foreign_keys = ON;

COMMIT;
`;

function hasTable(database: Database.Database, tableName: string) {
  const row = database
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
      `,
    )
    .get(tableName);

  return Boolean(row);
}

function hasColumn(database: Database.Database, tableName: string, columnName: string) {
  const columns = database.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string }>;

  return columns.some((column) => column.name === columnName);
}

export function repairLegacySqliteDatabase(sqlitePath: string) {
  if (!sqlitePath || !fs.existsSync(sqlitePath)) {
    return;
  }

  const database = new Database(sqlitePath);

  try {
    if (!hasTable(database, "Match") || hasColumn(database, "Match", "startsAt")) {
      return;
    }

    const looksLikeLegacySchema =
      hasColumn(database, "Match", "matchDate") && hasColumn(database, "Player", "coreTeam");

    if (!looksLikeLegacySchema) {
      return;
    }

    database.exec(LEGACY_SCHEMA_REPAIR_SQL);
  } finally {
    database.close();
  }
}
