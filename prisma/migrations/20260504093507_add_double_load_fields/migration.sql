/*
  Warnings:

  - You are about to drop the `PlayerFloatTeam` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TeamDevelopmentSource` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TeamSupportSource` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `canDropCoreMatch` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `isFloating` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `maxDevelopmentMatches` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `allowCoreMatchDrop` on the `RuleConfig` table. All the data in the column will be lost.
  - You are about to drop the column `blockCoreMatchIfFloatingWithinDays` on the `RuleConfig` table. All the data in the column will be lost.
  - You are about to drop the column `enforceCorePlayers` on the `RuleConfig` table. All the data in the column will be lost.
  - You are about to drop the column `maxCoreMatchDropsPerPlayer` on the `RuleConfig` table. All the data in the column will be lost.
  - You are about to drop the column `maxTotalFloatMatches` on the `RuleConfig` table. All the data in the column will be lost.
  - You are about to drop the column `preferLowRecentLoad` on the `RuleConfig` table. All the data in the column will be lost.
  - You are about to drop the column `preferLowerFloatCount` on the `RuleConfig` table. All the data in the column will be lost.
  - You are about to drop the column `preferPositionBalance` on the `RuleConfig` table. All the data in the column will be lost.
  - You are about to drop the column `preventConsecutiveFloat` on the `RuleConfig` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "PlayerFloatTeam_teamId_idx";

-- DropIndex
DROP INDEX "TeamDevelopmentSource_sourceTeamId_idx";

-- DropIndex
DROP INDEX "TeamSupportSource_sourceTeamId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PlayerFloatTeam";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TeamDevelopmentSource";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TeamSupportSource";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Warning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchRoundId" TEXT NOT NULL,
    "matchId" TEXT,
    "playerId" TEXT,
    "teamId" TEXT,
    "severity" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Warning_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchRoundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "lockType" TEXT NOT NULL,
    "reason" TEXT,
    "lockedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerLock_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerLock_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SelectionAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "selectionId" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "previousRole" TEXT,
    "previousStatus" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SelectionAudit_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "matchType" TEXT NOT NULL DEFAULT 'FRIENDLY',
    "gameFormat" TEXT NOT NULL DEFAULT 'ELEVEN_A_SIDE',
    "formation" TEXT,
    "matchFit" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("availableForDevelopmentSlot", "createdAt", "homeAway", "id", "matchFit", "matchRoundId", "matchType", "notes", "opponent", "squadSize", "startsAt", "teamId", "updatedAt") SELECT "availableForDevelopmentSlot", "createdAt", "homeAway", "id", "matchFit", "matchRoundId", coalesce("matchType", 'FRIENDLY') AS "matchType", "notes", "opponent", "squadSize", "startsAt", "teamId", "updatedAt" FROM "Match";
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
    "nonRotatable" BOOLEAN NOT NULL DEFAULT false,
    "reducedMatchLoadAllowed" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_Player" ("active", "ballControl", "bestSide", "concentration", "coreTeamId", "createdAt", "currentAvailability", "decisionMaking", "developmentInstruction", "developmentReadiness", "effort", "firstName", "firstTouch", "id", "lastName", "nonRotatable", "notes", "oneVOneAttacking", "oneVOneDefending", "passing", "playerCode", "positioning", "preferredFoot", "primaryPosition", "reducedMatchLoadAllowed", "removedAt", "secondaryFoot", "secondaryPosition", "speed", "strength", "supportInstruction", "supportNoShowCount", "supportSuitability", "teamplay", "tertiaryPosition", "updatedAt") SELECT "active", "ballControl", "bestSide", "concentration", "coreTeamId", "createdAt", "currentAvailability", "decisionMaking", "developmentInstruction", "developmentReadiness", "effort", "firstName", "firstTouch", "id", "lastName", "nonRotatable", "notes", "oneVOneAttacking", "oneVOneDefending", "passing", "playerCode", "positioning", "preferredFoot", "primaryPosition", "reducedMatchLoadAllowed", "removedAt", "secondaryFoot", "secondaryPosition", "speed", "strength", "supportInstruction", "supportNoShowCount", "supportSuitability", "teamplay", "tertiaryPosition", "updatedAt" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_playerCode_key" ON "Player"("playerCode");
CREATE INDEX "Player_coreTeamId_active_removedAt_idx" ON "Player"("coreTeamId", "active", "removedAt");
CREATE INDEX "Player_removedAt_firstName_lastName_idx" ON "Player"("removedAt", "firstName", "lastName");
CREATE TABLE "new_RotationPath" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromTeamId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "minimumCount" INTEGER,
    "targetCount" INTEGER,
    "maximumCount" INTEGER,
    "cooldownRounds" INTEGER,
    "priority" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "allowDoubleLoad" BOOLEAN NOT NULL DEFAULT false,
    "minRestSpacingHours" INTEGER,
    "maxDoubleLoadsPerPeriod" INTEGER,
    CONSTRAINT "RotationPath_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RotationPath_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RotationPath" ("active", "cooldownRounds", "fromTeamId", "id", "maximumCount", "minimumCount", "priority", "purpose", "role", "targetCount", "toTeamId") SELECT "active", "cooldownRounds", "fromTeamId", "id", "maximumCount", "minimumCount", "priority", "purpose", "role", "targetCount", "toTeamId" FROM "RotationPath";
DROP TABLE "RotationPath";
ALTER TABLE "new_RotationPath" RENAME TO "RotationPath";
CREATE TABLE "new_RuleConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Default ruleset',
    "minDaysBetweenAnyMatches" INTEGER NOT NULL DEFAULT 3,
    "warningThreshold" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RuleConfig" ("createdAt", "id", "minDaysBetweenAnyMatches", "name", "updatedAt", "version", "warningThreshold") SELECT "createdAt", "id", "minDaysBetweenAnyMatches", "name", "updatedAt", "version", "warningThreshold" FROM "RuleConfig";
DROP TABLE "RuleConfig";
ALTER TABLE "new_RuleConfig" RENAME TO "RuleConfig";
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
    "maxPlayerChangesPerRound" INTEGER NOT NULL DEFAULT 0,
    "supportPriority" INTEGER NOT NULL DEFAULT 0,
    "minSupportPlayers" INTEGER NOT NULL DEFAULT 0,
    "developmentSlots" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Team" ("archivedAt", "createdAt", "developmentSlots", "id", "maxSquadSize", "maxSupportCount", "minAcceptedSquadSize", "minCorePlayers", "minSupportCount", "minSupportPlayers", "name", "supportPriority", "targetSquadSize", "targetSupportCount", "updatedAt") SELECT "archivedAt", "createdAt", "developmentSlots", "id", "maxSquadSize", "maxSupportCount", "minAcceptedSquadSize", "minCorePlayers", "minSupportCount", "minSupportPlayers", "name", "supportPriority", "targetSquadSize", "targetSupportCount", "updatedAt" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");
CREATE INDEX "Team_archivedAt_name_idx" ON "Team"("archivedAt", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PlayerLock_matchRoundId_playerId_key" ON "PlayerLock"("matchRoundId", "playerId");

-- CreateIndex
CREATE INDEX "SelectionAudit_selectionId_idx" ON "SelectionAudit"("selectionId");
