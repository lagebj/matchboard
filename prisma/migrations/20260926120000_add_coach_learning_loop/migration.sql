-- ADR-0152 Slice 0: coach learning loop additive baseline.
--
-- Additive only (ADR-0105 expand/contract satisfied without a split): new enums, new enum values,
-- nullable/defaulted columns, and four new organisation-scoped tables. No existing row is read,
-- rewritten, or backfilled. Hand-curated from `prisma migrate diff` against the previous
-- schema.prisma (not a live-database diff — see ARR-0036), plus the hand-added CHECK constraints
-- and the repository's organisation RLS/grant pattern (20260920120000_add_ai_advisor_models).
-- CreateEnum
CREATE TYPE "AiInsightAnalysisRole" AS ENUM ('SUPPORTED', 'CONTRADICTED', 'UNRESOLVED', 'SURPRISING', 'RECURRING_PATTERN', 'NEXT_FOCUS', 'EVIDENCE_GAP');

-- CreateEnum
CREATE TYPE "PostMatchDebriefStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "QualitativeEvidenceDerivationMethod" AS ENUM ('DETERMINISTIC', 'AI_STRUCTURED');

-- CreateEnum
CREATE TYPE "QualitativeEvidenceExtractionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "QualitativeEvidenceSourceType" AS ENUM ('POST_MATCH_DEBRIEF_WORKED', 'POST_MATCH_DEBRIEF_NEEDS_ATTENTION', 'POST_MATCH_DEBRIEF_CHANGE', 'POST_MATCH_DEBRIEF_OPPONENT', 'POST_MATCH_DEBRIEF_OTHER', 'POST_MATCH_TEAM_NOTE', 'TEAM_REFLECTION_NOTE', 'MATCH_NOTE', 'QUICK_OBSERVATION', 'OPPONENT_ENCOUNTER_TEXT', 'AI_CLARIFICATION');

-- CreateEnum
CREATE TYPE "QualitativeEvidenceScope" AS ENUM ('TEAM', 'PLAYER', 'OPPONENT', 'PAIR');

-- CreateEnum
CREATE TYPE "QualitativeEvidencePhase" AS ENUM ('GENERAL', 'BUILD_UP', 'PROGRESSION', 'CHANCE_CREATION', 'PRESSING', 'DEFENSIVE_SHAPE', 'DEFENSIVE_TRANSITION', 'ATTACKING_TRANSITION', 'SET_PLAYS');

-- CreateEnum
CREATE TYPE "QualitativeEvidencePolarity" AS ENUM ('WORKING', 'PROBLEM', 'NEUTRAL', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "QualitativeEvidenceExplicitness" AS ENUM ('EXPLICIT', 'TENTATIVE');

-- AlterEnum
ALTER TYPE "AiAdvisorCapability" ADD VALUE 'DEVELOPMENT_CYCLE_REVIEW';

-- AlterEnum
ALTER TYPE "AiAdvisorScopeType" ADD VALUE 'TEAM_WINDOW';

-- AlterTable
ALTER TABLE "LiveMatchSession" ADD COLUMN     "lastClockTransitionAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EventLiveMatchSession" ADD COLUMN     "lastClockTransitionAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrganisationAiSettings" ADD COLUMN     "developmentCycleReviewEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AiAdvisorInsight" ADD COLUMN     "analysisRole" "AiInsightAnalysisRole",
ADD COLUMN     "clarificationOptions" JSONB,
ADD COLUMN     "clarificationQuestion" TEXT,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PostMatchDebrief" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "postMatchReportId" TEXT,
    "eventPostMatchReportId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "PostMatchDebriefStatus" NOT NULL DEFAULT 'DRAFT',
    "answers" JSONB NOT NULL,
    "createdBy" TEXT,
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostMatchDebrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualitativeEvidenceExtractionRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "sourceType" "QualitativeEvidenceSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "derivationMethod" "QualitativeEvidenceDerivationMethod" NOT NULL,
    "status" "QualitativeEvidenceExtractionStatus" NOT NULL,
    "promptVersion" TEXT,
    "providerConnectionId" TEXT,
    "provider" "AiProviderId",
    "model" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "failureCode" TEXT,
    "supersededAt" TIMESTAMP(3),
    "inputChars" INTEGER,
    "outputChars" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualitativeEvidenceExtractionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualitativeEvidenceObservation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "extractionRunId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "matchId" TEXT,
    "eventMatchId" TEXT,
    "playerId" TEXT,
    "secondaryPlayerId" TEXT,
    "scope" "QualitativeEvidenceScope" NOT NULL,
    "phase" "QualitativeEvidencePhase" NOT NULL,
    "polarity" "QualitativeEvidencePolarity" NOT NULL,
    "explicitness" "QualitativeEvidenceExplicitness" NOT NULL DEFAULT 'EXPLICIT',
    "period" "MatchPeriod",
    "statement" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualitativeEvidenceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInsightClarification" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "selectedOption" TEXT,
    "answerText" TEXT,
    "answeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiInsightClarification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostMatchDebrief_postMatchReportId_key" ON "PostMatchDebrief"("postMatchReportId");

-- CreateIndex
CREATE UNIQUE INDEX "PostMatchDebrief_eventPostMatchReportId_key" ON "PostMatchDebrief"("eventPostMatchReportId");

-- CreateIndex
CREATE INDEX "PostMatchDebrief_organisationId_status_idx" ON "PostMatchDebrief"("organisationId", "status");

-- CreateIndex
CREATE INDEX "QualitativeEvidenceExtractionRun_organisationId_status_next_idx" ON "QualitativeEvidenceExtractionRun"("organisationId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "QualEvidenceRun_org_source_superseded_idx" ON "QualitativeEvidenceExtractionRun"("organisationId", "sourceType", "sourceId", "supersededAt");

-- CreateIndex
CREATE INDEX "QualitativeEvidenceExtractionRun_status_nextAttemptAt_idx" ON "QualitativeEvidenceExtractionRun"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "QualEvidenceRun_org_source_fingerprint_key" ON "QualitativeEvidenceExtractionRun"("organisationId", "sourceType", "sourceId", "sourceFingerprint");

-- CreateIndex
CREATE INDEX "QualitativeEvidenceObservation_extractionRunId_idx" ON "QualitativeEvidenceObservation"("extractionRunId");

-- CreateIndex
CREATE INDEX "QualitativeEvidenceObservation_organisationId_teamId_create_idx" ON "QualitativeEvidenceObservation"("organisationId", "teamId", "createdAt");

-- CreateIndex
CREATE INDEX "QualitativeEvidenceObservation_organisationId_matchId_idx" ON "QualitativeEvidenceObservation"("organisationId", "matchId");

-- CreateIndex
CREATE INDEX "QualitativeEvidenceObservation_organisationId_eventMatchId_idx" ON "QualitativeEvidenceObservation"("organisationId", "eventMatchId");

-- CreateIndex
CREATE INDEX "QualitativeEvidenceObservation_organisationId_playerId_crea_idx" ON "QualitativeEvidenceObservation"("organisationId", "playerId", "createdAt");

-- CreateIndex
CREATE INDEX "QualitativeEvidenceObservation_organisationId_phase_created_idx" ON "QualitativeEvidenceObservation"("organisationId", "phase", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiInsightClarification_insightId_key" ON "AiInsightClarification"("insightId");

-- CreateIndex
CREATE INDEX "AiInsightClarification_organisationId_createdAt_idx" ON "AiInsightClarification"("organisationId", "createdAt");

-- AddForeignKey
ALTER TABLE "PostMatchDebrief" ADD CONSTRAINT "PostMatchDebrief_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMatchDebrief" ADD CONSTRAINT "PostMatchDebrief_postMatchReportId_fkey" FOREIGN KEY ("postMatchReportId") REFERENCES "PostMatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMatchDebrief" ADD CONSTRAINT "PostMatchDebrief_eventPostMatchReportId_fkey" FOREIGN KEY ("eventPostMatchReportId") REFERENCES "EventPostMatchReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualitativeEvidenceExtractionRun" ADD CONSTRAINT "QualitativeEvidenceExtractionRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualitativeEvidenceObservation" ADD CONSTRAINT "QualitativeEvidenceObservation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualitativeEvidenceObservation" ADD CONSTRAINT "QualitativeEvidenceObservation_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "QualitativeEvidenceExtractionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualitativeEvidenceObservation" ADD CONSTRAINT "QualitativeEvidenceObservation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualitativeEvidenceObservation" ADD CONSTRAINT "QualitativeEvidenceObservation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualitativeEvidenceObservation" ADD CONSTRAINT "QualitativeEvidenceObservation_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualitativeEvidenceObservation" ADD CONSTRAINT "QualitativeEvidenceObservation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualitativeEvidenceObservation" ADD CONSTRAINT "QualitativeEvidenceObservation_secondaryPlayerId_fkey" FOREIGN KEY ("secondaryPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsightClarification" ADD CONSTRAINT "AiInsightClarification_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsightClarification" ADD CONSTRAINT "AiInsightClarification_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "AiAdvisorInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- Hand-added invariants (Prisma cannot express these).
-- ============================================================

-- Exactly one of the League/Event report ids.
ALTER TABLE "PostMatchDebrief" ADD CONSTRAINT "PostMatchDebrief_exactly_one_report" CHECK (("postMatchReportId" IS NOT NULL) != ("eventPostMatchReportId" IS NOT NULL));

-- Match-derived evidence points at exactly one of League/Event match (both null is permitted for
-- non-match team sources); PLAYER requires a player; PAIR requires two different players;
-- statements are bounded.
ALTER TABLE "QualitativeEvidenceObservation" ADD CONSTRAINT "QualitativeEvidenceObservation_at_most_one_match" CHECK (NOT ("matchId" IS NOT NULL AND "eventMatchId" IS NOT NULL));
ALTER TABLE "QualitativeEvidenceObservation" ADD CONSTRAINT "QualitativeEvidenceObservation_player_scope" CHECK ("scope" <> 'PLAYER' OR "playerId" IS NOT NULL);
ALTER TABLE "QualitativeEvidenceObservation" ADD CONSTRAINT "QualitativeEvidenceObservation_pair_scope" CHECK ("scope" <> 'PAIR' OR ("playerId" IS NOT NULL AND "secondaryPlayerId" IS NOT NULL AND "playerId" <> "secondaryPlayerId"));
ALTER TABLE "QualitativeEvidenceObservation" ADD CONSTRAINT "QualitativeEvidenceObservation_statement_length" CHECK (char_length("statement") BETWEEN 1 AND 500);

-- A clarification answer carries at least one of the selected option or free text.
ALTER TABLE "AiInsightClarification" ADD CONSTRAINT "AiInsightClarification_has_answer" CHECK ("selectedOption" IS NOT NULL OR "answerText" IS NOT NULL);

-- ============================================================
-- Row-level security (defence in depth; primary tenant isolation is the Prisma
-- where-clause-injection extension in src/lib/db.ts, per ADR-0087). Same corrected permissive
-- fallback pattern as 20260920120000_add_ai_advisor_models.
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'PostMatchDebrief', 'QualitativeEvidenceExtractionRun', 'QualitativeEvidenceObservation', 'AiInsightClarification'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app_runtime') THEN
    FOR tbl IN SELECT unnest(ARRAY[
      'PostMatchDebrief', 'QualitativeEvidenceExtractionRun', 'QualitativeEvidenceObservation', 'AiInsightClarification'
    ]) LOOP
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO matchboard_app_runtime USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        tbl || '_tenant_read', tbl
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I FOR INSERT TO matchboard_app_runtime WITH CHECK (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        tbl || '_tenant_insert', tbl
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I FOR UPDATE TO matchboard_app_runtime USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        ) WITH CHECK (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        tbl || '_tenant_update', tbl
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I FOR DELETE TO matchboard_app_runtime USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        tbl || '_tenant_delete', tbl
      );
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'PostMatchDebrief', 'QualitativeEvidenceExtractionRun', 'QualitativeEvidenceObservation', 'AiInsightClarification'
  ]) LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app_runtime') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO matchboard_app_runtime', tbl);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_admin_migration') THEN
      EXECUTE format('GRANT ALL PRIVILEGES ON TABLE %I TO matchboard_admin_migration', tbl);
      EXECUTE format('ALTER TABLE %I OWNER TO matchboard_admin_migration', tbl);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  typ TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app_runtime') THEN
    FOR typ IN SELECT unnest(ARRAY[
      'AiInsightAnalysisRole', 'PostMatchDebriefStatus', 'QualitativeEvidenceDerivationMethod',
      'QualitativeEvidenceExtractionStatus', 'QualitativeEvidenceSourceType', 'QualitativeEvidenceScope',
      'QualitativeEvidencePhase', 'QualitativeEvidencePolarity', 'QualitativeEvidenceExplicitness'
    ]) LOOP
      EXECUTE format('GRANT USAGE ON TYPE %I TO matchboard_app_runtime', typ);
    END LOOP;
  END IF;
END $$;
