-- AlterEnum: Add NO_PLANNED_MATCH_OPPORTUNITY to OverrideReasonCategory
ALTER TYPE "OverrideReasonCategory" ADD VALUE 'NO_PLANNED_MATCH_OPPORTUNITY';

-- CreateEnum: UnplannedAppearanceReason
CREATE TYPE "UnplannedAppearanceReason" AS ENUM ('EMERGENCY_SQUAD_COVER', 'LATE_AVAILABILITY_CHANGE', 'NO_SHOW_REPLACEMENT', 'INJURY_REPLACEMENT', 'OTHER_RECORDED_REASON');

-- AlterTable: Add unplannedAppearanceReason to PostMatchPlayerActual
ALTER TABLE "PostMatchPlayerActual" ADD COLUMN "unplannedAppearanceReason" "UnplannedAppearanceReason";