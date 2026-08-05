-- CreateTable: EventLiveMatchSession
CREATE TABLE "EventLiveMatchSession" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "eventMatchId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventLiveMatchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EventLiveMatchEvent
CREATE TABLE "EventLiveMatchEvent" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "eventMatchId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" "LiveMatchEventType" NOT NULL,
    "period" "MatchPeriod",
    "matchSeconds" INTEGER,
    "wallClockTime" TIMESTAMP(3),
    "playerId" TEXT,
    "secondaryPlayerId" TEXT,
    "payload" JSONB,
    "correctionType" "LiveEventCorrectionType",
    "correctsEventId" TEXT,
    "clientEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLiveMatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: EventLiveMatchSession
CREATE UNIQUE INDEX "EventLiveMatchSession_eventMatchId_key" ON "EventLiveMatchSession"("eventMatchId");
CREATE INDEX "EventLiveMatchSession_organisationId_idx" ON "EventLiveMatchSession"("organisationId");
CREATE INDEX "EventLiveMatchSession_coachId_idx" ON "EventLiveMatchSession"("coachId");
CREATE INDEX "EventLiveMatchSession_status_idx" ON "EventLiveMatchSession"("status");

-- CreateIndex: EventLiveMatchEvent
CREATE UNIQUE INDEX "EventLiveMatchEvent_clientEventId_key" ON "EventLiveMatchEvent"("clientEventId");
CREATE INDEX "EventLiveMatchEvent_eventMatchId_createdAt_idx" ON "EventLiveMatchEvent"("eventMatchId", "createdAt");
CREATE INDEX "EventLiveMatchEvent_eventMatchId_period_idx" ON "EventLiveMatchEvent"("eventMatchId", "period");
CREATE INDEX "EventLiveMatchEvent_sessionId_idx" ON "EventLiveMatchEvent"("sessionId");
CREATE INDEX "EventLiveMatchEvent_playerId_idx" ON "EventLiveMatchEvent"("playerId");
CREATE INDEX "EventLiveMatchEvent_organisationId_idx" ON "EventLiveMatchEvent"("organisationId");

-- AddForeignKeys: EventLiveMatchSession
ALTER TABLE "EventLiveMatchSession" ADD CONSTRAINT "EventLiveMatchSession_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventLiveMatchSession" ADD CONSTRAINT "EventLiveMatchSession_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKeys: EventLiveMatchEvent
ALTER TABLE "EventLiveMatchEvent" ADD CONSTRAINT "EventLiveMatchEvent_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventLiveMatchEvent" ADD CONSTRAINT "EventLiveMatchEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EventLiveMatchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventLiveMatchEvent" ADD CONSTRAINT "EventLiveMatchEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventLiveMatchEvent" ADD CONSTRAINT "EventLiveMatchEvent_secondaryPlayerId_fkey" FOREIGN KEY ("secondaryPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventLiveMatchEvent" ADD CONSTRAINT "EventLiveMatchEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;