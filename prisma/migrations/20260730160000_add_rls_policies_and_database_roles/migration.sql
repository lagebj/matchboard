-- MT-3: Row-level security policies and database role isolation
-- Per ADR-0037: application-level tenant enforcement + PostgreSQL RLS as defence in depth
-- Runtime role (matchboard_app) cannot bypass RLS; admin role (matchboard_admin) can bypass for migrations

-- ============================================================
-- 1. Create database roles
-- ============================================================
-- matchboard_admin: owns tables, runs migrations, has BYPASSRLS
-- matchboard_app: runtime role for Next.js application, restricted by RLS

-- Note: Role creation requires superuser. In Neon, roles are created through the Neon dashboard or CLI.
-- These CREATE ROLE statements are idempotent and should be run by a superuser during setup.
-- In practice, roles will be created through Neon dashboard and credentials configured via environment variables.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'matchboard_admin') THEN
    CREATE ROLE matchboard_admin WITH LOGIN PASSWORD 'CHANGE_ME_ADMIN' BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'matchboard_app') THEN
    CREATE ROLE matchboard_app WITH LOGIN PASSWORD 'CHANGE_ME_APP' NOBYPASSRLS;
  END IF;
END $$;

-- Grant matchboard_admin ownership of all tenant-bearing tables
-- matchboard_admin needs full access for migrations
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
    'Organisation', 'OrganisationMembership', 'OrganisationInvitation', 'TeamAccess', 'MachinePrincipal',
    'User', 'Account', 'Session', 'VerificationToken'
  ]) LOOP
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE %I TO matchboard_admin', tbl);
  END LOOP;
END $$;

-- Grant matchboard_app read/write access to tenant-bearing tables
-- This role is restricted by RLS policies
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
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO matchboard_app', tbl);
  END LOOP;
END $$;

-- Grant matchboard_app full access to non-tenant auth/org tables (no RLS needed)
-- Organisation: needs read/write for org lookup and management
-- User, Account, Session, VerificationToken: auth infrastructure (Auth.js manages these)
-- TeamAccess: bridges org membership to teams, always scoped through org membership
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Organisation" TO matchboard_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "User" TO matchboard_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Account" TO matchboard_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Session" TO matchboard_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "VerificationToken" TO matchboard_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "TeamAccess" TO matchboard_app;

-- Grant sequence permissions for auto-increment/serial columns
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO matchboard_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO matchboard_admin;

-- ============================================================
-- 2. Enable RLS on all tenant-bearing tables
-- ============================================================
-- These tables have organisationId and represent tenant data.
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
-- 3. Create RLS policies
-- ============================================================
-- Policy naming: {table}_tenant_read, {table}_tenant_write, {table}_admin_all

-- Helper function to create policies for a table
-- Read policy: USING (organisationId matches current tenant OR null rows during migration)
-- Write policy: WITH CHECK (organisationId matches current tenant)
-- Admin policy: ALL operations for matchboard_admin role

DO $$
DECLARE
  tbl TEXT;
  read_policy TEXT;
  write_policy TEXT;
  admin_policy TEXT;
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
    read_policy := tbl || '_tenant_read';
    write_policy := tbl || '_tenant_write';
    admin_policy := tbl || '_admin_all';

    -- Read policy: allows SELECT when organisationId matches current tenant
    -- Also allows reading rows with NULL organisationId during migration period
    -- (temporary null-allowing clause will be removed after NOT NULL constraint)
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO matchboard_app USING (
        "organisationId" = current_setting(''app.current_organization_id'', true)
        OR ("organisationId" IS NULL AND current_setting(''app.current_organization_id'', true) = '''')
      )',
      read_policy, tbl
    );

    -- Write policy: allows INSERT/UPDATE/DELETE when organisationId matches current tenant
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO matchboard_app WITH CHECK (
        "organisationId" = current_setting(''app.current_organization_id'', true)
      )',
      write_policy, tbl
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

    -- Admin bypass policy: matchboard_admin can do everything
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO matchboard_admin USING (true) WITH CHECK (true)',
      admin_policy, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- 4. Force RLS even for table owners
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
-- 5. Grant table owner role to matchboard_admin
-- ============================================================
-- The migration role needs to own tables for schema migrations.
-- In Neon, the neondb_admin role typically owns tables created by Prisma migrations.
-- matchboard_admin will be granted membership in the table owner role.

-- Note: In Neon, tables are typically owned by the role that ran CREATE TABLE.
-- Prisma migrations run with DIRECT_URL credentials. We need matchboard_admin
-- to be able to manage these tables. The GRANT statements above handle data access.
-- For DDL operations (ALTER TABLE, etc.), matchboard_admin needs table ownership
-- or appropriate privileges, which are typically inherited from the migration role.

-- ============================================================
-- 6. Non-tenant tables: NO RLS policies
-- ============================================================
-- Organisation: The tenant root. Access is controlled by application-level
--   membership checks. RLS on Organisation would create a circular dependency
--   (need to look up org membership before setting tenant context).
-- User, Account, Session, VerificationToken: Auth.js managed tables.
--   Access controlled by Auth.js. No organisationId column.
-- TeamAccess: Bridges org membership to teams. Always accessed through
--   org membership context. Has organisationId via OrganisationMembership.
--   RLS is not applied because TeamAccess rows are looked up via membership,
--   not directly by organisationId.