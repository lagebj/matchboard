-- Rename CoachingIntentScopeType.PLANNING_PERIOD to LEAGUE_SEASON
-- This aligns the enum value with user-facing "League season" terminology.
-- The database model was renamed from PlanningPeriod to LeagueSeason previously.

-- Step 1: Add the new enum value
ALTER TYPE "CoachingIntentScopeType" ADD VALUE 'LEAGUE_SEASON';

-- Step 2: Migrate existing data from PLANNING_PERIOD to LEAGUE_SEASON
UPDATE "CoachingIntent" SET "scopeType" = 'LEAGUE_SEASON' WHERE "scopeType" = 'PLANNING_PERIOD';

-- Note: PostgreSQL does not support removing enum values inside a transaction.
-- The PLANNING_PERIOD value will remain in the enum type but will have no rows
-- referencing it after this migration. It can be removed in a future migration
-- using ALTER TYPE ... RENAME VALUE or by recreating the enum type.