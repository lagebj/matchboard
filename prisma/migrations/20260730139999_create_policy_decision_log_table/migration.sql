-- Create PolicyDecisionLog table (missing from initial migration chain)
-- This corrective migration must be idempotent because some environments
-- may have already created the table through a Prisma push or manual DDL.

CREATE TABLE IF NOT EXISTS "PolicyDecisionLog" (
    "id"                   TEXT    NOT NULL,
    "decisionType"         TEXT    NOT NULL,
    "policyRuntime"        TEXT    DEFAULT 'default',
    "policyVersionHash"    TEXT,
    "policyPackId"         TEXT,
    "inputHash"            TEXT,
    "resultSummaryJson"    TEXT,
    "relatedEventId"       TEXT,
    "relatedEventMatchId"  TEXT,
    "relatedLeagueMatchId" TEXT,
    "relatedTeamId"        TEXT,
    "blockedCount"         INT    NOT NULL DEFAULT 0,
    "warningCount"         INT    NOT NULL DEFAULT 0,
    "scoreAdjustmentCount" INT    NOT NULL DEFAULT 0,
    "explanationCount"     INT    NOT NULL DEFAULT 0,
    "regoEnabled"          BOOLEAN NOT NULL DEFAULT false,
    "regoFailureMode"      TEXT    DEFAULT 'fail_closed',
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyDecisionLog_pkey" PRIMARY KEY ("id")
);

-- Indexes (organisationId index is created by the add_organisation_id migration)
CREATE INDEX IF NOT EXISTS "PolicyDecisionLog_decisionType_idx" ON "PolicyDecisionLog"("decisionType");
CREATE INDEX IF NOT EXISTS "PolicyDecisionLog_relatedEventId_idx" ON "PolicyDecisionLog"("relatedEventId");
CREATE INDEX IF NOT EXISTS "PolicyDecisionLog_relatedLeagueMatchId_idx" ON "PolicyDecisionLog"("relatedLeagueMatchId");
CREATE INDEX IF NOT EXISTS "PolicyDecisionLog_createdAt_idx" ON "PolicyDecisionLog"("createdAt");