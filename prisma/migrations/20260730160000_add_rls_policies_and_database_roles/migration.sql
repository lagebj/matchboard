-- MT-3: Row-level security policies and database role isolation
-- Per ADR-0037: application-level tenant enforcement + PostgreSQL RLS as defence in depth
-- Runtime role (matchboard_app) cannot bypass RLS; admin role (matchboard_admin) can bypass for migrations
--
-- PREREQUISITE: matchboard_app and matchboard_admin roles must exist before this migration runs.
-- Create roles through Neon dashboard or CLI before deploying this migration.
--
-- Local development: RLS is enforced but roles may not exist. The migration uses
-- conditional role checks. For local dev without RLS roles, all data is accessible
-- to the migration user (which is typically a superuser).
--
-- Production: DATABASE_URL uses matchboard_app (restricted by RLS).
-- DIRECT_URL uses matchboard_admin (BYPASSRLS for migrations).

-- ============================================================
-- 1. Enable RLS on all tenant-bearing tables
-- ============================================================
-- 53 tables have organisationId and represent tenant data.
-- RLS policies enforce that the runtime role can only see/modify rows
-- belonging to the organisation set in current_setting('app.current_organization_id').

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'Team', 'Player', 'Match', 'OpponentTeam', 'RuleConfig',
    'Season', 'MatchRound', 'Availability', 'Selection', 'RotationPath',
    'MovementLedger', 'Formation', 'FormationSlot', 'MatchLineup', 'MatchLineupAssignment',
    'PlayerPosition', 'Warning', 'PlayerLock', 'SelectionAudit', 'DecisionRecord',
    'CoachingIntent', 'PostMatchReport', 'PostMatchPlayerActual', 'Goal', 'Assist',
    'MatchReportAbsence', 'MatchReportPlayerStat', 'PlayerReadinessSignal', 'MatchExecutionFeedback',
    'TeamReflection', 'OpponentEncounterObservation', 'SelectionExplanation', 'MovementCandidate',
    'Event', 'EventPlayerAvailability', 'EventSquad', 'EventSquadPlayer', 'EventMatch',
    'EventPostMatchReport', 'EventPostMatchPlayer', 'EventGoalEvent', 'EventAssistEvent',
    'EventMatchSupportAssignment', 'EventMatchLineup', 'EventMatchLineupAssignment',
    'LeagueSeason', 'SeasonPeriodSnapshot', 'TeamSeasonSnapshot', 'TeamSeasonSnapshotPlayer',
    'PolicyDecisionLog',
    'OrganisationMembership', 'OrganisationInvitation', 'MachinePrincipal'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- ============================================================
-- 2. Create RLS policies for matchboard_app role (conditional)
-- ============================================================
-- Policies are only created if the matchboard_app role exists.
-- In local development without the role, these are skipped — the
-- migration user (superuser) bypasses RLS anyway.

DO $$
DECLARE
  tbl TEXT;
  app_role_exists BOOLEAN;
  admin_role_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app') INTO app_role_exists;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_admin') INTO admin_role_exists;

  IF NOT app_role_exists AND NOT admin_role_exists THEN
    -- Neither role exists yet (local dev). Skip policy creation.
    -- RLS is enabled but no policies restrict access, so the migration
    -- user (typically superuser) can still access all data.
    -- When roles are created later, re-run this migration or create policies manually.
    RETURN;
  END IF;

  FOR tbl IN SELECT unnest(ARRAY[
    'Team', 'Player', 'Match', 'OpponentTeam', 'RuleConfig',
    'Season', 'MatchRound', 'Availability', 'Selection', 'RotationPath',
    'MovementLedger', 'Formation', 'FormationSlot', 'MatchLineup', 'MatchLineupAssignment',
    'PlayerPosition', 'Warning', 'PlayerLock', 'SelectionAudit', 'DecisionRecord',
    'CoachingIntent', 'PostMatchReport', 'PostMatchPlayerActual', 'Goal', 'Assist',
    'MatchReportAbsence', 'MatchReportPlayerStat', 'PlayerReadinessSignal', 'MatchExecutionFeedback',
    'TeamReflection', 'OpponentEncounterObservation', 'SelectionExplanation', 'MovementCandidate',
    'Event', 'EventPlayerAvailability', 'EventSquad', 'EventSquadPlayer', 'EventMatch',
    'EventPostMatchReport', 'EventPostMatchPlayer', 'EventGoalEvent', 'EventAssistEvent',
    'EventMatchSupportAssignment', 'EventMatchLineup', 'EventMatchLineupAssignment',
    'LeagueSeason', 'SeasonPeriodSnapshot', 'TeamSeasonSnapshot', 'TeamSeasonSnapshotPlayer',
    'PolicyDecisionLog',
    'OrganisationMembership', 'OrganisationInvitation', 'MachinePrincipal'
  ]) LOOP
    -- Read policy: allows SELECT when organisationId matches current tenant
    -- Also allows reading rows with NULL organisationId during migration period
    IF app_role_exists THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO matchboard_app USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR ("organisationId" IS NULL AND current_setting(''app.current_organization_id'', true) = '''')
        )',
        tbl || '_tenant_read', tbl
      );

      -- Insert policy
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR INSERT TO matchboard_app WITH CHECK (
          "organisationId" = current_setting(''app.current_organization_id'', true)
        )',
        tbl || '_tenant_insert', tbl
      );

      -- Update policy
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR UPDATE TO matchboard_app USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
        ) WITH CHECK (
          "organisationId" = current_setting(''app.current_organization_id'', true)
        )',
        tbl || '_tenant_update', tbl
      );

      -- Delete policy
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR DELETE TO matchboard_app USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
        )',
        tbl || '_tenant_delete', tbl
      );
    END IF;

    -- Admin bypass policy: matchboard_admin can do everything
    IF admin_role_exists THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO matchboard_admin USING (true) WITH CHECK (true)',
        tbl || '_admin_all', tbl
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 3. Force RLS even for table owners
-- ============================================================
-- This ensures that even if matchboard_app somehow gets ownership privileges,
-- RLS policies still apply. Only matchboard_admin (with BYPASSRLS) can bypass.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'Team', 'Player', 'Match', 'OpponentTeam', 'RuleConfig',
    'Season', 'MatchRound', 'Availability', 'Selection', 'RotationPath',
    'MovementLedger', 'Formation', 'FormationSlot', 'MatchLineup', 'MatchLineupAssignment',
    'PlayerPosition', 'Warning', 'PlayerLock', 'SelectionAudit', 'DecisionRecord',
    'CoachingIntent', 'PostMatchReport', 'PostMatchPlayerActual', 'Goal', 'Assist',
    'MatchReportAbsence', 'MatchReportPlayerStat', 'PlayerReadinessSignal', 'MatchExecutionFeedback',
    'TeamReflection', 'OpponentEncounterObservation', 'SelectionExplanation', 'MovementCandidate',
    'Event', 'EventPlayerAvailability', 'EventSquad', 'EventSquadPlayer', 'EventMatch',
    'EventPostMatchReport', 'EventPostMatchPlayer', 'EventGoalEvent', 'EventAssistEvent',
    'EventMatchSupportAssignment', 'EventMatchLineup', 'EventMatchLineupAssignment',
    'LeagueSeason', 'SeasonPeriodSnapshot', 'TeamSeasonSnapshot', 'TeamSeasonSnapshotPlayer',
    'PolicyDecisionLog',
    'OrganisationMembership', 'OrganisationInvitation', 'MachinePrincipal'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- ============================================================
-- 4. Grant table access to matchboard_app (conditional)
-- ============================================================
-- The runtime role needs SELECT, INSERT, UPDATE, DELETE on tenant-bearing tables.
-- These grants are only applied if the role exists.

DO $$
DECLARE
  tbl TEXT;
  app_role_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app') INTO app_role_exists;

  IF NOT app_role_exists THEN
    RETURN;
  END IF;

  FOR tbl IN SELECT unnest(ARRAY[
    'Team', 'Player', 'Match', 'OpponentTeam', 'RuleConfig',
    'Season', 'MatchRound', 'Availability', 'Selection', 'RotationPath',
    'MovementLedger', 'Formation', 'FormationSlot', 'MatchLineup', 'MatchLineupAssignment',
    'PlayerPosition', 'Warning', 'PlayerLock', 'SelectionAudit', 'DecisionRecord',
    'CoachingIntent', 'PostMatchReport', 'PostMatchPlayerActual', 'Goal', 'Assist',
    'MatchReportAbsence', 'MatchReportPlayerStat', 'PlayerReadinessSignal', 'MatchExecutionFeedback',
    'TeamReflection', 'OpponentEncounterObservation', 'SelectionExplanation', 'MovementCandidate',
    'Event', 'EventPlayerAvailability', 'EventSquad', 'EventSquadPlayer', 'EventMatch',
    'EventPostMatchReport', 'EventPostMatchPlayer', 'EventGoalEvent', 'EventAssistEvent',
    'EventMatchSupportAssignment', 'EventMatchLineup', 'EventMatchLineupAssignment',
    'LeagueSeason', 'SeasonPeriodSnapshot', 'TeamSeasonSnapshot', 'TeamSeasonSnapshotPlayer',
    'PolicyDecisionLog',
    'OrganisationMembership', 'OrganisationInvitation', 'MachinePrincipal',
    'Organisation', 'User', 'Account', 'Session', 'VerificationToken', 'TeamAccess'
  ]) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO matchboard_app', tbl);
  END LOOP;

  -- Grant all privileges to matchboard_admin on all tables
  FOR tbl IN SELECT unnest(ARRAY[
    'Team', 'Player', 'Match', 'OpponentTeam', 'RuleConfig',
    'Season', 'MatchRound', 'Availability', 'Selection', 'RotationPath',
    'MovementLedger', 'Formation', 'FormationSlot', 'MatchLineup', 'MatchLineupAssignment',
    'PlayerPosition', 'Warning', 'PlayerLock', 'SelectionAudit', 'DecisionRecord',
    'CoachingIntent', 'PostMatchReport', 'PostMatchPlayerActual', 'Goal', 'Assist',
    'MatchReportAbsence', 'MatchReportPlayerStat', 'PlayerReadinessSignal', 'MatchExecutionFeedback',
    'TeamReflection', 'OpponentEncounterObservation', 'SelectionExplanation', 'MovementCandidate',
    'Event', 'EventPlayerAvailability', 'EventSquad', 'EventSquadPlayer', 'EventMatch',
    'EventPostMatchReport', 'EventPostMatchPlayer', 'EventGoalEvent', 'EventAssistEvent',
    'EventMatchSupportAssignment', 'EventMatchLineup', 'EventMatchLineupAssignment',
    'LeagueSeason', 'SeasonPeriodSnapshot', 'TeamSeasonSnapshot', 'TeamSeasonSnapshotPlayer',
    'PolicyDecisionLog',
    'Organisation', 'OrganisationMembership', 'OrganisationInvitation', 'TeamAccess', 'MachinePrincipal',
    'User', 'Account', 'Session', 'VerificationToken'
  ]) LOOP
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE %I TO matchboard_admin', tbl);
  END LOOP;
END $$;

-- Grant sequence permissions for auto-increment/serial columns
DO $$
DECLARE
  app_role_exists BOOLEAN;
  admin_role_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app') INTO app_role_exists;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_admin') INTO admin_role_exists;

  IF app_role_exists THEN
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO matchboard_app';
  END IF;

  IF admin_role_exists THEN
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO matchboard_admin';
  END IF;
END $$;

-- ============================================================
-- 5. Non-tenant tables: NO RLS policies
-- ============================================================
-- Organisation: tenant root, accessed through application-level auth
-- User, Account, Session, VerificationToken: Auth.js managed, no organisationId
-- TeamAccess: bridges org membership to teams, scoped through membership