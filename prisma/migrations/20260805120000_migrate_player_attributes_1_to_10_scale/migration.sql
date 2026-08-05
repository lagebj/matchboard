-- Migrate player attributes from 1-5 scale to 1-10 scale.
-- Existing values are doubled: 1→2, 2→4, 3→6, 4→8, 5→10.
-- Zero values (if any remain) are set to NULL (Not rated).

-- Define the attribute columns to migrate
-- ballControl, passing, firstTouch, oneVOneAttacking,
-- positioning, oneVOneDefending, decisionMaking,
-- effort, teamplay, concentration, speed, strength

-- Double existing non-null values (1-5 → 2,4,6,8,10)
-- Set any remaining 0 values to NULL

DO $$
BEGIN
  -- ballControl
  UPDATE "Player" SET "ballControl" = "ballControl" * 2 WHERE "ballControl" IS NOT NULL AND "ballControl" BETWEEN 1 AND 5;
  UPDATE "Player" SET "ballControl" = NULL WHERE "ballControl" = 0;

  -- passing
  UPDATE "Player" SET "passing" = "passing" * 2 WHERE "passing" IS NOT NULL AND "passing" BETWEEN 1 AND 5;
  UPDATE "Player" SET "passing" = NULL WHERE "passing" = 0;

  -- firstTouch
  UPDATE "Player" SET "firstTouch" = "firstTouch" * 2 WHERE "firstTouch" IS NOT NULL AND "firstTouch" BETWEEN 1 AND 5;
  UPDATE "Player" SET "firstTouch" = NULL WHERE "firstTouch" = 0;

  -- oneVOneAttacking
  UPDATE "Player" SET "oneVOneAttacking" = "oneVOneAttacking" * 2 WHERE "oneVOneAttacking" IS NOT NULL AND "oneVOneAttacking" BETWEEN 1 AND 5;
  UPDATE "Player" SET "oneVOneAttacking" = NULL WHERE "oneVOneAttacking" = 0;

  -- positioning
  UPDATE "Player" SET "positioning" = "positioning" * 2 WHERE "positioning" IS NOT NULL AND "positioning" BETWEEN 1 AND 5;
  UPDATE "Player" SET "positioning" = NULL WHERE "positioning" = 0;

  -- oneVOneDefending
  UPDATE "Player" SET "oneVOneDefending" = "oneVOneDefending" * 2 WHERE "oneVOneDefending" IS NOT NULL AND "oneVOneDefending" BETWEEN 1 AND 5;
  UPDATE "Player" SET "oneVOneDefending" = NULL WHERE "oneVOneDefending" = 0;

  -- decisionMaking
  UPDATE "Player" SET "decisionMaking" = "decisionMaking" * 2 WHERE "decisionMaking" IS NOT NULL AND "decisionMaking" BETWEEN 1 AND 5;
  UPDATE "Player" SET "decisionMaking" = NULL WHERE "decisionMaking" = 0;

  -- effort
  UPDATE "Player" SET "effort" = "effort" * 2 WHERE "effort" IS NOT NULL AND "effort" BETWEEN 1 AND 5;
  UPDATE "Player" SET "effort" = NULL WHERE "effort" = 0;

  -- teamplay
  UPDATE "Player" SET "teamplay" = "teamplay" * 2 WHERE "teamplay" IS NOT NULL AND "teamplay" BETWEEN 1 AND 5;
  UPDATE "Player" SET "teamplay" = NULL WHERE "teamplay" = 0;

  -- concentration
  UPDATE "Player" SET "concentration" = "concentration" * 2 WHERE "concentration" IS NOT NULL AND "concentration" BETWEEN 1 AND 5;
  UPDATE "Player" SET "concentration" = NULL WHERE "concentration" = 0;

  -- speed
  UPDATE "Player" SET "speed" = "speed" * 2 WHERE "speed" IS NOT NULL AND "speed" BETWEEN 1 AND 5;
  UPDATE "Player" SET "speed" = NULL WHERE "speed" = 0;

  -- strength
  UPDATE "Player" SET "strength" = "strength" * 2 WHERE "strength" IS NOT NULL AND "strength" BETWEEN 1 AND 5;
  UPDATE "Player" SET "strength" = NULL WHERE "strength" = 0;
END $$;