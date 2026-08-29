-- ADR-0106: GuestPlayer identity and a shared Match participant model.
--
-- This migration is additive only: every new column is nullable, every relaxed column widens
-- from required to nullable, and four new tables are introduced. No existing data is rewritten.
-- Per ADR-0105, this ships with zero application code reading/writing any new column yet.
--
-- Hand-curated (not a raw `prisma migrate diff` output): a diff against this repo's actual
-- migration history also surfaces pre-existing, unrelated schema drift (an enum rename, three
-- foreign keys, several `organisationId` indexes declared in schema.prisma but never actually
-- created by a migration, and a handful of Postgres-identifier-length index renames) that
-- predates this change and is out of scope here — see ARR-0036. Only GuestPlayer-related
-- statements are included below.

-- AlterTable: widen playerId to nullable and add guestPlayerId where a fact must belong to
-- exactly one identity (Player or GuestPlayer).
ALTER TABLE "ActualPositionInterval" ADD COLUMN "guestPlayerId" TEXT, ALTER COLUMN "playerId" DROP NOT NULL;
ALTER TABLE "Assist" ADD COLUMN "guestPlayerId" TEXT, ALTER COLUMN "playerId" DROP NOT NULL;
ALTER TABLE "EventAssistEvent" ADD COLUMN "guestPlayerId" TEXT, ALTER COLUMN "playerId" DROP NOT NULL;
ALTER TABLE "EventMatchSupportAssignment" ADD COLUMN "guestPlayerId" TEXT, ALTER COLUMN "playerId" DROP NOT NULL;
ALTER TABLE "EventPlayerAvailability" ADD COLUMN "guestPlayerId" TEXT, ALTER COLUMN "playerId" DROP NOT NULL;
ALTER TABLE "EventPostMatchPlayer" ADD COLUMN "guestPlayerId" TEXT, ALTER COLUMN "playerId" DROP NOT NULL;
ALTER TABLE "EventSquadPlayer" ADD COLUMN "guestPlayerId" TEXT, ALTER COLUMN "playerId" DROP NOT NULL;
ALTER TABLE "PostMatchPlayerActual" ADD COLUMN "guestPlayerId" TEXT, ALTER COLUMN "playerId" DROP NOT NULL;
ALTER TABLE "MatchRotation" ADD COLUMN "outGuestPlayerId" TEXT, ADD COLUMN "inGuestPlayerId" TEXT,
  ALTER COLUMN "outPlayerId" DROP NOT NULL, ALTER COLUMN "inPlayerId" DROP NOT NULL;

-- AlterTable: playerId was already nullable (empty slot / unattributed) — add guestPlayerId only.
ALTER TABLE "EventGoalEvent" ADD COLUMN "guestPlayerId" TEXT;
ALTER TABLE "EventMatchLineupAssignment" ADD COLUMN "guestPlayerId" TEXT;
ALTER TABLE "Goal" ADD COLUMN "guestPlayerId" TEXT;
ALTER TABLE "LiveMatchEvent" ADD COLUMN "guestPlayerId" TEXT, ADD COLUMN "secondaryGuestPlayerId" TEXT;
ALTER TABLE "MatchLineupAssignment" ADD COLUMN "guestPlayerId" TEXT;

-- CreateTable
CREATE TABLE "GuestPlayer" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "footballGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMatchAvailability" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "eventMatchId" TEXT NOT NULL,
    "playerId" TEXT,
    "guestPlayerId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMatchAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueRoundParticipant" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "matchRoundId" TEXT NOT NULL,
    "playerId" TEXT,
    "guestPlayerId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueRoundParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMatchGuestAssignment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "matchRoundId" TEXT NOT NULL,
    "guestPlayerId" TEXT NOT NULL,
    "note" TEXT,
    "addedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueMatchGuestAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestPlayer_footballGroupId_active_idx" ON "GuestPlayer"("footballGroupId", "active");
CREATE INDEX "GuestPlayer_organisationId_idx" ON "GuestPlayer"("organisationId");

CREATE INDEX "EventMatchAvailability_eventMatchId_idx" ON "EventMatchAvailability"("eventMatchId");
CREATE INDEX "EventMatchAvailability_organisationId_idx" ON "EventMatchAvailability"("organisationId");
CREATE UNIQUE INDEX "EventMatchAvailability_eventMatchId_playerId_key" ON "EventMatchAvailability"("eventMatchId", "playerId");
CREATE UNIQUE INDEX "EventMatchAvailability_eventMatchId_guestPlayerId_key" ON "EventMatchAvailability"("eventMatchId", "guestPlayerId");

CREATE INDEX "LeagueRoundParticipant_matchRoundId_idx" ON "LeagueRoundParticipant"("matchRoundId");
CREATE INDEX "LeagueRoundParticipant_organisationId_idx" ON "LeagueRoundParticipant"("organisationId");
CREATE UNIQUE INDEX "LeagueRoundParticipant_matchRoundId_playerId_key" ON "LeagueRoundParticipant"("matchRoundId", "playerId");
CREATE UNIQUE INDEX "LeagueRoundParticipant_matchRoundId_guestPlayerId_key" ON "LeagueRoundParticipant"("matchRoundId", "guestPlayerId");

CREATE INDEX "LeagueMatchGuestAssignment_matchId_idx" ON "LeagueMatchGuestAssignment"("matchId");
CREATE INDEX "LeagueMatchGuestAssignment_guestPlayerId_idx" ON "LeagueMatchGuestAssignment"("guestPlayerId");
CREATE INDEX "LeagueMatchGuestAssignment_matchRoundId_idx" ON "LeagueMatchGuestAssignment"("matchRoundId");
CREATE INDEX "LeagueMatchGuestAssignment_organisationId_idx" ON "LeagueMatchGuestAssignment"("organisationId");
CREATE UNIQUE INDEX "LeagueMatchGuestAssignment_matchId_guestPlayerId_key" ON "LeagueMatchGuestAssignment"("matchId", "guestPlayerId");

CREATE INDEX "ActualPositionInterval_guestPlayerId_idx" ON "ActualPositionInterval"("guestPlayerId");
CREATE INDEX "Assist_guestPlayerId_idx" ON "Assist"("guestPlayerId");
CREATE INDEX "EventAssistEvent_guestPlayerId_idx" ON "EventAssistEvent"("guestPlayerId");
CREATE INDEX "EventGoalEvent_guestPlayerId_idx" ON "EventGoalEvent"("guestPlayerId");
CREATE INDEX "EventMatchLineupAssignment_guestPlayerId_idx" ON "EventMatchLineupAssignment"("guestPlayerId");
CREATE UNIQUE INDEX "EventMatchLineupAssignment_lineupId_guestPlayerId_key" ON "EventMatchLineupAssignment"("lineupId", "guestPlayerId");
CREATE INDEX "EventMatchSupportAssignment_guestPlayerId_idx" ON "EventMatchSupportAssignment"("guestPlayerId");
CREATE UNIQUE INDEX "EventMatchSupportAssignment_eventMatchId_guestPlayerId_key" ON "EventMatchSupportAssignment"("eventMatchId", "guestPlayerId");
CREATE INDEX "EventPlayerAvailability_guestPlayerId_idx" ON "EventPlayerAvailability"("guestPlayerId");
CREATE UNIQUE INDEX "EventPlayerAvailability_eventId_guestPlayerId_key" ON "EventPlayerAvailability"("eventId", "guestPlayerId");
CREATE INDEX "EventPostMatchPlayer_guestPlayerId_idx" ON "EventPostMatchPlayer"("guestPlayerId");
CREATE UNIQUE INDEX "EventPostMatchPlayer_reportId_guestPlayerId_key" ON "EventPostMatchPlayer"("reportId", "guestPlayerId");
CREATE INDEX "EventSquadPlayer_guestPlayerId_idx" ON "EventSquadPlayer"("guestPlayerId");
CREATE UNIQUE INDEX "EventSquadPlayer_eventId_guestPlayerId_key" ON "EventSquadPlayer"("eventId", "guestPlayerId");
CREATE UNIQUE INDEX "EventSquadPlayer_eventSquadId_guestPlayerId_key" ON "EventSquadPlayer"("eventSquadId", "guestPlayerId");
CREATE INDEX "Goal_guestPlayerId_idx" ON "Goal"("guestPlayerId");
CREATE INDEX "LiveMatchEvent_guestPlayerId_idx" ON "LiveMatchEvent"("guestPlayerId");
CREATE INDEX "MatchLineupAssignment_guestPlayerId_idx" ON "MatchLineupAssignment"("guestPlayerId");
CREATE UNIQUE INDEX "MatchLineupAssignment_matchLineupId_guestPlayerId_key" ON "MatchLineupAssignment"("matchLineupId", "guestPlayerId");
CREATE INDEX "MatchRotation_outGuestPlayerId_idx" ON "MatchRotation"("outGuestPlayerId");
CREATE INDEX "MatchRotation_inGuestPlayerId_idx" ON "MatchRotation"("inGuestPlayerId");
CREATE INDEX "PostMatchPlayerActual_guestPlayerId_idx" ON "PostMatchPlayerActual"("guestPlayerId");

-- AddForeignKey
ALTER TABLE "GuestPlayer" ADD CONSTRAINT "GuestPlayer_footballGroupId_fkey" FOREIGN KEY ("footballGroupId") REFERENCES "FootballGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuestPlayer" ADD CONSTRAINT "GuestPlayer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventMatchAvailability" ADD CONSTRAINT "EventMatchAvailability_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMatchAvailability" ADD CONSTRAINT "EventMatchAvailability_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMatchAvailability" ADD CONSTRAINT "EventMatchAvailability_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventMatchAvailability" ADD CONSTRAINT "EventMatchAvailability_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeagueRoundParticipant" ADD CONSTRAINT "LeagueRoundParticipant_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueRoundParticipant" ADD CONSTRAINT "LeagueRoundParticipant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeagueRoundParticipant" ADD CONSTRAINT "LeagueRoundParticipant_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeagueRoundParticipant" ADD CONSTRAINT "LeagueRoundParticipant_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeagueMatchGuestAssignment" ADD CONSTRAINT "LeagueMatchGuestAssignment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueMatchGuestAssignment" ADD CONSTRAINT "LeagueMatchGuestAssignment_matchRoundId_fkey" FOREIGN KEY ("matchRoundId") REFERENCES "MatchRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeagueMatchGuestAssignment" ADD CONSTRAINT "LeagueMatchGuestAssignment_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeagueMatchGuestAssignment" ADD CONSTRAINT "LeagueMatchGuestAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActualPositionInterval" ADD CONSTRAINT "ActualPositionInterval_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assist" ADD CONSTRAINT "Assist_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventAssistEvent" ADD CONSTRAINT "EventAssistEvent_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventGoalEvent" ADD CONSTRAINT "EventGoalEvent_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventMatchLineupAssignment" ADD CONSTRAINT "EventMatchLineupAssignment_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventMatchSupportAssignment" ADD CONSTRAINT "EventMatchSupportAssignment_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventPlayerAvailability" ADD CONSTRAINT "EventPlayerAvailability_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventPostMatchPlayer" ADD CONSTRAINT "EventPostMatchPlayer_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventSquadPlayer" ADD CONSTRAINT "EventSquadPlayer_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiveMatchEvent" ADD CONSTRAINT "LiveMatchEvent_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiveMatchEvent" ADD CONSTRAINT "LiveMatchEvent_secondaryGuestPlayerId_fkey" FOREIGN KEY ("secondaryGuestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchRotation" ADD CONSTRAINT "MatchRotation_outGuestPlayerId_fkey" FOREIGN KEY ("outGuestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchRotation" ADD CONSTRAINT "MatchRotation_inGuestPlayerId_fkey" FOREIGN KEY ("inGuestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostMatchPlayerActual" ADD CONSTRAINT "PostMatchPlayerActual_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "GuestPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints (ADR-0106 §1.2) — Prisma cannot express these declaratively, hand-added
-- here following the existing ActualPositionInterval matchId/eventMatchId precedent.
--
-- Exactly-one: the fact must belong to someone (a real Player or a GuestPlayer).
ALTER TABLE "ActualPositionInterval" ADD CONSTRAINT "ActualPositionInterval_exactly_one_participant" CHECK (("playerId" IS NOT NULL) != ("guestPlayerId" IS NOT NULL));
ALTER TABLE "EventMatchAvailability" ADD CONSTRAINT "EventMatchAvailability_exactly_one_participant" CHECK (("playerId" IS NOT NULL) != ("guestPlayerId" IS NOT NULL));
ALTER TABLE "EventMatchSupportAssignment" ADD CONSTRAINT "EventMatchSupportAssignment_exactly_one_participant" CHECK (("playerId" IS NOT NULL) != ("guestPlayerId" IS NOT NULL));
ALTER TABLE "EventPlayerAvailability" ADD CONSTRAINT "EventPlayerAvailability_exactly_one_participant" CHECK (("playerId" IS NOT NULL) != ("guestPlayerId" IS NOT NULL));
ALTER TABLE "EventPostMatchPlayer" ADD CONSTRAINT "EventPostMatchPlayer_exactly_one_participant" CHECK (("playerId" IS NOT NULL) != ("guestPlayerId" IS NOT NULL));
ALTER TABLE "EventSquadPlayer" ADD CONSTRAINT "EventSquadPlayer_exactly_one_participant" CHECK (("playerId" IS NOT NULL) != ("guestPlayerId" IS NOT NULL));
ALTER TABLE "LeagueRoundParticipant" ADD CONSTRAINT "LeagueRoundParticipant_exactly_one_participant" CHECK (("playerId" IS NOT NULL) != ("guestPlayerId" IS NOT NULL));
ALTER TABLE "PostMatchPlayerActual" ADD CONSTRAINT "PostMatchPlayerActual_exactly_one_participant" CHECK (("playerId" IS NOT NULL) != ("guestPlayerId" IS NOT NULL));
ALTER TABLE "MatchRotation" ADD CONSTRAINT "MatchRotation_exactly_one_out_participant" CHECK (("outPlayerId" IS NOT NULL) != ("outGuestPlayerId" IS NOT NULL));
ALTER TABLE "MatchRotation" ADD CONSTRAINT "MatchRotation_exactly_one_in_participant" CHECK (("inPlayerId" IS NOT NULL) != ("inGuestPlayerId" IS NOT NULL));

-- At-most-one: zero is legal (an empty lineup slot, an unattributed goal, a loose live-event
-- reference with no scorer set at all).
ALTER TABLE "Assist" ADD CONSTRAINT "Assist_at_most_one_participant" CHECK (NOT ("playerId" IS NOT NULL AND "guestPlayerId" IS NOT NULL));
ALTER TABLE "EventAssistEvent" ADD CONSTRAINT "EventAssistEvent_at_most_one_participant" CHECK (NOT ("playerId" IS NOT NULL AND "guestPlayerId" IS NOT NULL));
ALTER TABLE "EventGoalEvent" ADD CONSTRAINT "EventGoalEvent_at_most_one_participant" CHECK (NOT ("playerId" IS NOT NULL AND "guestPlayerId" IS NOT NULL));
ALTER TABLE "EventMatchLineupAssignment" ADD CONSTRAINT "EventMatchLineupAssignment_at_most_one_participant" CHECK (NOT ("playerId" IS NOT NULL AND "guestPlayerId" IS NOT NULL));
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_at_most_one_participant" CHECK (NOT ("playerId" IS NOT NULL AND "guestPlayerId" IS NOT NULL));
ALTER TABLE "MatchLineupAssignment" ADD CONSTRAINT "MatchLineupAssignment_at_most_one_participant" CHECK (NOT ("playerId" IS NOT NULL AND "guestPlayerId" IS NOT NULL));
ALTER TABLE "LiveMatchEvent" ADD CONSTRAINT "LiveMatchEvent_at_most_one_primary_participant" CHECK (NOT ("playerId" IS NOT NULL AND "guestPlayerId" IS NOT NULL));
ALTER TABLE "LiveMatchEvent" ADD CONSTRAINT "LiveMatchEvent_at_most_one_secondary_participant" CHECK (NOT ("secondaryPlayerId" IS NOT NULL AND "secondaryGuestPlayerId" IS NOT NULL));
