-- Rename EventSquadStatus enum value from CONFIRMED to LOCKED
-- Existing data with CONFIRMED status is migrated to LOCKED.

-- Step 1: Add LOCKED value to the enum (if not already present)
ALTER TYPE "EventSquadStatus" ADD VALUE IF NOT EXISTS 'LOCKED';

-- Step 2: Migrate existing CONFIRMED rows to LOCKED
UPDATE "EventSquad" SET status = 'LOCKED' WHERE status = 'CONFIRMED';

-- Step 3: Remove CONFIRMED value from the enum
-- Note: PostgreSQL does not support removing enum values directly.
-- The CONFIRMED value will remain in the enum type but will not be used by new code.
-- A separate cleanup migration can remove it once all deployments are confirmed.