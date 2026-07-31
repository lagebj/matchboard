-- MT-7: Change all organisationId FKs from RESTRICT/SET NULL to ON DELETE CASCADE
-- Per ADR-0035/0036: deleting an Organisation cascades to all tenant data.
-- OrganisationMembership, OrganisationInvitation, MachinePrincipal already have CASCADE (skip).
-- All organisationId columns are nullable; rows with NULL organisationId are unaffected by cascade.

-- Team: was ON DELETE SET NULL, now ON DELETE CASCADE
ALTER TABLE "Team" DROP CONSTRAINT "Team_organisationId_fkey";
ALTER TABLE "Team" ADD CONSTRAINT "Team_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 49 core models: were ON DELETE RESTRICT, now ON DELETE CASCADE
ALTER TABLE "Player" DROP CONSTRAINT "Player_organisationId_fkey";
ALTER TABLE "Player" ADD CONSTRAINT "Player_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpponentTeam" DROP CONSTRAINT "OpponentTeam_organisationId_fkey";
ALTER TABLE "OpponentTeam" ADD CONSTRAINT "OpponentTeam_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeagueSeason" DROP CONSTRAINT "LeagueSeason_organisationId_fkey";
ALTER TABLE "LeagueSeason" ADD CONSTRAINT "LeagueSeason_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Season" DROP CONSTRAINT "Season_organisationId_fkey";
ALTER TABLE "Season" ADD CONSTRAINT "Season_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Match" DROP CONSTRAINT "Match_organisationId_fkey";
ALTER TABLE "Match" ADD CONSTRAINT "Match_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchRound" DROP CONSTRAINT "MatchRound_organisationId_fkey";
ALTER TABLE "MatchRound" ADD CONSTRAINT "MatchRound_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Availability" DROP CONSTRAINT "Availability_organisationId_fkey";
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Selection" DROP CONSTRAINT "Selection_organisationId_fkey";
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RotationPath" DROP CONSTRAINT "RotationPath_organisationId_fkey";
ALTER TABLE "RotationPath" ADD CONSTRAINT "RotationPath_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MovementLedger" DROP CONSTRAINT "MovementLedger_organisationId_fkey";
ALTER TABLE "MovementLedger" ADD CONSTRAINT "MovementLedger_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Formation" DROP CONSTRAINT "Formation_organisationId_fkey";
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FormationSlot" DROP CONSTRAINT "FormationSlot_organisationId_fkey";
ALTER TABLE "FormationSlot" ADD CONSTRAINT "FormationSlot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchLineup" DROP CONSTRAINT "MatchLineup_organisationId_fkey";
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchLineupAssignment" DROP CONSTRAINT "MatchLineupAssignment_organisationId_fkey";
ALTER TABLE "MatchLineupAssignment" ADD CONSTRAINT "MatchLineupAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlayerPosition" DROP CONSTRAINT "PlayerPosition_organisationId_fkey";
ALTER TABLE "PlayerPosition" ADD CONSTRAINT "PlayerPosition_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Warning" DROP CONSTRAINT "Warning_organisationId_fkey";
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlayerLock" DROP CONSTRAINT "PlayerLock_organisationId_fkey";
ALTER TABLE "PlayerLock" ADD CONSTRAINT "PlayerLock_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SelectionAudit" DROP CONSTRAINT "SelectionAudit_organisationId_fkey";
ALTER TABLE "SelectionAudit" ADD CONSTRAINT "SelectionAudit_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DecisionRecord" DROP CONSTRAINT "DecisionRecord_organisationId_fkey";
ALTER TABLE "DecisionRecord" ADD CONSTRAINT "DecisionRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoachingIntent" DROP CONSTRAINT "CoachingIntent_organisationId_fkey";
ALTER TABLE "CoachingIntent" ADD CONSTRAINT "CoachingIntent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostMatchReport" DROP CONSTRAINT "PostMatchReport_organisationId_fkey";
ALTER TABLE "PostMatchReport" ADD CONSTRAINT "PostMatchReport_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostMatchPlayerActual" DROP CONSTRAINT "PostMatchPlayerActual_organisationId_fkey";
ALTER TABLE "PostMatchPlayerActual" ADD CONSTRAINT "PostMatchPlayerActual_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Goal" DROP CONSTRAINT "Goal_organisationId_fkey";
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assist" DROP CONSTRAINT "Assist_organisationId_fkey";
ALTER TABLE "Assist" ADD CONSTRAINT "Assist_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchReportAbsence" DROP CONSTRAINT "MatchReportAbsence_organisationId_fkey";
ALTER TABLE "MatchReportAbsence" ADD CONSTRAINT "MatchReportAbsence_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchReportPlayerStat" DROP CONSTRAINT "MatchReportPlayerStat_organisationId_fkey";
ALTER TABLE "MatchReportPlayerStat" ADD CONSTRAINT "MatchReportPlayerStat_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlayerReadinessSignal" DROP CONSTRAINT "PlayerReadinessSignal_organisationId_fkey";
ALTER TABLE "PlayerReadinessSignal" ADD CONSTRAINT "PlayerReadinessSignal_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchExecutionFeedback" DROP CONSTRAINT "MatchExecutionFeedback_organisationId_fkey";
ALTER TABLE "MatchExecutionFeedback" ADD CONSTRAINT "MatchExecutionFeedback_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamReflection" DROP CONSTRAINT "TeamReflection_organisationId_fkey";
ALTER TABLE "TeamReflection" ADD CONSTRAINT "TeamReflection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpponentEncounterObservation" DROP CONSTRAINT "OpponentEncounterObservation_organisationId_fkey";
ALTER TABLE "OpponentEncounterObservation" ADD CONSTRAINT "OpponentEncounterObservation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SelectionExplanation" DROP CONSTRAINT "SelectionExplanation_organisationId_fkey";
ALTER TABLE "SelectionExplanation" ADD CONSTRAINT "SelectionExplanation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MovementCandidate" DROP CONSTRAINT "MovementCandidate_organisationId_fkey";
ALTER TABLE "MovementCandidate" ADD CONSTRAINT "MovementCandidate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Event" DROP CONSTRAINT "Event_organisationId_fkey";
ALTER TABLE "Event" ADD CONSTRAINT "Event_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventPlayerAvailability" DROP CONSTRAINT "EventPlayerAvailability_organisationId_fkey";
ALTER TABLE "EventPlayerAvailability" ADD CONSTRAINT "EventPlayerAvailability_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventSquad" DROP CONSTRAINT "EventSquad_organisationId_fkey";
ALTER TABLE "EventSquad" ADD CONSTRAINT "EventSquad_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventSquadPlayer" DROP CONSTRAINT "EventSquadPlayer_organisationId_fkey";
ALTER TABLE "EventSquadPlayer" ADD CONSTRAINT "EventSquadPlayer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventMatch" DROP CONSTRAINT "EventMatch_organisationId_fkey";
ALTER TABLE "EventMatch" ADD CONSTRAINT "EventMatch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventPostMatchReport" DROP CONSTRAINT "EventPostMatchReport_organisationId_fkey";
ALTER TABLE "EventPostMatchReport" ADD CONSTRAINT "EventPostMatchReport_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventPostMatchPlayer" DROP CONSTRAINT "EventPostMatchPlayer_organisationId_fkey";
ALTER TABLE "EventPostMatchPlayer" ADD CONSTRAINT "EventPostMatchPlayer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventGoalEvent" DROP CONSTRAINT "EventGoalEvent_organisationId_fkey";
ALTER TABLE "EventGoalEvent" ADD CONSTRAINT "EventGoalEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventAssistEvent" DROP CONSTRAINT "EventAssistEvent_organisationId_fkey";
ALTER TABLE "EventAssistEvent" ADD CONSTRAINT "EventAssistEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventMatchSupportAssignment" DROP CONSTRAINT "EventMatchSupportAssignment_organisationId_fkey";
ALTER TABLE "EventMatchSupportAssignment" ADD CONSTRAINT "EventMatchSupportAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventMatchLineup" DROP CONSTRAINT "EventMatchLineup_organisationId_fkey";
ALTER TABLE "EventMatchLineup" ADD CONSTRAINT "EventMatchLineup_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventMatchLineupAssignment" DROP CONSTRAINT "EventMatchLineupAssignment_organisationId_fkey";
ALTER TABLE "EventMatchLineupAssignment" ADD CONSTRAINT "EventMatchLineupAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeasonPeriodSnapshot" DROP CONSTRAINT "SeasonPeriodSnapshot_organisationId_fkey";
ALTER TABLE "SeasonPeriodSnapshot" ADD CONSTRAINT "SeasonPeriodSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamSeasonSnapshot" DROP CONSTRAINT "TeamSeasonSnapshot_organisationId_fkey";
ALTER TABLE "TeamSeasonSnapshot" ADD CONSTRAINT "TeamSeasonSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamSeasonSnapshotPlayer" DROP CONSTRAINT "TeamSeasonSnapshotPlayer_organisationId_fkey";
ALTER TABLE "TeamSeasonSnapshotPlayer" ADD CONSTRAINT "TeamSeasonSnapshotPlayer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PolicyDecisionLog" DROP CONSTRAINT "PolicyDecisionLog_organisationId_fkey";
ALTER TABLE "PolicyDecisionLog" ADD CONSTRAINT "PolicyDecisionLog_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RuleConfig" DROP CONSTRAINT "RuleConfig_organisationId_fkey";
ALTER TABLE "RuleConfig" ADD CONSTRAINT "RuleConfig_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;