-- Add CHECK constraints for string-typed enum fields that lack database-level enforcement.
-- These values are validated at the application layer, but the database should also enforce them.

-- MatchRound.status: NOT_GENERATED, DRAFT, BLOCKED, READY, FINALIZED
ALTER TABLE "MatchRound" ADD CONSTRAINT "MatchRound_status_check" CHECK ("status" IN ('NOT_GENERATED', 'DRAFT', 'BLOCKED', 'READY', 'FINALIZED'));

-- PostMatchPlayerActual.attendanceStatus: PRESENT, NO_SHOW, UNKNOWN
ALTER TABLE "PostMatchPlayerActual" ADD CONSTRAINT "PostMatchPlayerActual_attendanceStatus_check" CHECK ("attendanceStatus" IN ('PRESENT', 'NO_SHOW', 'UNKNOWN'));

-- PostMatchPlayerActual.source: PLANNED, UNPLANNED, ADDED_POST_MATCH, EMERGENCY_BACKFILL, PLANNED_DRAFT, PLANNED_FINALIZED
ALTER TABLE "PostMatchPlayerActual" ADD CONSTRAINT "PostMatchPlayerActual_source_check" CHECK ("source" IN ('PLANNED', 'UNPLANNED', 'ADDED_POST_MATCH', 'EMERGENCY_BACKFILL', 'PLANNED_DRAFT', 'PLANNED_FINALIZED'));

-- Goal.type: NORMAL, OWN_GOAL, PENALTY
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_type_check" CHECK ("type" IN ('NORMAL', 'OWN_GOAL', 'PENALTY'));

-- Assist.type: NORMAL, SECONDARY
ALTER TABLE "Assist" ADD CONSTRAINT "Assist_type_check" CHECK ("type" IN ('NORMAL', 'SECONDARY'));

-- EventGoalEvent.type: NORMAL, OWN_GOAL, PENALTY
ALTER TABLE "EventGoalEvent" ADD CONSTRAINT "EventGoalEvent_type_check" CHECK ("type" IN ('NORMAL', 'OWN_GOAL', 'PENALTY'));

-- EventAssistEvent.type: NORMAL, SECONDARY
ALTER TABLE "EventAssistEvent" ADD CONSTRAINT "EventAssistEvent_type_check" CHECK ("type" IN ('NORMAL', 'SECONDARY'));

-- EventPostMatchPlayer.attendanceStatus: PRESENT, NO_SHOW, UNKNOWN, LATE_ADDITION, WITHDRAWN (nullable)
ALTER TABLE "EventPostMatchPlayer" ADD CONSTRAINT "EventPostMatchPlayer_attendanceStatus_check" CHECK ("attendanceStatus" IS NULL OR "attendanceStatus" IN ('PRESENT', 'NO_SHOW', 'UNKNOWN', 'LATE_ADDITION', 'WITHDRAWN'));

-- EventMatchSupportAssignment.plannedRole: GK cover, Defender cover, Midfield cover, Forward cover, General cover
ALTER TABLE "EventMatchSupportAssignment" ADD CONSTRAINT "EventMatchSupportAssignment_plannedRole_check" CHECK ("plannedRole" IS NULL OR "plannedRole" IN ('GK cover', 'Defender cover', 'Midfield cover', 'Forward cover', 'General cover'));