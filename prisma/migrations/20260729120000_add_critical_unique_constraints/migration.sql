-- Add critical unique constraints for data integrity
-- These constraints enforce business rules at the database level

-- 1. One availability record per player per round (IMPROVE-0A: high priority)
CREATE UNIQUE INDEX IF NOT EXISTS "Availability_playerId_matchRoundId_key" ON "Availability"("playerId", "matchRoundId");

-- 2. One rotation path per from-team/to-team/role combination (IMPROVE-0A: high priority)
CREATE UNIQUE INDEX IF NOT EXISTS "RotationPath_fromTeamId_toTeamId_role_key" ON "RotationPath"("fromTeamId", "toTeamId", "role");

-- 3. One active (DRAFT) planned selection per player per round
-- This is a partial unique index enforcing the "one planned assignment per player per round" invariant
-- Prisma doesn't support partial unique indexes, so we use raw SQL
CREATE UNIQUE INDEX IF NOT EXISTS "Selection_playerId_matchRoundId_draft_key" ON "Selection"("playerId", "matchRoundId") WHERE "status" = 'DRAFT';

-- 4. Team squad size constraints (IMPROVE-0A: medium priority)
ALTER TABLE "Team" ADD CONSTRAINT "Team_targetSquadSize_gte_minAcceptedSquadSize" CHECK ("targetSquadSize" >= "minAcceptedSquadSize");
ALTER TABLE "Team" ADD CONSTRAINT "Team_maxSquadSize_gt_targetSquadSize" CHECK ("maxSquadSize" > "targetSquadSize");

-- 5. League season date constraints (IMPROVE-0A: medium priority)
ALTER TABLE "LeagueSeason" ADD CONSTRAINT "LeagueSeason_endDate_gte_startDate" CHECK ("endDate" >= "startDate");

-- 6. Player rating range constraints (1-10 nullable)
ALTER TABLE "Player" ADD CONSTRAINT "Player_ballControl_range" CHECK ("ballControl" IS NULL OR ("ballControl" >= 1 AND "ballControl" <= 10));
ALTER TABLE "Player" ADD CONSTRAINT "Player_passing_range" CHECK ("passing" IS NULL OR ("passing" >= 1 AND "passing" <= 10));
ALTER TABLE "Player" ADD CONSTRAINT "Player_firstTouch_range" CHECK ("firstTouch" IS NULL OR ("firstTouch" >= 1 AND "firstTouch" <= 10));
ALTER TABLE "Player" ADD CONSTRAINT "Player_oneVOneAttacking_range" CHECK ("oneVOneAttacking" IS NULL OR ("oneVOneAttacking" >= 1 AND "oneVOneAttacking" <= 10));
ALTER TABLE "Player" ADD CONSTRAINT "Player_positioning_range" CHECK ("positioning" IS NULL OR ("positioning" >= 1 AND "positioning" <= 10));
ALTER TABLE "Player" ADD CONSTRAINT "Player_oneVOneDefending_range" CHECK ("oneVOneDefending" IS NULL OR ("oneVOneDefending" >= 1 AND "oneVOneDefending" <= 10));
ALTER TABLE "Player" ADD CONSTRAINT "Player_decisionMaking_range" CHECK ("decisionMaking" IS NULL OR ("decisionMaking" >= 1 AND "decisionMaking" <= 10));
ALTER TABLE "Player" ADD CONSTRAINT "Player_effort_range" CHECK ("effort" IS NULL OR ("effort" >= 1 AND "effort" <= 10));
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamplay_range" CHECK ("teamplay" IS NULL OR ("teamplay" >= 1 AND "teamplay" <= 10));
ALTER TABLE "Player" ADD CONSTRAINT "Player_concentration_range" CHECK ("concentration" IS NULL OR ("concentration" >= 1 AND "concentration" <= 10));
ALTER TABLE "Player" ADD CONSTRAINT "Player_speed_range" CHECK ("speed" IS NULL OR ("speed" >= 1 AND "speed" <= 10));
ALTER TABLE "Player" ADD CONSTRAINT "Player_strength_range" CHECK ("strength" IS NULL OR ("strength" >= 1 AND "strength" <= 10));