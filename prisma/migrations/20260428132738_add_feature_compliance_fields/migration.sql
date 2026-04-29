/*
  Warnings:

  - You are about to drop the column `supportReliability` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `maximumSquadSize` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `maximumSupportCount` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `minimumAcceptedSquadSize` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `minimumCorePlayers` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `minimumSupportCount` on the `Team` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Availability_playerId_matchRoundId_key";

-- DropIndex
DROP INDEX "RotationPath_fromTeamId_toTeamId_role_key";

-- AlterTable
ALTER TABLE "Selection" ADD COLUMN "overrideReason" TEXT;
ALTER TABLE "Selection" ADD COLUMN "ruleConfigVersion" INTEGER;

-- CreateTable
CREATE TABLE "PlayerFloatTeam" (
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    PRIMARY KEY ("playerId", "teamId"),
    CONSTRAINT "PlayerFloatTeam_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerFloatTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamSupportSource" (
    "targetTeamId" TEXT NOT NULL,
    "sourceTeamId" TEXT NOT NULL,

    PRIMARY KEY ("targetTeamId", "sourceTeamId"),
    CONSTRAINT "TeamSupportSource_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamSupportSource_sourceTeamId_fkey" FOREIGN KEY ("sourceTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamDevelopmentSource" (
    "targetTeamId" TEXT NOT NULL,
    "sourceTeamId" TEXT NOT NULL,

    PRIMARY KEY ("targetTeamId", "sourceTeamId"),
    CONSTRAINT "TeamDevelopmentSource_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamDevelopmentSource_sourceTeamId_fkey" FOREIGN KEY ("sourceTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL DEFAULT 1,
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
    "warningThreshold" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MovementLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchRoundId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "reason" TEXT,
    "explanation" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MovementLedger_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MovementLedger_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MovementLedger_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovementLedger_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovementLedger_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchRoundId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "homeAway" TEXT NOT NULL,
    "squadSize" INTEGER NOT NULL DEFAULT 11,
    "availableForDevelopmentSlot" BOOLEAN NOT NULL DEFAULT false,
    "matchType" TEXT,
    "matchFit" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("createdAt", "homeAway", "id", "matchRoundId", "matchType", "notes", "opponent", "startsAt", "teamId", "updatedAt") SELECT "createdAt", "homeAway", "id", "matchRoundId", "matchType", "notes", "opponent", "startsAt", "teamId", "updatedAt" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE INDEX "Match_startsAt_createdAt_idx" ON "Match"("startsAt", "createdAt");
CREATE TABLE "new_Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerCode" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "removedAt" DATETIME,
    "coreTeamId" TEXT NOT NULL,
    "isFloating" BOOLEAN NOT NULL DEFAULT false,
    "nonRotatable" BOOLEAN NOT NULL DEFAULT false,
    "canDropCoreMatch" BOOLEAN NOT NULL DEFAULT false,
    "reducedMatchLoadAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maxDevelopmentMatches" INTEGER,
    "supportSuitability" TEXT NOT NULL DEFAULT 'neutral',
    "developmentReadiness" TEXT NOT NULL DEFAULT 'neutral',
    "primaryPosition" TEXT NOT NULL,
    "secondaryPosition" TEXT,
    "tertiaryPosition" TEXT,
    "preferredFoot" TEXT NOT NULL,
    "secondaryFoot" TEXT NOT NULL,
    "bestSide" TEXT NOT NULL,
    "currentAvailability" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "supportNoShowCount" INTEGER NOT NULL DEFAULT 0,
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
    "supportInstruction" TEXT,
    "developmentInstruction" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_coreTeamId_fkey" FOREIGN KEY ("coreTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("active", "ballControl", "bestSide", "concentration", "coreTeamId", "createdAt", "currentAvailability", "decisionMaking", "developmentReadiness", "effort", "firstName", "firstTouch", "id", "lastName", "nonRotatable", "notes", "oneVOneAttacking", "oneVOneDefending", "passing", "playerCode", "positioning", "preferredFoot", "primaryPosition", "reducedMatchLoadAllowed", "removedAt", "secondaryFoot", "secondaryPosition", "speed", "strength", "supportSuitability", "teamplay", "tertiaryPosition", "updatedAt") SELECT "active", "ballControl", "bestSide", "concentration", "coreTeamId", "createdAt", "currentAvailability", "decisionMaking", "developmentReadiness", "effort", "firstName", "firstTouch", "id", "lastName", "nonRotatable", "notes", "oneVOneAttacking", "oneVOneDefending", "passing", "playerCode", "positioning", "preferredFoot", "primaryPosition", "reducedMatchLoadAllowed", "removedAt", "secondaryFoot", "secondaryPosition", "speed", "strength", "supportSuitability", "teamplay", "tertiaryPosition", "updatedAt" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_playerCode_key" ON "Player"("playerCode");
CREATE INDEX "Player_coreTeamId_active_removedAt_idx" ON "Player"("coreTeamId", "active", "removedAt");
CREATE INDEX "Player_removedAt_firstName_lastName_idx" ON "Player"("removedAt", "firstName", "lastName");
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "targetSquadSize" INTEGER NOT NULL DEFAULT 11,
    "minAcceptedSquadSize" INTEGER NOT NULL DEFAULT 9,
    "maxSquadSize" INTEGER NOT NULL DEFAULT 14,
    "minCorePlayers" INTEGER NOT NULL DEFAULT 8,
    "minSupportCount" INTEGER NOT NULL DEFAULT 0,
    "targetSupportCount" INTEGER NOT NULL DEFAULT 0,
    "maxSupportCount" INTEGER NOT NULL DEFAULT 0,
    "supportPriority" INTEGER NOT NULL DEFAULT 0,
    "minSupportPlayers" INTEGER NOT NULL DEFAULT 0,
    "developmentSlots" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Team" ("archivedAt", "createdAt", "id", "name", "supportPriority", "targetSquadSize", "targetSupportCount", "updatedAt") SELECT "archivedAt", "createdAt", "id", "name", coalesce("supportPriority", 0) AS "supportPriority", coalesce("targetSquadSize", 11) AS "targetSquadSize", coalesce("targetSupportCount", 0) AS "targetSupportCount", "updatedAt" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");
CREATE INDEX "Team_archivedAt_name_idx" ON "Team"("archivedAt", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PlayerFloatTeam_teamId_idx" ON "PlayerFloatTeam"("teamId");

-- CreateIndex
CREATE INDEX "TeamSupportSource_sourceTeamId_idx" ON "TeamSupportSource"("sourceTeamId");

-- CreateIndex
CREATE INDEX "TeamDevelopmentSource_sourceTeamId_idx" ON "TeamDevelopmentSource"("sourceTeamId");

-- CreateIndex
CREATE INDEX "MovementLedger_matchRoundId_matchId_idx" ON "MovementLedger"("matchRoundId", "matchId");

-- CreateIndex
CREATE INDEX "MovementLedger_playerId_idx" ON "MovementLedger"("playerId");
