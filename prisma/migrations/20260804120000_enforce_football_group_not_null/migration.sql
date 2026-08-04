-- MT-8: Enforce footballGroupId non-nullable on Team, Event, LeagueSeason, RuleConfig
-- Per ADR-0049 and ARR-0015: nullable footballGroupId was temporary during foundation phase.
-- After backfill, all teams, events, league seasons, and rule configs have a group assignment.
-- This migration makes footballGroupId required on these models.
-- Also changes onDelete from SET NULL to RESTRICT to match the new non-nullable constraint.

-- IMPORTANT: Run scripts/backfill-football-groups.ts BEFORE applying this migration.
-- The backfill script assigns all existing rows to a default group per organisation.
-- If any rows still have NULL footballGroupId, this migration will fail.

-- 1. Team.footballGroupId: nullable -> required, SET NULL -> RESTRICT
ALTER TABLE "Team" ALTER COLUMN "footballGroupId" SET NOT NULL;

-- 2. Event.footballGroupId: nullable -> required, SET NULL -> RESTRICT
ALTER TABLE "Event" ALTER COLUMN "footballGroupId" SET NOT NULL;

-- 3. LeagueSeason.footballGroupId: nullable -> required, SET NULL -> RESTRICT
ALTER TABLE "LeagueSeason" ALTER COLUMN "footballGroupId" SET NOT NULL;

-- 4. RuleConfig.footballGroupId: nullable -> required, SET NULL -> RESTRICT
ALTER TABLE "RuleConfig" ALTER COLUMN "footballGroupId" SET NOT NULL;

-- Drop and recreate foreign key constraints to change ON DELETE from SET NULL to RESTRICT
-- These must match the Prisma schema onDelete: Restrict on the group relation

-- Team -> FootballGroup
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_footballGroupId_fkey";
ALTER TABLE "Team" ADD CONSTRAINT "Team_footballGroupId_fkey"
  FOREIGN KEY ("footballGroupId") REFERENCES "FootballGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Event -> FootballGroup
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_footballGroupId_fkey";
ALTER TABLE "Event" ADD CONSTRAINT "Event_footballGroupId_fkey"
  FOREIGN KEY ("footballGroupId") REFERENCES "FootballGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- LeagueSeason -> FootballGroup
ALTER TABLE "LeagueSeason" DROP CONSTRAINT IF EXISTS "LeagueSeason_footballGroupId_fkey";
ALTER TABLE "LeagueSeason" ADD CONSTRAINT "LeagueSeason_footballGroupId_fkey"
  FOREIGN KEY ("footballGroupId") REFERENCES "FootballGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RuleConfig -> FootballGroup
ALTER TABLE "RuleConfig" DROP CONSTRAINT IF EXISTS "RuleConfig_footballGroupId_fkey";
ALTER TABLE "RuleConfig" ADD CONSTRAINT "RuleConfig_footballGroupId_fkey"
  FOREIGN KEY ("footballGroupId") REFERENCES "FootballGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;