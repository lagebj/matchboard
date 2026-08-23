-- Drop PlayerPosition (platform-integrity-programme Phase 1 / ARR-0001).
-- The table was write-only (populated by syncPlayerPositions(), which is also removed in this
-- change) with zero active read consumers; Player.primaryPosition/secondaryPosition/
-- tertiaryPosition were already the canonical, sole-read source per the source-of-truth
-- register. Maintainer decision: remove rather than build out the unused approval workflow.

-- DropTable
DROP TABLE IF EXISTS "PlayerPosition";

-- DropEnum
DROP TYPE IF EXISTS "PlayerPositionPriority";
