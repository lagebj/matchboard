-- AlterTable: Make Match.opponentTeamId nullable
-- Canonical opponent entities are now created on report completion, not fixture creation.
-- Fixture creation stores only an opponent name snapshot; opponentTeamId links the
-- canonical entity when available (selected from existing opponents) or on report completion.

ALTER TABLE "Match" ALTER COLUMN "opponentTeamId" DROP NOT NULL;