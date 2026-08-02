-- Migrate Availability.status from String to AvailabilityStatus enum
-- Existing data values are already valid enum members: AVAILABLE, INJURED, SICK, AWAY, TENTATIVE, UNKNOWN

-- Step 1: Add UNAVAILABLE value to the enum (for future use as generic unavailable)
ALTER TYPE "AvailabilityStatus" ADD VALUE IF NOT EXISTS 'UNAVAILABLE';

-- Step 2: Alter the column type from TEXT to AvailabilityStatus
-- PostgreSQL allows ALTER TYPE ... USING to cast existing string values
ALTER TABLE "Availability" ALTER COLUMN "status" TYPE "AvailabilityStatus" USING "status"::"AvailabilityStatus";

-- Step 3: Set default value for the column
ALTER TABLE "Availability" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';