-- RLS policies: make tenant policies permissive when app.current_organization_id is not set
--
-- The application now uses where-clause injection (Prisma extension) as the PRIMARY
-- tenant isolation mechanism, not SET LOCAL session variables. This is because the
-- Neon WebSocket adapter does not reliably preserve SET LOCAL session state between
-- raw SQL and model queries inside $transaction().
--
-- Database RLS policies serve as defense-in-depth: when app.current_organization_id
-- IS set, RLS enforces tenant scoping. When it is NOT set (empty string or null),
-- the application-layer filtering is trusted and RLS allows all rows through.
--
-- This migration recreates ALL tenant-scoped RLS policies on organisation-owned tables
-- to include the permissive fallback. Policies for tables without organisationId
-- (GroupAccess, Organisation, OrganisationMembership) use join-based or
-- identity-based policies and are handled separately.
--
-- There are two runtime role variants: matchboard_app (earlier) and
-- matchboard_app_runtime (current). We handle both idempotently.

DO $$
DECLARE
  tbl TEXT;
  policy_name TEXT;
  role_name TEXT;
BEGIN
  -- Tables with direct organisationId column
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
    'OrganisationInvitation', 'MachinePrincipal',
    'FootballGroup', 'FootballGroupPlayer', 'GroupMovementPath',
    'ReviewRequest', 'NotificationOutbox', 'WorkOwnership',
    'LiveMatchSession', 'LiveMatchEvent', 'MatchRotation',
    'FairPlayObservation', 'OpponentSportingEvidence',
    'PlayerDevelopmentObservation', 'PlayerProfileSuggestion'
  ]) LOOP
    -- Handle both role name variants
    FOR role_name IN SELECT unnest(ARRAY['matchboard_app', 'matchboard_app_runtime']) LOOP
      -- Drop and recreate each tenant policy type
      FOR policy_name IN SELECT unnest(ARRAY['_tenant_read', '_tenant_insert', '_tenant_update', '_tenant_delete']) LOOP
        BEGIN
          EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || policy_name, tbl);
        EXCEPTION WHEN others THEN
          -- Policy doesn't exist or wrong role, skip
          NULL;
        END;
      END LOOP;

      -- Only create policies if the role exists
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        -- Read policy
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR SELECT TO %I USING (
            "organisationId" = current_setting(''app.current_organization_id'', true)
            OR current_setting(''app.current_organization_id'', true) IS NULL
            OR current_setting(''app.current_organization_id'', true) = ''''
          )',
          tbl || '_tenant_read', tbl, role_name
        );

        -- Insert policy
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR INSERT TO %I WITH CHECK (
            "organisationId" = current_setting(''app.current_organization_id'', true)
            OR current_setting(''app.current_organization_id'', true) IS NULL
            OR current_setting(''app.current_organization_id'', true) = ''''
          )',
          tbl || '_tenant_insert', tbl, role_name
        );

        -- Update policy
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR UPDATE TO %I USING (
            "organisationId" = current_setting(''app.current_organization_id'', true)
            OR current_setting(''app.current_organization_id'', true) IS NULL
            OR current_setting(''app.current_organization_id'', true) = ''''
          ) WITH CHECK (
            "organisationId" = current_setting(''app.current_organization_id'', true)
            OR current_setting(''app.current_organization_id'', true) IS NULL
            OR current_setting(''app.current_organization_id'', true) = ''''
          )',
          tbl || '_tenant_update', tbl, role_name
        );

        -- Delete policy
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR DELETE TO %I USING (
            "organisationId" = current_setting(''app.current_organization_id'', true)
            OR current_setting(''app.current_organization_id'', true) IS NULL
            OR current_setting(''app.current_organization_id'', true) = ''''
          )',
          tbl || '_tenant_delete', tbl, role_name
        );
      END IF;
    END LOOP;
  END LOOP;

  -- OrganisationMembership: recreate tenant policies with permissive fallback
  -- Keep self-read policy (added in 20260804140000) as-is
  FOR role_name IN SELECT unnest(ARRAY['matchboard_app', 'matchboard_app_runtime']) LOOP
    FOR policy_name IN SELECT unnest(ARRAY['_tenant_read', '_tenant_insert', '_tenant_update', '_tenant_delete']) LOOP
      BEGIN
        EXECUTE format('DROP POLICY IF EXISTS %I ON "OrganisationMembership"', 'OrganisationMembership' || policy_name);
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END LOOP;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'CREATE POLICY %I ON "OrganisationMembership" FOR SELECT TO %I USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        'OrganisationMembership_tenant_read', role_name
      );

      EXECUTE format(
        'CREATE POLICY %I ON "OrganisationMembership" FOR INSERT TO %I WITH CHECK (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        'OrganisationMembership_tenant_insert', role_name
      );

      EXECUTE format(
        'CREATE POLICY %I ON "OrganisationMembership" FOR UPDATE TO %I USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        ) WITH CHECK (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        'OrganisationMembership_tenant_update', role_name
      );

      EXECUTE format(
        'CREATE POLICY %I ON "OrganisationMembership" FOR DELETE TO %I USING (
          "organisationId" = current_setting(''app.current_organization_id'', true)
          OR current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
        )',
        'OrganisationMembership_tenant_delete', role_name
      );
    END IF;
  END LOOP;

  -- GroupAccess: recreate join-based policies with permissive fallback
  FOR role_name IN SELECT unnest(ARRAY['matchboard_app', 'matchboard_app_runtime']) LOOP
    FOR policy_name IN SELECT unnest(ARRAY['_tenant_read', '_tenant_insert', '_tenant_update', '_tenant_delete']) LOOP
      BEGIN
        EXECUTE format('DROP POLICY IF EXISTS %I ON "GroupAccess"', 'GroupAccess' || policy_name);
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END LOOP;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      -- The permissive fallback for GroupAccess is: when app context is not set,
      -- allow all access (application-level filtering handles it).
      -- When set, require the associated FootballGroup to belong to the organisation.
      EXECUTE format(
        'CREATE POLICY %I ON "GroupAccess" FOR SELECT TO %I USING (
          current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
          OR EXISTS (
            SELECT 1 FROM "FootballGroup"
            WHERE "FootballGroup"."id" = "GroupAccess"."footballGroupId"
              AND "FootballGroup"."organisationId" = current_setting(''app.current_organization_id'', true)
          )
        )',
        'GroupAccess_tenant_read', role_name
      );

      EXECUTE format(
        'CREATE POLICY %I ON "GroupAccess" FOR INSERT TO %I WITH CHECK (
          current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
          OR EXISTS (
            SELECT 1 FROM "FootballGroup"
            WHERE "FootballGroup"."id" = "GroupAccess"."footballGroupId"
              AND "FootballGroup"."organisationId" = current_setting(''app.current_organization_id'', true)
          )
        )',
        'GroupAccess_tenant_insert', role_name
      );

      EXECUTE format(
        'CREATE POLICY %I ON "GroupAccess" FOR UPDATE TO %I USING (
          current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
          OR EXISTS (
            SELECT 1 FROM "FootballGroup"
            WHERE "FootballGroup"."id" = "GroupAccess"."footballGroupId"
              AND "FootballGroup"."organisationId" = current_setting(''app.current_organization_id'', true)
          )
        ) WITH CHECK (
          current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
          OR EXISTS (
            SELECT 1 FROM "FootballGroup"
            WHERE "FootballGroup"."id" = "GroupAccess"."footballGroupId"
              AND "FootballGroup"."organisationId" = current_setting(''app.current_organization_id'', true)
          )
        )',
        'GroupAccess_tenant_update', role_name
      );

      EXECUTE format(
        'CREATE POLICY %I ON "GroupAccess" FOR DELETE TO %I USING (
          current_setting(''app.current_organization_id'', true) IS NULL
          OR current_setting(''app.current_organization_id'', true) = ''''
          OR EXISTS (
            SELECT 1 FROM "FootballGroup"
            WHERE "FootballGroup"."id" = "GroupAccess"."footballGroupId"
              AND "FootballGroup"."organisationId" = current_setting(''app.current_organization_id'', true)
          )
        )',
        'GroupAccess_tenant_delete', role_name
      );
    END IF;
  END LOOP;
END $$;