-- Fix: allow maxSquadSize equal to targetSquadSize (>= instead of >)
-- The application validation already allows equal values.
ALTER TABLE "Team" DROP CONSTRAINT "Team_maxSquadSize_gt_targetSquadSize";
ALTER TABLE "Team" ADD CONSTRAINT "Team_maxSquadSize_gte_targetSquadSize" CHECK ("maxSquadSize" >= "targetSquadSize");