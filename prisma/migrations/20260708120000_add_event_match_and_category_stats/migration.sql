-- CreateEnum: MatchCategory
CREATE TYPE "MatchCategory" AS ENUM ('LEAGUE', 'CUP', 'OTHER');

-- AlterTable: Add category to existing Match (defaults to LEAGUE)
ALTER TABLE "Match" ADD COLUMN "category" "MatchCategory" NOT NULL DEFAULT 'LEAGUE';

-- CreateTable: EventMatch
CREATE TABLE "EventMatch" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventSquadId" TEXT NOT NULL,
    "category" "MatchCategory" NOT NULL DEFAULT 'CUP',
    "opponentName" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EventPostMatchReport
CREATE TABLE "EventPostMatchReport" (
    "id" TEXT NOT NULL,
    "eventMatchId" TEXT NOT NULL,
    "status" "MatchReportStatus" NOT NULL DEFAULT 'DRAFT',
    "ourScore" INTEGER,
    "opponentScore" INTEGER,
    "teamReflection" TEXT,
    "opponentObservation" TEXT,
    "notes" TEXT,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPostMatchReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EventPostMatchPlayer
CREATE TABLE "EventPostMatchPlayer" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "attendanceStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "minutesPlayed" INTEGER,
    "role" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPostMatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EventGoalEvent
CREATE TABLE "EventGoalEvent" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "playerId" TEXT,
    "minute" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'NORMAL',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGoalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EventAssistEvent
CREATE TABLE "EventAssistEvent" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAssistEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Match
CREATE INDEX "Match_category_idx" ON "Match"("category");

-- CreateIndex: EventMatch
CREATE INDEX "EventMatch_eventId_idx" ON "EventMatch"("eventId");
CREATE INDEX "EventMatch_eventSquadId_idx" ON "EventMatch"("eventSquadId");
CREATE INDEX "EventMatch_category_idx" ON "EventMatch"("category");
CREATE INDEX "EventMatch_startsAt_idx" ON "EventMatch"("startsAt");
CREATE INDEX "EventMatch_status_idx" ON "EventMatch"("status");

-- CreateIndex: EventPostMatchReport
CREATE UNIQUE INDEX "EventPostMatchReport_eventMatchId_key" ON "EventPostMatchReport"("eventMatchId");
CREATE INDEX "EventPostMatchReport_status_idx" ON "EventPostMatchReport"("status");

-- CreateIndex: EventPostMatchPlayer
CREATE UNIQUE INDEX "EventPostMatchPlayer_reportId_playerId_key" ON "EventPostMatchPlayer"("reportId", "playerId");
CREATE INDEX "EventPostMatchPlayer_playerId_idx" ON "EventPostMatchPlayer"("playerId");
CREATE INDEX "EventPostMatchPlayer_attendanceStatus_idx" ON "EventPostMatchPlayer"("attendanceStatus");

-- CreateIndex: EventGoalEvent
CREATE INDEX "EventGoalEvent_reportId_idx" ON "EventGoalEvent"("reportId");
CREATE INDEX "EventGoalEvent_playerId_idx" ON "EventGoalEvent"("playerId");

-- CreateIndex: EventAssistEvent
CREATE INDEX "EventAssistEvent_reportId_idx" ON "EventAssistEvent"("reportId");
CREATE INDEX "EventAssistEvent_playerId_idx" ON "EventAssistEvent"("playerId");

-- AddForeignKey: EventMatch
ALTER TABLE "EventMatch" ADD CONSTRAINT "EventMatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMatch" ADD CONSTRAINT "EventMatch_eventSquadId_fkey" FOREIGN KEY ("eventSquadId") REFERENCES "EventSquad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: EventPostMatchReport
ALTER TABLE "EventPostMatchReport" ADD CONSTRAINT "EventPostMatchReport_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: EventPostMatchPlayer
ALTER TABLE "EventPostMatchPlayer" ADD CONSTRAINT "EventPostMatchPlayer_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EventPostMatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventPostMatchPlayer" ADD CONSTRAINT "EventPostMatchPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: EventGoalEvent
ALTER TABLE "EventGoalEvent" ADD CONSTRAINT "EventGoalEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EventPostMatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventGoalEvent" ADD CONSTRAINT "EventGoalEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: EventAssistEvent
ALTER TABLE "EventAssistEvent" ADD CONSTRAINT "EventAssistEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EventPostMatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventAssistEvent" ADD CONSTRAINT "EventAssistEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;