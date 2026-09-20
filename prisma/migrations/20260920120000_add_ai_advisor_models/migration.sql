-- ADR-0148: AI Advisor credential custody and provider architecture.
--
-- Adds the 5 organisation-scoped AI Advisor models (OrganisationAiSettings,
-- AiProviderConnection, AiAdvisorReview, AiAdvisorInsight, AiAdvisorJob) and their 10 enums.
-- Purely additive: no existing table, column, or index is altered.
--
-- Hand-curated (not a raw `prisma migrate diff` output): a full diff against this repo's actual
-- migration history also surfaces ~90 lines of pre-existing, unrelated schema drift (an enum
-- rename, several dropped/re-added foreign keys, missing `organisationId` indexes declared in
-- schema.prisma but never actually created by a migration, and a few Postgres-identifier-length
-- index renames) that predates this change and is already tracked separately — see ARR-0036.
-- Only AI-Advisor-related statements are included below, matching the precedent set by
-- 20260831070000_guestplayer_and_shared_participant_model.

-- ============================================================
-- 1. Enums
-- ============================================================

CREATE TYPE "AiProviderId" AS ENUM ('OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI', 'MISTRAL', 'OLLAMA_CLOUD');

CREATE TYPE "AiProviderConnectionStatus" AS ENUM ('PENDING', 'CONNECTED_NO_MODEL', 'READY', 'ERROR', 'DELETE_PENDING', 'DISCONNECTED');

CREATE TYPE "AiAdvisorCapability" AS ENUM ('ROUND_REVIEW', 'LINEUP_REVIEW', 'MATCH_PREP', 'POST_MATCH_REVIEW', 'WEEKLY_TEAM_REVIEW');

CREATE TYPE "AiAdvisorScopeType" AS ENUM ('MATCH_ROUND', 'MATCH', 'TEAM_WEEK');

CREATE TYPE "AiAdvisorReviewStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SUPERSEDED');

CREATE TYPE "AiInsightKind" AS ENUM ('OBSERVATION', 'ATTENTION', 'OPPORTUNITY', 'DEVELOPMENT_SUGGESTION');

CREATE TYPE "AiInsightSubjectType" AS ENUM ('TEAM', 'MATCH', 'ROUND', 'PLAYER', 'PLAYER_PAIR', 'NONE');

CREATE TYPE "AiInsightActionType" AS ENUM ('NONE', 'REVIEW', 'CONFIRM_DEVELOPMENT_OBSERVATION');

CREATE TYPE "AiInsightState" AS ENUM ('ACTIVE', 'DISMISSED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

CREATE TYPE "AiAdvisorJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- ============================================================
-- 2. Tables
-- ============================================================

CREATE TABLE "OrganisationAiSettings" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "activeConnectionId" TEXT,
    "roundReviewEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lineupReviewEnabled" BOOLEAN NOT NULL DEFAULT false,
    "matchPrepEnabled" BOOLEAN NOT NULL DEFAULT false,
    "postMatchReviewEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weeklyTeamReviewEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationAiSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiProviderConnection" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "provider" "AiProviderId" NOT NULL,
    "model" TEXT,
    "status" "AiProviderConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT,
    "connectedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAdvisorReview" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "capability" "AiAdvisorCapability" NOT NULL,
    "scopeType" "AiAdvisorScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "status" "AiAdvisorReviewStatus" NOT NULL DEFAULT 'QUEUED',
    "providerConnectionId" TEXT,
    "provider" "AiProviderId",
    "model" TEXT,
    "contractVersion" TEXT NOT NULL,
    "terminologyVersion" TEXT NOT NULL,
    "summary" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "providerRequestDurationMs" INTEGER,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAdvisorReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAdvisorInsight" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "kind" "AiInsightKind" NOT NULL,
    "subjectType" "AiInsightSubjectType" NOT NULL,
    "subjectId" TEXT,
    "secondarySubjectId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "evidenceRefs" JSONB NOT NULL,
    "actionType" "AiInsightActionType" NOT NULL DEFAULT 'NONE',
    "actionPayload" JSONB,
    "state" "AiInsightState" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAdvisorInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAdvisorJob" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "capability" "AiAdvisorCapability" NOT NULL,
    "scopeType" "AiAdvisorScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "status" "AiAdvisorJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAdvisorJob_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 3. Indexes
-- ============================================================

CREATE UNIQUE INDEX "OrganisationAiSettings_organisationId_key" ON "OrganisationAiSettings"("organisationId");
CREATE INDEX "OrganisationAiSettings_organisationId_idx" ON "OrganisationAiSettings"("organisationId");

CREATE INDEX "AiProviderConnection_organisationId_idx" ON "AiProviderConnection"("organisationId");
CREATE INDEX "AiProviderConnection_organisationId_status_idx" ON "AiProviderConnection"("organisationId", "status");

CREATE INDEX "AiAdvisorReview_organisationId_idx" ON "AiAdvisorReview"("organisationId");
CREATE INDEX "AiAdvisorReview_org_capability_scope_fingerprint_idx" ON "AiAdvisorReview"("organisationId", "capability", "scopeType", "scopeId", "sourceFingerprint");
CREATE INDEX "AiAdvisorReview_org_capability_scope_status_idx" ON "AiAdvisorReview"("organisationId", "capability", "scopeType", "scopeId", "status");

CREATE INDEX "AiAdvisorInsight_organisationId_idx" ON "AiAdvisorInsight"("organisationId");
CREATE INDEX "AiAdvisorInsight_reviewId_idx" ON "AiAdvisorInsight"("reviewId");
CREATE INDEX "AiAdvisorInsight_organisationId_subjectType_subjectId_idx" ON "AiAdvisorInsight"("organisationId", "subjectType", "subjectId");

CREATE INDEX "AiAdvisorJob_organisationId_idx" ON "AiAdvisorJob"("organisationId");
CREATE INDEX "AiAdvisorJob_status_nextAttemptAt_idx" ON "AiAdvisorJob"("status", "nextAttemptAt");
CREATE UNIQUE INDEX "AiAdvisorJob_organisationId_capability_scopeType_scopeId_so_key" ON "AiAdvisorJob"("organisationId", "capability", "scopeType", "scopeId", "sourceFingerprint");

-- ============================================================
-- 4. Foreign keys
-- ============================================================

ALTER TABLE "OrganisationAiSettings" ADD CONSTRAINT "OrganisationAiSettings_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiProviderConnection" ADD CONSTRAINT "AiProviderConnection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiAdvisorReview" ADD CONSTRAINT "AiAdvisorReview_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAdvisorReview" ADD CONSTRAINT "AiAdvisorReview_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "AiProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiAdvisorInsight" ADD CONSTRAINT "AiAdvisorInsight_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAdvisorInsight" ADD CONSTRAINT "AiAdvisorInsight_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "AiAdvisorReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiAdvisorJob" ADD CONSTRAINT "AiAdvisorJob_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 5. Row-level security (defence in depth; primary tenant isolation is the Prisma
--    where-clause-injection extension in src/lib/db.ts, per ADR-0087 / db.ts comments).
--
-- Follows the corrected pattern from 20260831000000_fix_rls_missing_permissive_fallback:
-- current_setting(..., true) (never throws if the GUC is unset) with a permissive fallback
-- when the GUC is unset or empty (the actual runtime state today — the app never SETs this
-- GUC; where-clause injection is the real enforcement layer). Targets matchboard_app_runtime,
-- the current runtime role (see 20260802150000_neon_role_isolation_and_rls_update).
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'OrganisationAiSettings', 'AiProviderConnection', 'AiAdvisorReview', 'AiAdvisorInsight', 'AiAdvisorJob'
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
      'OrganisationAiSettings', 'AiProviderConnection', 'AiAdvisorReview', 'AiAdvisorInsight', 'AiAdvisorJob'
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

-- ============================================================
-- 6. Table/enum privileges for the runtime and migration roles (defensive: the
--    ALTER DEFAULT PRIVILEGES set up in 20260802150000 should already extend these, but that
--    migration's own follow-up fix — 20260831000000 — found this did not always propagate).
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'OrganisationAiSettings', 'AiProviderConnection', 'AiAdvisorReview', 'AiAdvisorInsight', 'AiAdvisorJob'
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
      'AiProviderId', 'AiProviderConnectionStatus', 'AiAdvisorCapability', 'AiAdvisorScopeType',
      'AiAdvisorReviewStatus', 'AiInsightKind', 'AiInsightSubjectType', 'AiInsightActionType',
      'AiInsightState', 'AiAdvisorJobStatus'
    ]) LOOP
      EXECUTE format('GRANT USAGE ON TYPE %I TO matchboard_app_runtime', typ);
    END LOOP;
  END IF;
END $$;
