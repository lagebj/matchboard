-- Drop the overly restrictive unique constraint that prevents handover history.
-- The old constraint @@unique([targetType, targetId, status]) prevents multiple
-- HANDED_OVER rows for the same target, blocking repeated handover history.
-- The application layer enforces at most one ACTIVE ownership per target.
-- A partial unique index provides database-level enforcement for ACTIVE only.

DROP INDEX IF EXISTS "WorkOwnership_targetType_targetId_status_key";

-- Partial unique index: only one ACTIVE ownership per target per organisation.
-- HANDED_OVER and COMPLETED rows are allowed to repeat for handover history.
CREATE UNIQUE INDEX "WorkOwnership_one_active_per_target_per_org"
ON "WorkOwnership"("targetType", "targetId", "organisationId")
WHERE "status" = 'ACTIVE';