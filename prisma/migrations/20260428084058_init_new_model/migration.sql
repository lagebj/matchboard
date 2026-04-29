/*
  Warnings:

  - You are about to drop the `MatchSelection` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MatchSelectionPlayer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlayerFloatTeam` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RuleConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `availableForDevelopmentSlot` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `endsAt` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `squadSize` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `targetTeamId` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `canDropCoreMatch` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `isFloating` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `maxDevelopmentMatches` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `developmentSlots` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `minSupportPlayers` on the `Team` table. All the data in the column will be lost.
  - Added the required column `homeAway` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `matchRoundId` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teamId` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "MatchSelection_status_finalizedAt_idx";

-- DropIndex
DROP INDEX "MatchSelection_matchId_createdAt_idx";

-- DropIndex
DROP INDEX "MatchSelectionPlayer_selectionId_wasManuallyRemoved_idx";

-- DropIndex
DROP INDEX "MatchSelectionPlayer_playerId_createdAt_idx";

-- DropIndex
DROP INDEX "PlayerFloatTeam_teamId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MatchSelection";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MatchSelectionPlayer";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PlayerFloatTeam";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "RuleConfig";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanningPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanningPeriod_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "planningPeriodId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MatchRound_planningPeriodId_fkey" FOREIGN KEY ("planningPeriodId") REFERENCES "PlanningPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "matchRoundId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Availability_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Availability_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Selection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "matchRoundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "explanation" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Selection_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Selection_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Selection_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RotationPath" (
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
    CONSTRAINT "RotationPath_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RotationPath_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "matchType" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("createdAt", "id", "matchType", "notes", "opponent", "startsAt", "updatedAt") SELECT "createdAt", "id", "matchType", "notes", "opponent", "startsAt", "updatedAt" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
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
    "supportSuitability" TEXT NOT NULL DEFAULT 'STRONG',
    "developmentReadiness" TEXT NOT NULL DEFAULT 'READY',
    "supportReliability" TEXT NOT NULL DEFAULT 'NORMAL',
    "primaryPosition" TEXT NOT NULL,
    "secondaryPosition" TEXT,
    "tertiaryPosition" TEXT,
    "preferredFoot" TEXT NOT NULL,
    "secondaryFoot" TEXT NOT NULL,
    "bestSide" TEXT NOT NULL,
    "currentAvailability" TEXT NOT NULL DEFAULT 'CONFIRMED',
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
INSERT INTO "new_Player" ("active", "ballControl", "bestSide", "concentration", "coreTeamId", "createdAt", "currentAvailability", "decisionMaking", "effort", "firstName", "firstTouch", "id", "lastName", "notes", "oneVOneAttacking", "oneVOneDefending", "passing", "playerCode", "positioning", "preferredFoot", "primaryPosition", "removedAt", "secondaryFoot", "secondaryPosition", "speed", "strength", "teamplay", "tertiaryPosition", "updatedAt") SELECT "active", "ballControl", "bestSide", "concentration", "coreTeamId", "createdAt", "currentAvailability", "decisionMaking", "effort", "firstName", "firstTouch", "id", "lastName", "notes", "oneVOneAttacking", "oneVOneDefending", "passing", "playerCode", "positioning", "preferredFoot", "primaryPosition", "removedAt", "secondaryFoot", "secondaryPosition", "speed", "strength", "teamplay", "tertiaryPosition", "updatedAt" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_playerCode_key" ON "Player"("playerCode");
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "targetSquadSize" INTEGER,
    "minimumAcceptedSquadSize" INTEGER,
    "maximumSquadSize" INTEGER,
    "minimumCorePlayers" INTEGER,
    "minimumSupportCount" INTEGER,
    "targetSupportCount" INTEGER,
    "maximumSupportCount" INTEGER,
    "supportPriority" INTEGER,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Team" ("archivedAt", "createdAt", "id", "name", "updatedAt") SELECT "archivedAt", "createdAt", "id", "name", "updatedAt" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Availability_playerId_matchRoundId_key" ON "Availability"("playerId", "matchRoundId");

-- CreateIndex
CREATE UNIQUE INDEX "RotationPath_fromTeamId_toTeamId_role_key" ON "RotationPath"("fromTeamId", "toTeamId", "role");
