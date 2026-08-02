-- MT-4: Neon role isolation and RLS policy update
-- Per ADR-0037 update: Console-created Neon roles inherit BYPASSRLS from neon_superuser,
-- making RLS ineffective. This migration creates SQL-managed replacement roles and
-- migrates policies, ownership, and privileges to the new roles.
--
-- New role architecture:
-- - matchboard_app_runtime: runtime queries, NOBYPASSRLS, NOINHERIT, NOCREATEDB, NOCREATEROLE, NOREPLICATION
--   Tenant context set via SET LOCAL app.current_organization_id in transactions.
--   RLS policies enforce organisation-scoped access.
-- - matchboard_admin_migration: schema migrations, NOBYPASSRLS, NOINHERIT, NOCREATEDB, NOCREATEROLE, NOREPLICATION
--   Has ALL privileges on all tables. RLS policies allow full access (USING true, WITH CHECK true).
--   BYPASSRLS is NOT needed because the admin_all policy grants full access through RLS.
--
-- Legacy roles (matchboard_app, matchboard_admin) remain in the database but are no longer
-- used by the application. They inherit BYPASSRLS from neon_superuser and cannot be
-- modified via SQL on Neon. Connection strings should be updated to use the new roles.
--
-- Prerequisite: This migration must be run by neondb_owner (or a role that can SET ROLE
-- to matchboard_admin_migration). The neondb_owner has been granted membership in the
-- new roles to enable ownership transfer.
--
-- See: docs/adr/0037-row-level-security-and-database-role-isolation.md

-- ============================================================
-- 1. Create SQL-managed replacement roles (idempotent)
-- ============================================================
-- These roles are created without BYPASSRLS, NOINHERIT, and other restricted attributes.
-- They do NOT inherit from neon_superuser, so RLS policies are enforced.

DO $$
BEGIN
  -- matchboard_app_runtime: restricted runtime role
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app_runtime') THEN
    CREATE ROLE matchboard_app_runtime WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    RAISE NOTICE 'Created matchboard_app_runtime role';
  ELSE
    RAISE NOTICE 'matchboard_app_runtime role already exists';
  END IF;

  -- matchboard_admin_migration: migration role (NOBYPASSRLS — admin_all policy grants full access)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_admin_migration') THEN
    CREATE ROLE matchboard_admin_migration WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;
    RAISE NOTICE 'Created matchboard_admin_migration role';
  ELSE
    RAISE NOTICE 'matchboard_admin_migration role already exists';
  END IF;
END $$;

-- ============================================================
-- 2. Grant neondb_owner membership in new roles (for ownership transfer)
-- ============================================================
-- Required so that neondb_owner (which runs Prisma migrations) can transfer
-- object ownership to matchboard_admin_migration.

DO $$
BEGIN
  -- Grant membership so ownership transfer works
  PERFORM dblink_exec(format('grant_%s', gen_random_uuid()), '');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

GRANT matchboard_admin_migration TO neondb_owner;
GRANT matchboard_app_runtime TO neondb_owner;

-- ============================================================
-- 3. Grant database and schema access
-- ============================================================

GRANT CONNECT ON DATABASE neondb TO matchboard_app_runtime;
GRANT CONNECT ON DATABASE neondb TO matchboard_admin_migration;
GRANT USAGE ON SCHEMA public TO matchboard_app_runtime;
GRANT USAGE, CREATE ON SCHEMA public TO matchboard_admin_migration;

-- ============================================================
-- 4. Transfer object ownership to matchboard_admin_migration
-- ============================================================
-- All tables, enums, and sequences owned by neondb_owner are transferred to
-- matchboard_admin_migration. This ensures that FORCE ROW LEVEL SECURITY
-- applies to the owner, and the admin role relies on its admin_all policy
-- rather than ownership bypass.

DO $$
DECLARE
  tbl TEXT;
  seq RECORD;
  typ TEXT;
BEGIN
  -- Transfer table ownership
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = 'neondb_owner'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I OWNER TO matchboard_admin_migration', 'public', tbl);
  END LOOP;

  -- Transfer enum type ownership
  FOR typ IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
      AND pg_get_userbyid(t.typowner) = 'neondb_owner'
  LOOP
    EXECUTE format('ALTER TYPE %I.%I OWNER TO matchboard_admin_migration', 'public', typ.typname);
  END LOOP;

  -- Transfer sequence ownership
  FOR seq IN
    SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO matchboard_admin_migration', 'public', seq.sequencename);
  END LOOP;
END $$;

-- ============================================================
-- 5. Grant table-level privileges
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO matchboard_app_runtime', 'public', tbl);
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE %I.%I TO matchboard_admin_migration', 'public', tbl);
  END LOOP;
END $$;

-- Grant sequence access
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO matchboard_app_runtime;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO matchboard_admin_migration;

-- Grant type access
DO $$
DECLARE
  typ TEXT;
BEGIN
  FOR typ IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
  LOOP
    EXECUTE format('GRANT USAGE ON TYPE %I.%I TO matchboard_app_runtime', 'public', typ.typname);
    EXECUTE format('GRANT ALL PRIVILEGES ON TYPE %I.%I TO matchboard_admin_migration', 'public', typ.typname);
  END LOOP;
END $$;

-- ============================================================
-- 6. Enable and force RLS on additional tenant-bearing tables
-- ============================================================
-- These tables were not in the original RLS migration but have organisationId.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'FairPlayObservation', 'LiveMatchEvent', 'LiveMatchSession', 'MatchRotation',
    'NotificationOutbox', 'OpponentSportingEvidence', 'PlayerDevelopmentObservation',
    'PlayerProfileSuggestion', 'ReviewRequest', 'WorkOwnership'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- ============================================================
-- 7. Drop legacy role policies and create new role policies
-- ============================================================
-- Replace matchboard_app and matchboard_admin policies with matchboard_app_runtime
-- and matchboard_admin_migration policies.

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
  app_role_exists BOOLEAN;
  admin_role_exists BOOLEAN;
  new_app_role_exists BOOLEAN;
  new_admin_role_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app') INTO app_role_exists;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_admin') INTO admin_role_exists;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_app_runtime') INTO new_app_role_exists;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matchboard_admin_migration') INTO new_admin_role_exists;

  -- Drop legacy policies for matchboard_app
  IF app_role_exists THEN
    FOR pol IN
      SELECT p.polname, c.relname
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND EXISTS (SELECT 1 FROM pg_roles r2 WHERE r2.oid = ANY(p.polroles) AND r2.rolname = 'matchboard_app')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.polname, pol.relname);
    END LOOP;
  END IF;

  -- Drop legacy policies for matchboard_admin
  IF admin_role_exists THEN
    FOR pol IN
      SELECT p.polname, c.relname
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND EXISTS (SELECT 1 FROM pg_roles r2 WHERE r2.oid = ANY(p.polroles) AND r2.rolname = 'matchboard_admin')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.polname, pol.relname);
    END LOOP;
  END IF;

  -- Create new policies for matchboard_app_runtime and matchboard_admin_migration
  IF new_app_role_exists AND new_admin_role_exists THEN
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
      -- Tables added in this migration
      'FairPlayObservation', 'LiveMatchEvent', 'LiveMatchSession', 'MatchRotation',
      'NotificationOutbox', 'OpponentSportingEvidence', 'PlayerDevelopmentObservation',
      'PlayerProfileSuggestion', 'ReviewRequest', 'WorkOwnership'
    ]) LOOP
      -- Tenant-scoped policies for matchboard_app_runtime
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO matchboard_app_runtime USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR ("organisationId" IS NULL AND current_setting(''app.current_organization_id'', true) = '''')
        )',
        tbl || '_tenant_read', tbl
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I FOR INSERT TO matchboard_app_runtime WITH CHECK (
          "organisationId" = current_setting(''app.current_organization_id'', true)
        )',
        tbl || '_tenant_insert', tbl
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I FOR UPDATE TO matchboard_app_runtime USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
        ) WITH CHECK (
          "organisationId" = current_setting(''app.current_organization_id'', true)
        )',
        tbl || '_tenant_update', tbl
      );

      EXECUTE format(
        'CREATE POLICY %I ON %I FOR DELETE TO matchboard_app_runtime USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
        )',
        tbl || '_tenant_delete', tbl
      );

      -- Admin bypass policy for matchboard_admin_migration
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO matchboard_admin_migration USING (true) WITH CHECK (true)',
        tbl || '_admin_all', tbl
      );
    END LOOP;
  END IF;
END $$;

-- ============================================================
-- 8. Set up default privileges for future objects
-- ============================================================
-- When matchboard_admin_migration creates new tables (via Prisma migrations),
-- matchboard_app_runtime should automatically get DML privileges.

ALTER DEFAULT PRIVILEGES FOR ROLE matchboard_admin_migration IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO matchboard_app_runtime;

ALTER DEFAULT PRIVILEGES FOR ROLE matchboard_admin_migration IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO matchboard_app_runtime;

ALTER DEFAULT PRIVILEGES FOR ROLE matchboard_admin_migration IN SCHEMA public
  GRANT USAGE ON TYPES TO matchboard_app_runtime;

-- Also for neondb_owner (in case migrations run as neondb_owner)
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO matchboard_app_runtime;

ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO matchboard_app_runtime;

ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE ON TYPES TO matchboard_app_runtime;

-- ============================================================
-- 9. Non-tenant tables: NO RLS policies
-- ============================================================
-- These tables do not have organisationId and are managed differently:
-- Organisation: root tenant entity, accessed through application-level auth
-- User, Account, Session, VerificationToken: Auth.js managed
-- TeamAccess: bridges org membership to teams
-- NotificationDelivery: delivery tracking, linked via outbox
-- PlayerProfileSuggestionEvidence: linked through suggestion, no direct orgId
-- ProviderWebhookEvent: webhook processing, no tenant scope
-- _prisma_migrations: Prisma internal, no tenant scope

-- Note: matchboard_app_runtime and matchboard_admin_migration are granted
-- table-level privileges on ALL tables (including non-tenant tables) above.
-- Access control for non-tenant tables is handled entirely by application-level
-- auth (requireCoachAccess/requireActorContext).