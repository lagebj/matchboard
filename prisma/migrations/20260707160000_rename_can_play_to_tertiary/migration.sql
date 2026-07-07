-- Rename PlayerPositionPriority enum value CAN_PLAY to TERTIARY
-- This aligns with product vocabulary: primary, secondary, and tertiary positions.

-- Step 1: Add TERTIARY as a new enum value
ALTER TYPE "PlayerPositionPriority" ADD VALUE 'TERTIARY';

-- Step 2: Update existing CAN_PLAY rows to TERTIARY
UPDATE "PlayerPosition" SET priority = 'TERTIARY' WHERE priority = 'CAN_PLAY';

-- Step 3: Recreate the enum type without CAN_PLAY
-- We must handle the column default since it references the old enum type.

-- Drop the default first
ALTER TABLE "PlayerPosition" ALTER COLUMN priority DROP DEFAULT;

-- Create new enum type
CREATE TYPE "PlayerPositionPriority_new" AS ENUM ('PRIMARY', 'SECONDARY', 'TERTIARY');

-- Convert column to use new enum type
ALTER TABLE "PlayerPosition" ALTER COLUMN priority TYPE "PlayerPositionPriority_new" USING (priority::text)::"PlayerPositionPriority_new";

-- Drop old enum type
DROP TYPE "PlayerPositionPriority";

-- Rename new enum type to original name
ALTER TYPE "PlayerPositionPriority_new" RENAME TO "PlayerPositionPriority";

-- Re-add the default using the new enum type
ALTER TABLE "PlayerPosition" ALTER COLUMN priority SET DEFAULT 'PRIMARY'::"PlayerPositionPriority";