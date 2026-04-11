-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "coreTeam" TEXT NOT NULL,
    "canFloatUp" BOOLEAN NOT NULL DEFAULT false,
    "canFloatDown" BOOLEAN NOT NULL DEFAULT false,
    "canDropCoreMatch" BOOLEAN NOT NULL DEFAULT false,
    "preferredPositions" TEXT NOT NULL,
    "secondaryPositions" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchDate" DATETIME NOT NULL,
    "targetTeam" TEXT NOT NULL,
    "opponent" TEXT,
    "squadSize" INTEGER NOT NULL DEFAULT 9,
    "matchType" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MatchSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" DATETIME,
    "overrideNotes" TEXT,
    CONSTRAINT "MatchSelection_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchSelectionPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "selectionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roleType" TEXT NOT NULL,
    "sourceTeam" TEXT,
    "targetTeam" TEXT,
    "explanation" TEXT,
    "wasAutoSelected" BOOLEAN NOT NULL DEFAULT true,
    "wasManuallyAdded" BOOLEAN NOT NULL DEFAULT false,
    "wasManuallyRemoved" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MatchSelectionPlayer_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "MatchSelection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchSelectionPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enforceCorePlayers" BOOLEAN NOT NULL DEFAULT true,
    "allowDropCoreMatch" BOOLEAN NOT NULL DEFAULT true,
    "maxTotalFloatMatches" INTEGER NOT NULL DEFAULT 3,
    "preventConsecutiveFloat" BOOLEAN NOT NULL DEFAULT true,
    "minDaysBetweenAnyMatches" INTEGER NOT NULL DEFAULT 3,
    "blockCoreMatchIfFloatWithinDays" INTEGER NOT NULL DEFAULT 2,
    "rodRequiresSupportFromHvit" BOOLEAN NOT NULL DEFAULT true,
    "rodSupportMin" INTEGER NOT NULL DEFAULT 3,
    "rodSupportMax" INTEGER NOT NULL DEFAULT 4,
    "preferPositionBalance" BOOLEAN NOT NULL DEFAULT true,
    "preferLowRecentLoad" BOOLEAN NOT NULL DEFAULT true,
    "preferLowerFloatCount" BOOLEAN NOT NULL DEFAULT true
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_playerCode_key" ON "Player"("playerCode");
