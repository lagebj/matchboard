-- MT-2: Add nullable organisationId to core tenant-bearing models
-- Per ADR-0035 and ADR-0036, these columns start nullable and become NOT NULL after data migration.
-- Composite unique constraints are added alongside existing single-column constraints.

-- Player: belongs to exactly one organisation
ALTER TABLE "Player" ADD COLUMN "organisationId" TEXT;

-- OpponentTeam: organisation-scoped per ADR-0035
ALTER TABLE "OpponentTeam" ADD COLUMN "organisationId" TEXT;

-- LeagueSeason: organisation-scoped (same real-world league in two orgs = two records)
ALTER TABLE "LeagueSeason" ADD COLUMN "organisationId" TEXT;

-- Season: broad football-year context, organisation-scoped
ALTER TABLE "Season" ADD COLUMN "organisationId" TEXT;

-- Match: direct organisationId preferred over Match -> Team -> Organisation
ALTER TABLE "Match" ADD COLUMN "organisationId" TEXT;

-- MatchRound: direct organisationId preferred
ALTER TABLE "MatchRound" ADD COLUMN "organisationId" TEXT;

-- Availability: direct organisationId preferred
ALTER TABLE "Availability" ADD COLUMN "organisationId" TEXT;

-- Selection: direct organisationId preferred
ALTER TABLE "Selection" ADD COLUMN "organisationId" TEXT;

-- RotationPath: must validate both teams belong to same org
ALTER TABLE "RotationPath" ADD COLUMN "organisationId" TEXT;

-- MovementLedger: direct organisationId preferred
ALTER TABLE "MovementLedger" ADD COLUMN "organisationId" TEXT;

-- Formation: direct organisationId preferred
ALTER TABLE "Formation" ADD COLUMN "organisationId" TEXT;

-- FormationSlot: direct organisationId preferred
ALTER TABLE "FormationSlot" ADD COLUMN "organisationId" TEXT;

-- MatchLineup: direct organisationId preferred
ALTER TABLE "MatchLineup" ADD COLUMN "organisationId" TEXT;

-- MatchLineupAssignment: direct organisationId preferred
ALTER TABLE "MatchLineupAssignment" ADD COLUMN "organisationId" TEXT;

-- PlayerPosition: direct organisationId preferred
ALTER TABLE "PlayerPosition" ADD COLUMN "organisationId" TEXT;

-- Warning: direct organisationId preferred
ALTER TABLE "Warning" ADD COLUMN "organisationId" TEXT;

-- PlayerLock: direct organisationId preferred
ALTER TABLE "PlayerLock" ADD COLUMN "organisationId" TEXT;

-- SelectionAudit: direct organisationId preferred
ALTER TABLE "SelectionAudit" ADD COLUMN "organisationId" TEXT;

-- DecisionRecord: organisation-scoped audit
ALTER TABLE "DecisionRecord" ADD COLUMN "organisationId" TEXT;

-- CoachingIntent: direct organisationId preferred
ALTER TABLE "CoachingIntent" ADD COLUMN "organisationId" TEXT;

-- PostMatchReport: direct organisationId preferred
ALTER TABLE "PostMatchReport" ADD COLUMN "organisationId" TEXT;

-- PostMatchPlayerActual: direct organisationId preferred
ALTER TABLE "PostMatchPlayerActual" ADD COLUMN "organisationId" TEXT;

-- Goal: direct organisationId preferred
ALTER TABLE "Goal" ADD COLUMN "organisationId" TEXT;

-- Assist: direct organisationId preferred
ALTER TABLE "Assist" ADD COLUMN "organisationId" TEXT;

-- MatchReportAbsence: direct organisationId preferred
ALTER TABLE "MatchReportAbsence" ADD COLUMN "organisationId" TEXT;

-- MatchReportPlayerStat: direct organisationId preferred
ALTER TABLE "MatchReportPlayerStat" ADD COLUMN "organisationId" TEXT;

-- PlayerReadinessSignal: direct organisationId preferred
ALTER TABLE "PlayerReadinessSignal" ADD COLUMN "organisationId" TEXT;

-- MatchExecutionFeedback: direct organisationId preferred
ALTER TABLE "MatchExecutionFeedback" ADD COLUMN "organisationId" TEXT;

-- TeamReflection: direct organisationId preferred
ALTER TABLE "TeamReflection" ADD COLUMN "organisationId" TEXT;

-- OpponentEncounterObservation: direct organisationId preferred
ALTER TABLE "OpponentEncounterObservation" ADD COLUMN "organisationId" TEXT;

-- SelectionExplanation: direct organisationId preferred
ALTER TABLE "SelectionExplanation" ADD COLUMN "organisationId" TEXT;

-- MovementCandidate: direct organisationId preferred
ALTER TABLE "MovementCandidate" ADD COLUMN "organisationId" TEXT;

-- Event: organisation-scoped
ALTER TABLE "Event" ADD COLUMN "organisationId" TEXT;

-- EventPlayerAvailability: direct organisationId preferred
ALTER TABLE "EventPlayerAvailability" ADD COLUMN "organisationId" TEXT;

-- EventSquad: direct organisationId preferred
ALTER TABLE "EventSquad" ADD COLUMN "organisationId" TEXT;

-- EventSquadPlayer: direct organisationId preferred
ALTER TABLE "EventSquadPlayer" ADD COLUMN "organisationId" TEXT;

-- EventMatch: direct organisationId preferred
ALTER TABLE "EventMatch" ADD COLUMN "organisationId" TEXT;

-- EventPostMatchReport: direct organisationId preferred
ALTER TABLE "EventPostMatchReport" ADD COLUMN "organisationId" TEXT;

-- EventPostMatchPlayer: direct organisationId preferred
ALTER TABLE "EventPostMatchPlayer" ADD COLUMN "organisationId" TEXT;

-- EventGoalEvent: direct organisationId preferred
ALTER TABLE "EventGoalEvent" ADD COLUMN "organisationId" TEXT;

-- EventAssistEvent: direct organisationId preferred
ALTER TABLE "EventAssistEvent" ADD COLUMN "organisationId" TEXT;

-- EventMatchSupportAssignment: direct organisationId preferred
ALTER TABLE "EventMatchSupportAssignment" ADD COLUMN "organisationId" TEXT;

-- EventMatchLineup: direct organisationId preferred
ALTER TABLE "EventMatchLineup" ADD COLUMN "organisationId" TEXT;

-- EventMatchLineupAssignment: direct organisationId preferred
ALTER TABLE "EventMatchLineupAssignment" ADD COLUMN "organisationId" TEXT;

-- SeasonPeriodSnapshot: direct organisationId preferred
ALTER TABLE "SeasonPeriodSnapshot" ADD COLUMN "organisationId" TEXT;

-- TeamSeasonSnapshot: direct organisationId preferred
ALTER TABLE "TeamSeasonSnapshot" ADD COLUMN "organisationId" TEXT;

-- TeamSeasonSnapshotPlayer: direct organisationId preferred
ALTER TABLE "TeamSeasonSnapshotPlayer" ADD COLUMN "organisationId" TEXT;

-- PolicyDecisionLog: organisation-scoped audit
ALTER TABLE "PolicyDecisionLog" ADD COLUMN "organisationId" TEXT;

-- RuleConfig: organisation-scoped configuration
ALTER TABLE "RuleConfig" ADD COLUMN "organisationId" TEXT;

-- Composite unique constraints (alongside existing single-column constraints)
-- These enforce that Player.playerCode, OpponentTeam.normalizedName, and LeagueSeason name
-- are unique within an organisation, not globally.

-- Player: @@unique([organisationId, playerCode])
CREATE UNIQUE INDEX "Player_organisationId_playerCode_key" ON "Player"("organisationId", "playerCode");

-- OpponentTeam: @@unique([organisationId, normalizedName])
CREATE UNIQUE INDEX "OpponentTeam_organisationId_normalizedName_key" ON "OpponentTeam"("organisationId", "normalizedName");

-- LeagueSeason: @@unique([organisationId, name])
CREATE UNIQUE INDEX "LeagueSeason_organisationId_name_key" ON "LeagueSeason"("organisationId", "name");

-- Foreign keys to Organisation
ALTER TABLE "Player" ADD CONSTRAINT "Player_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpponentTeam" ADD CONSTRAINT "OpponentTeam_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeagueSeason" ADD CONSTRAINT "LeagueSeason_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Season" ADD CONSTRAINT "Season_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchRound" ADD CONSTRAINT "MatchRound_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RotationPath" ADD CONSTRAINT "RotationPath_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MovementLedger" ADD CONSTRAINT "MovementLedger_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormationSlot" ADD CONSTRAINT "FormationSlot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchLineupAssignment" ADD CONSTRAINT "MatchLineupAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerPosition" ADD CONSTRAINT "PlayerPosition_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerLock" ADD CONSTRAINT "PlayerLock_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SelectionAudit" ADD CONSTRAINT "SelectionAudit_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisionRecord" ADD CONSTRAINT "DecisionRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoachingIntent" ADD CONSTRAINT "CoachingIntent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostMatchReport" ADD CONSTRAINT "PostMatchReport_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostMatchPlayerActual" ADD CONSTRAINT "PostMatchPlayerActual_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assist" ADD CONSTRAINT "Assist_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchReportAbsence" ADD CONSTRAINT "MatchReportAbsence_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchReportPlayerStat" ADD CONSTRAINT "MatchReportPlayerStat_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerReadinessSignal" ADD CONSTRAINT "PlayerReadinessSignal_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchExecutionFeedback" ADD CONSTRAINT "MatchExecutionFeedback_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamReflection" ADD CONSTRAINT "TeamReflection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpponentEncounterObservation" ADD CONSTRAINT "OpponentEncounterObservation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SelectionExplanation" ADD CONSTRAINT "SelectionExplanation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MovementCandidate" ADD CONSTRAINT "MovementCandidate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventPlayerAvailability" ADD CONSTRAINT "EventPlayerAvailability_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventSquad" ADD CONSTRAINT "EventSquad_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventSquadPlayer" ADD CONSTRAINT "EventSquadPlayer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventMatch" ADD CONSTRAINT "EventMatch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventPostMatchReport" ADD CONSTRAINT "EventPostMatchReport_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventPostMatchPlayer" ADD CONSTRAINT "EventPostMatchPlayer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventGoalEvent" ADD CONSTRAINT "EventGoalEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventAssistEvent" ADD CONSTRAINT "EventAssistEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventMatchSupportAssignment" ADD CONSTRAINT "EventMatchSupportAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventMatchLineup" ADD CONSTRAINT "EventMatchLineup_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventMatchLineupAssignment" ADD CONSTRAINT "EventMatchLineupAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeasonPeriodSnapshot" ADD CONSTRAINT "SeasonPeriodSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamSeasonSnapshot" ADD CONSTRAINT "TeamSeasonSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamSeasonSnapshotPlayer" ADD CONSTRAINT "TeamSeasonSnapshotPlayer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PolicyDecisionLog" ADD CONSTRAINT "PolicyDecisionLog_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RuleConfig" ADD CONSTRAINT "RuleConfig_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes for organisationId on high-traffic tables
CREATE INDEX "Player_organisationId_idx" ON "Player"("organisationId");
CREATE INDEX "Match_organisationId_idx" ON "Match"("organisationId");
CREATE INDEX "Selection_organisationId_idx" ON "Selection"("organisationId");
CREATE INDEX "MatchRound_organisationId_idx" ON "MatchRound"("organisationId");
CREATE INDEX "Event_organisationId_idx" ON "Event"("organisationId");