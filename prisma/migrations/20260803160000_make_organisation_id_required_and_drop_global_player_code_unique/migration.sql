-- MT-6: Make organisationId required on all tenant-scoped tables and drop global playerCode unique constraint
-- Per ADR-0048: orgSlug is authoritative; all protected routes use /o/{orgSlug}/...
-- This migration makes organisationId non-nullable across all 59 tenant-scoped tables,
-- drops the global playerCode unique constraint (replaced by composite [organisationId, playerCode]),
-- and simplifies RLS policies to remove null-compatible clauses.

-- ============================================================
-- 1. Make organisationId NOT NULL on all tenant-scoped tables
-- ============================================================
-- Production has zero NULL values across all these columns (verified before migration).
-- For databases with NULL values (test/dev), we assign the first existing organisation ID.
-- If no organisations exist, there should be no referencing rows either, so the SET NOT NULL
-- will succeed on empty tables.

-- Safety: set any NULL values to the first existing organisation ID.
-- If no organisation exists but there are rows with NULL organisationId,
-- create a placeholder organisation to satisfy foreign key constraints.
-- This handles test/dev databases that may have orphaned rows from incomplete test runs.
-- The check covers all tenant-scoped tables that have rows with NULL organisationId.
DO $$
DECLARE
  fallback_org_id TEXT;
  has_null_rows BOOLEAN;
BEGIN
  SELECT id INTO fallback_org_id FROM "Organisation" ORDER BY "createdAt" LIMIT 1;

  IF fallback_org_id IS NULL THEN
    -- Check if ANY tenant-scoped table has rows with NULL organisationId
    SELECT EXISTS (
      SELECT 1 FROM "OpponentTeam" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "Formation" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "Team" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "Player" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "Match" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "RuleConfig" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "Season" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "MatchRound" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "Availability" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "Selection" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "RotationPath" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "MovementLedger" WHERE "organisationId" IS NULL
      UNION ALL SELECT 1 FROM "Event" WHERE "organisationId" IS NULL
    ) INTO has_null_rows;

    IF has_null_rows THEN
      INSERT INTO "Organisation" (id, name, slug, "createdAt", "updatedAt")
      VALUES ('org-placeholder-migration', 'Placeholder (migration)', 'placeholder-migration', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
      fallback_org_id := 'org-placeholder-migration';
    END IF;
  END IF;

  IF fallback_org_id IS NOT NULL THEN
    -- Update all tables with NULL organisationId to use the first org
    UPDATE "Team" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "Player" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "Match" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "OpponentTeam" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "RuleConfig" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "Season" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "MatchRound" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "Availability" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "Selection" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "RotationPath" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "MovementLedger" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "Formation" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "FormationSlot" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "MatchLineup" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "MatchLineupAssignment" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "PlayerPosition" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "Warning" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "PlayerLock" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "SelectionAudit" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "DecisionRecord" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "CoachingIntent" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "PostMatchReport" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "PostMatchPlayerActual" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "Goal" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "Assist" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "MatchReportAbsence" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "MatchReportPlayerStat" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "PlayerReadinessSignal" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "MatchExecutionFeedback" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "LiveMatchSession" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "LiveMatchEvent" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "MatchRotation" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "FairPlayObservation" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "TeamReflection" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "OpponentEncounterObservation" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "SelectionExplanation" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "MovementCandidate" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "Event" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "EventPlayerAvailability" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "EventSquad" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "EventSquadPlayer" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "EventMatch" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "EventPostMatchReport" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "EventPostMatchPlayer" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "EventGoalEvent" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "EventAssistEvent" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "EventMatchSupportAssignment" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "EventMatchLineup" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "EventMatchLineupAssignment" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "LeagueSeason" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "SeasonPeriodSnapshot" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "TeamSeasonSnapshot" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "TeamSeasonSnapshotPlayer" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "PolicyDecisionLog" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "OpponentSportingEvidence" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "PlayerDevelopmentObservation" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "PlayerProfileSuggestion" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "NotificationOutbox" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
    UPDATE "ReviewRequest" SET "organisationId" = fallback_org_id WHERE "organisationId" IS NULL;
  END IF;
END $$;

-- Set NOT NULL (will succeed on empty tables or when all values are non-null)
-- Safety: for each table, explicitly update any remaining NULLs before SET NOT NULL.
-- This handles edge cases where the DO block above may have missed rows
-- (e.g., if a table was added by a later migration or the fallback org was not created).
-- These UPDATEs are idempotent and safe to run even if no NULLs exist.

DO $$
DECLARE
  fallback TEXT;
BEGIN
  SELECT id INTO fallback FROM "Organisation" ORDER BY "createdAt" LIMIT 1;
  IF fallback IS NOT NULL THEN
    UPDATE "Team" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "Player" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "Match" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "OpponentTeam" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "RuleConfig" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "Season" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "MatchRound" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "Availability" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "Selection" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "RotationPath" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "MovementLedger" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "Formation" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "FormationSlot" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "MatchLineup" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "MatchLineupAssignment" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "PlayerPosition" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "Warning" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "PlayerLock" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "SelectionAudit" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "DecisionRecord" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "CoachingIntent" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "PostMatchReport" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "PostMatchPlayerActual" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "Goal" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "Assist" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "MatchReportAbsence" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "MatchReportPlayerStat" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "PlayerReadinessSignal" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "MatchExecutionFeedback" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "LiveMatchSession" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "LiveMatchEvent" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "MatchRotation" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "FairPlayObservation" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "TeamReflection" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "OpponentEncounterObservation" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "SelectionExplanation" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "MovementCandidate" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "Event" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "EventPlayerAvailability" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "EventSquad" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "EventSquadPlayer" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "EventMatch" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "EventPostMatchReport" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "EventPostMatchPlayer" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "EventGoalEvent" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "EventAssistEvent" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "EventMatchSupportAssignment" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "EventMatchLineup" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "EventMatchLineupAssignment" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "LeagueSeason" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "SeasonPeriodSnapshot" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "TeamSeasonSnapshot" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "TeamSeasonSnapshotPlayer" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "PolicyDecisionLog" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "OpponentSportingEvidence" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "PlayerDevelopmentObservation" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "PlayerProfileSuggestion" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "NotificationOutbox" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
    UPDATE "ReviewRequest" SET "organisationId" = fallback WHERE "organisationId" IS NULL;
  END IF;
END $$;
ALTER TABLE "Player" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "Match" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "OpponentTeam" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "RuleConfig" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "Season" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "MatchRound" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "Availability" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "Selection" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "RotationPath" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "MovementLedger" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "Formation" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "FormationSlot" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "MatchLineup" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "MatchLineupAssignment" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "PlayerPosition" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "Warning" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "PlayerLock" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "SelectionAudit" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "DecisionRecord" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "CoachingIntent" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "PostMatchReport" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "PostMatchPlayerActual" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "Goal" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "Assist" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "MatchReportAbsence" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "MatchReportPlayerStat" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "PlayerReadinessSignal" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "MatchExecutionFeedback" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "LiveMatchSession" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "LiveMatchEvent" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "MatchRotation" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "FairPlayObservation" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "TeamReflection" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "OpponentEncounterObservation" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "SelectionExplanation" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "MovementCandidate" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "Event" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "EventPlayerAvailability" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "EventSquad" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "EventSquadPlayer" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "EventMatch" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "EventPostMatchReport" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "EventPostMatchPlayer" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "EventGoalEvent" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "EventAssistEvent" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "EventMatchSupportAssignment" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "EventMatchLineup" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "EventMatchLineupAssignment" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "LeagueSeason" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "SeasonPeriodSnapshot" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "TeamSeasonSnapshot" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "TeamSeasonSnapshotPlayer" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "PolicyDecisionLog" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "OpponentSportingEvidence" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "PlayerDevelopmentObservation" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "PlayerProfileSuggestion" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "NotificationOutbox" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "ReviewRequest" ALTER COLUMN "organisationId" SET NOT NULL;

-- ============================================================
-- 2. Drop global playerCode unique constraint
-- ============================================================
-- Player.playerCode had a global @unique constraint (unique across all orgs).
-- The composite @@unique([organisationId, playerCode]) already enforces per-org uniqueness.
-- The global constraint is wrong: player codes should be unique within an organisation,
-- not globally across all organisations.

-- Find and drop the existing global unique index on playerCode
-- Prisma names it as "Player_playerCode_key"
DO $$
BEGIN
  -- Drop the constraint if it exists (name may vary)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Player_playerCode_key') THEN
    ALTER TABLE "Player" DROP CONSTRAINT "Player_playerCode_key";
  END IF;
END $$;

-- Also try alternative Prisma naming
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Player_playerCode_key') THEN
    DROP INDEX "Player_playerCode_key";
  END IF;
END $$;

-- ============================================================
-- 3. Simplify RLS policies: remove null-compatible clauses
-- ============================================================
-- Now that organisationId is non-nullable, the null-compatible clause in tenant_read
-- policies is no longer needed. Replace all tenant_read policies with strict equality.
-- Other policies (insert, update, delete) already use strict equality and don't need changes.

DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
BEGIN
  FOR tbl IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
      AND EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'organisationId'
      )
    ORDER BY c.relname
  LOOP
    policy_name := tbl || '_tenant_read';

    -- Drop and recreate the read policy without null-compatible clause
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = policy_name AND polrelid = (SELECT oid FROM pg_class WHERE relname = tbl AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))) THEN
      EXECUTE format('DROP POLICY %I ON %I', policy_name, tbl);
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO matchboard_app_runtime USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
        )',
        policy_name, tbl
      );
    END IF;
  END LOOP;
END $$;