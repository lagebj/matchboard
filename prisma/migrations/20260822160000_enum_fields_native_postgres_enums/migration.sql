-- Convert remaining string-typed enum fields to real Postgres enums (ARR-0006,
-- platform-integrity-programme Phase 4). These 8 fields have been enforced by CHECK
-- constraints since 20260802120000_add_enum_check_constraints — every existing row already
-- satisfies the target enum's value set, so the USING casts below are safe.
--
-- MatchRound.status and EventPostMatchPlayer.role were investigated as part of this pass and
-- deliberately excluded: MatchRound.status is already a real MatchRoundStatus enum (done in an
-- earlier, undocumented pass); EventPostMatchPlayer.role is genuine free text interpolated at
-- write time ("Planned helper from {squad name}"), not a mis-typed enum.

-- CreateEnum
CREATE TYPE "PostMatchAttendanceStatus" AS ENUM ('PRESENT', 'NO_SHOW', 'UNKNOWN');
CREATE TYPE "EventPostMatchAttendanceStatus" AS ENUM ('PRESENT', 'NO_SHOW', 'UNKNOWN', 'LATE_ADDITION', 'WITHDRAWN');
CREATE TYPE "ParticipationSource" AS ENUM ('PLANNED', 'UNPLANNED', 'ADDED_POST_MATCH', 'EMERGENCY_BACKFILL', 'PLANNED_DRAFT', 'PLANNED_FINALIZED');
CREATE TYPE "GoalType" AS ENUM ('NORMAL', 'OWN_GOAL', 'PENALTY');
CREATE TYPE "AssistType" AS ENUM ('NORMAL', 'SECONDARY');
CREATE TYPE "EventMatchSupportRole" AS ENUM ('GK_COVER', 'DEFENDER_COVER', 'MIDFIELD_COVER', 'FORWARD_COVER', 'GENERAL_COVER');

-- PostMatchPlayerActual.attendanceStatus
ALTER TABLE "PostMatchPlayerActual" DROP CONSTRAINT IF EXISTS "PostMatchPlayerActual_attendanceStatus_check";
ALTER TABLE "PostMatchPlayerActual" ALTER COLUMN "attendanceStatus" DROP DEFAULT;
ALTER TABLE "PostMatchPlayerActual" ALTER COLUMN "attendanceStatus" TYPE "PostMatchAttendanceStatus" USING ("attendanceStatus"::"PostMatchAttendanceStatus");
ALTER TABLE "PostMatchPlayerActual" ALTER COLUMN "attendanceStatus" SET DEFAULT 'UNKNOWN'::"PostMatchAttendanceStatus";

-- PostMatchPlayerActual.source
ALTER TABLE "PostMatchPlayerActual" DROP CONSTRAINT IF EXISTS "PostMatchPlayerActual_source_check";
ALTER TABLE "PostMatchPlayerActual" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "PostMatchPlayerActual" ALTER COLUMN "source" TYPE "ParticipationSource" USING ("source"::"ParticipationSource");
ALTER TABLE "PostMatchPlayerActual" ALTER COLUMN "source" SET DEFAULT 'PLANNED'::"ParticipationSource";

-- Goal.type
ALTER TABLE "Goal" DROP CONSTRAINT IF EXISTS "Goal_type_check";
ALTER TABLE "Goal" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Goal" ALTER COLUMN "type" TYPE "GoalType" USING ("type"::"GoalType");
ALTER TABLE "Goal" ALTER COLUMN "type" SET DEFAULT 'NORMAL'::"GoalType";

-- Assist.type
ALTER TABLE "Assist" DROP CONSTRAINT IF EXISTS "Assist_type_check";
ALTER TABLE "Assist" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Assist" ALTER COLUMN "type" TYPE "AssistType" USING ("type"::"AssistType");
ALTER TABLE "Assist" ALTER COLUMN "type" SET DEFAULT 'NORMAL'::"AssistType";

-- EventGoalEvent.type (shares GoalType with Goal.type — same semantic vocabulary, separate table)
ALTER TABLE "EventGoalEvent" DROP CONSTRAINT IF EXISTS "EventGoalEvent_type_check";
ALTER TABLE "EventGoalEvent" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "EventGoalEvent" ALTER COLUMN "type" TYPE "GoalType" USING ("type"::"GoalType");
ALTER TABLE "EventGoalEvent" ALTER COLUMN "type" SET DEFAULT 'NORMAL'::"GoalType";

-- EventAssistEvent.type (shares AssistType with Assist.type)
ALTER TABLE "EventAssistEvent" DROP CONSTRAINT IF EXISTS "EventAssistEvent_type_check";
ALTER TABLE "EventAssistEvent" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "EventAssistEvent" ALTER COLUMN "type" TYPE "AssistType" USING ("type"::"AssistType");
ALTER TABLE "EventAssistEvent" ALTER COLUMN "type" SET DEFAULT 'NORMAL'::"AssistType";

-- EventPostMatchPlayer.attendanceStatus
-- Defensive data fix: the event post-match report UI offered an "ABSENT" dropdown option that
-- was never a valid value (not in the CHECK constraint's set, and not in this enum). Any legacy
-- row written before the 20260802120000 CHECK constraint existed would fail the USING cast below
-- without this. Treated as the semantic equivalent of NO_SHOW.
UPDATE "EventPostMatchPlayer" SET "attendanceStatus" = 'NO_SHOW' WHERE "attendanceStatus" = 'ABSENT';
ALTER TABLE "EventPostMatchPlayer" DROP CONSTRAINT IF EXISTS "EventPostMatchPlayer_attendanceStatus_check";
ALTER TABLE "EventPostMatchPlayer" ALTER COLUMN "attendanceStatus" DROP DEFAULT;
ALTER TABLE "EventPostMatchPlayer" ALTER COLUMN "attendanceStatus" TYPE "EventPostMatchAttendanceStatus" USING ("attendanceStatus"::"EventPostMatchAttendanceStatus");
ALTER TABLE "EventPostMatchPlayer" ALTER COLUMN "attendanceStatus" SET DEFAULT 'UNKNOWN'::"EventPostMatchAttendanceStatus";

-- EventMatchSupportAssignment.plannedRole (nullable, no default)
-- Stored values were the human-readable labels themselves ('GK cover', etc.) — converted here to
-- SCREAMING_SNAKE_CASE enum keys to match every other enum in this schema (Prisma's @map on enum
-- values would decouple the Prisma-client-facing key from the DB label, which is unprecedented
-- anywhere else in this schema and would force app code to juggle two representations for no
-- benefit). Display formatting moves to src/lib/formatters/event-labels.ts, matching the
-- established pattern for every other enum's human-readable label.
--
-- The CHECK constraint added in 20260802120000 only allows the OLD human-readable strings
-- ('GK cover', ... 'General cover'). It must be dropped BEFORE the UPDATE statements below run,
-- not after — an UPDATE that rewrites a value to the NEW SCREAMING_SNAKE_CASE form is itself
-- checked against whatever constraint is active at that moment. Doing the rename first (as this
-- migration originally did) fails against any real 'General cover' row with
-- "violates check constraint EventMatchSupportAssignment_plannedRole_check" — confirmed by a real
-- production failure (see ADR-0084 History) that CI/local never caught because neither had a row
-- with that value in this column, so the buggy ordering was never exercised.
ALTER TABLE "EventMatchSupportAssignment" DROP CONSTRAINT IF EXISTS "EventMatchSupportAssignment_plannedRole_check";
UPDATE "EventMatchSupportAssignment" SET "plannedRole" = 'GK_COVER' WHERE "plannedRole" = 'GK cover';
UPDATE "EventMatchSupportAssignment" SET "plannedRole" = 'DEFENDER_COVER' WHERE "plannedRole" = 'Defender cover';
UPDATE "EventMatchSupportAssignment" SET "plannedRole" = 'MIDFIELD_COVER' WHERE "plannedRole" = 'Midfield cover';
UPDATE "EventMatchSupportAssignment" SET "plannedRole" = 'FORWARD_COVER' WHERE "plannedRole" = 'Forward cover';
UPDATE "EventMatchSupportAssignment" SET "plannedRole" = 'GENERAL_COVER' WHERE "plannedRole" = 'General cover';
ALTER TABLE "EventMatchSupportAssignment" ALTER COLUMN "plannedRole" TYPE "EventMatchSupportRole" USING ("plannedRole"::"EventMatchSupportRole");
