-- Phase 5: planned rotation live execution — Delay status and actual-vs-planned timing.
-- DELAYED is a re-visitable state (unlike SKIPPED/APPLIED): a delayed change remains actionable
-- and can still be applied or skipped later. actualMatchSeconds records when a change was
-- actually executed, distinct from approximateMatchSeconds (the original plan) — see
-- DECISIONS.md "Live execution of plan": "Delay preserves planned time and actual execution
-- time."
ALTER TYPE "PlannedChangeStatus" ADD VALUE 'DELAYED';

ALTER TABLE "PlannedRotationChange" ADD COLUMN "actualMatchSeconds" INTEGER;
ALTER TABLE "PlannedRotationChange" ADD COLUMN "secondaryLiveEventId" TEXT;
