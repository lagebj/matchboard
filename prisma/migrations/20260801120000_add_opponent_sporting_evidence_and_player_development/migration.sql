-- CreateEnum: OpponentWeightingMethod
CREATE TYPE "OpponentWeightingMethod" AS ENUM ('MINUTE_WEIGHTED', 'PARTICIPANT_AVERAGE');

-- CreateEnum: DevelopmentObservationSource
CREATE TYPE "DevelopmentObservationSource" AS ENUM ('LEAGUE_MATCH', 'EVENT_MATCH');

-- CreateEnum: DevelopmentObservationKind
CREATE TYPE "DevelopmentObservationKind" AS ENUM ('ATTRIBUTE', 'POSITION');

-- CreateEnum: DevelopmentDirection
CREATE TYPE "DevelopmentDirection" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum: SuggestionConfidence
CREATE TYPE "SuggestionConfidence" AS ENUM ('MEDIUM', 'HIGH');

-- CreateEnum: SuggestionStatus
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'ADJUSTED', 'REJECTED', 'SUPERSEDED');

-- CreateTable: OpponentSportingEvidence
CREATE TABLE "OpponentSportingEvidence" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "matchId" TEXT NOT NULL,
    "opponentTeamId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "gameFormat" "GameFormat",
    "goalsFor" INTEGER NOT NULL,
    "goalsAgainst" INTEGER NOT NULL,
    "fieldedRatingSnapshot" DECIMAL(4,2),
    "participantCount" INTEGER NOT NULL,
    "ratedParticipantCount" INTEGER NOT NULL,
    "weightingMethod" "OpponentWeightingMethod" NOT NULL DEFAULT E'PARTICIPANT_AVERAGE',
    "estimate" DECIMAL(4,2) NOT NULL,
    "formulaVersion" TEXT NOT NULL,
    "excludedAt" TIMESTAMP(3),
    "exclusionReason" TEXT,
    "fieldedRatingDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpponentSportingEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlayerDevelopmentObservation
CREATE TABLE "PlayerDevelopmentObservation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "playerId" TEXT NOT NULL,
    "sourceType" "DevelopmentObservationSource" NOT NULL DEFAULT E'LEAGUE_MATCH',
    "matchId" TEXT NOT NULL,
    "kind" "DevelopmentObservationKind" NOT NULL,
    "attributeKey" TEXT,
    "positionId" TEXT,
    "direction" "DevelopmentDirection" NOT NULL,
    "observableNote" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerDevelopmentObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlayerProfileSuggestion
CREATE TABLE "PlayerProfileSuggestion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "playerId" TEXT NOT NULL,
    "targetType" "DevelopmentObservationKind" NOT NULL,
    "attributeKey" TEXT,
    "positionId" TEXT,
    "confidence" "SuggestionConfidence" NOT NULL,
    "direction" "DevelopmentDirection" NOT NULL,
    "currentSnapshot" JSONB NOT NULL,
    "proposedSnapshot" JSONB NOT NULL,
    "evidenceSummary" JSONB NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT E'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerProfileSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlayerProfileSuggestionEvidence
CREATE TABLE "PlayerProfileSuggestionEvidence" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerProfileSuggestionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: OpponentSportingEvidence
CREATE UNIQUE INDEX "OpponentSportingEvidence_matchId_key" ON "OpponentSportingEvidence"("matchId");
CREATE INDEX "OpponentSportingEvidence_opponentTeamId_occurredAt_idx" ON "OpponentSportingEvidence"("opponentTeamId", "occurredAt");
CREATE INDEX "OpponentSportingEvidence_opponentTeamId_gameFormat_occurredAt_idx" ON "OpponentSportingEvidence"("opponentTeamId", "gameFormat", "occurredAt");
CREATE INDEX "OpponentSportingEvidence_organisationId_idx" ON "OpponentSportingEvidence"("organisationId");
CREATE INDEX "OpponentSportingEvidence_excludedAt_idx" ON "OpponentSportingEvidence"("excludedAt");

-- CreateIndex: PlayerDevelopmentObservation
CREATE INDEX "PlayerDevelopmentObservation_playerId_attributeKey_observedAt_idx" ON "PlayerDevelopmentObservation"("playerId", "attributeKey", "observedAt");
CREATE INDEX "PlayerDevelopmentObservation_playerId_positionId_observedAt_idx" ON "PlayerDevelopmentObservation"("playerId", "positionId", "observedAt");
CREATE INDEX "PlayerDevelopmentObservation_matchId_idx" ON "PlayerDevelopmentObservation"("matchId");
CREATE INDEX "PlayerDevelopmentObservation_organisationId_idx" ON "PlayerDevelopmentObservation"("organisationId");
CREATE INDEX "PlayerDevelopmentObservation_recordedBy_idx" ON "PlayerDevelopmentObservation"("recordedBy");

-- CreateIndex: PlayerProfileSuggestion
CREATE UNIQUE INDEX "PlayerProfileSuggestion_playerId_targetType_attributeKey_positionId_status_key" ON "PlayerProfileSuggestion"("playerId", "targetType", "attributeKey", "positionId", "status");
CREATE INDEX "PlayerProfileSuggestion_playerId_status_idx" ON "PlayerProfileSuggestion"("playerId", "status");
CREATE INDEX "PlayerProfileSuggestion_playerId_targetType_idx" ON "PlayerProfileSuggestion"("playerId", "targetType");
CREATE INDEX "PlayerProfileSuggestion_organisationId_idx" ON "PlayerProfileSuggestion"("organisationId");
CREATE INDEX "PlayerProfileSuggestion_status_idx" ON "PlayerProfileSuggestion"("status");
CREATE INDEX "PlayerProfileSuggestion_decidedAt_idx" ON "PlayerProfileSuggestion"("decidedAt");

-- CreateIndex: PlayerProfileSuggestionEvidence
CREATE UNIQUE INDEX "PlayerProfileSuggestionEvidence_suggestionId_observationId_key" ON "PlayerProfileSuggestionEvidence"("suggestionId", "observationId");
CREATE INDEX "PlayerProfileSuggestionEvidence_suggestionId_idx" ON "PlayerProfileSuggestionEvidence"("suggestionId");
CREATE INDEX "PlayerProfileSuggestionEvidence_observationId_idx" ON "PlayerProfileSuggestionEvidence"("observationId");

-- AddForeignKey: OpponentSportingEvidence -> Match
ALTER TABLE "OpponentSportingEvidence" ADD CONSTRAINT "OpponentSportingEvidence_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: OpponentSportingEvidence -> OpponentTeam
ALTER TABLE "OpponentSportingEvidence" ADD CONSTRAINT "OpponentSportingEvidence_opponentTeamId_fkey" FOREIGN KEY ("opponentTeamId") REFERENCES "OpponentTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: OpponentSportingEvidence -> Organisation
ALTER TABLE "OpponentSportingEvidence" ADD CONSTRAINT "OpponentSportingEvidence_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PlayerDevelopmentObservation -> Player
ALTER TABLE "PlayerDevelopmentObservation" ADD CONSTRAINT "PlayerDevelopmentObservation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: PlayerDevelopmentObservation -> Match
ALTER TABLE "PlayerDevelopmentObservation" ADD CONSTRAINT "PlayerDevelopmentObservation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PlayerDevelopmentObservation -> Organisation
ALTER TABLE "PlayerDevelopmentObservation" ADD CONSTRAINT "PlayerDevelopmentObservation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PlayerProfileSuggestion -> Player
ALTER TABLE "PlayerProfileSuggestion" ADD CONSTRAINT "PlayerProfileSuggestion_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: PlayerProfileSuggestion -> Organisation
ALTER TABLE "PlayerProfileSuggestion" ADD CONSTRAINT "PlayerProfileSuggestion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PlayerProfileSuggestionEvidence -> PlayerProfileSuggestion
ALTER TABLE "PlayerProfileSuggestionEvidence" ADD CONSTRAINT "PlayerProfileSuggestionEvidence_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "PlayerProfileSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PlayerProfileSuggestionEvidence -> PlayerDevelopmentObservation
ALTER TABLE "PlayerProfileSuggestionEvidence" ADD CONSTRAINT "PlayerProfileSuggestionEvidence_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "PlayerDevelopmentObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;