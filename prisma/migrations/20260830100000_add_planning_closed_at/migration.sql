-- Phase 1: Planning Boundary
-- Add planningClosedAt to Match to track when planning was permanently closed.
-- NULL means planning is still open (subject to scheduled kickoff boundary).
-- Once set, planningClosedAt cannot be cleared by normal workflow.
-- This column coexists with the existing FINALIZED round status as a separate
-- mechanism: FINALIZED = coach-confirmed intent, planningClosedAt = automatic
-- boundary closure at kickoff or live start. See ADR-0095.

ALTER TABLE "Match" ADD COLUMN "planningClosedAt" TIMESTAMP;

-- Add planningClosedAt to the existing compound index on startsAt/createdAt
-- to support efficient boundary queries.
CREATE INDEX "Match_planningClosedAt_idx" ON "Match"("planningClosedAt") WHERE "planningClosedAt" IS NOT NULL;