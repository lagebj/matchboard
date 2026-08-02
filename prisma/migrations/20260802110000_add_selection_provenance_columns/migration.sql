-- AlterTable: Add provenance columns to Selection model
-- These columns extract operational flags from the JSON `explanation` field
-- to make them queryable and avoid depending on JSON parsing for core logic.

ALTER TABLE "Selection" ADD COLUMN "manuallyAdded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Selection" ADD COLUMN "manuallyRemoved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Selection" ADD COLUMN "autoSelected" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Selection" ADD COLUMN "sourceTeamName" TEXT;
ALTER TABLE "Selection" ADD COLUMN "targetTeamName" TEXT;
ALTER TABLE "Selection" ADD COLUMN "selectionReason" TEXT;

-- Backfill: Extract provenance flags from existing explanation JSON
UPDATE "Selection"
SET "manuallyAdded" = COALESCE(((explanation::jsonb->>'manuallyAdded')::boolean), false),
    "manuallyRemoved" = COALESCE(((explanation::jsonb->>'manuallyRemoved')::boolean), false),
    "autoSelected" = COALESCE(((explanation::jsonb->>'autoSelected')::boolean), true),
    "sourceTeamName" = explanation::jsonb->>'sourceTeamName',
    "targetTeamName" = explanation::jsonb->>'targetTeamName',
    "selectionReason" = explanation::jsonb->>'summary'
WHERE explanation IS NOT NULL;