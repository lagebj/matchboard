-- Remove global unique constraint on OpponentTeam.normalizedName.
-- The composite unique constraint @@unique([organisationId, normalizedName])
-- already enforces org-scoped uniqueness. The global unique constraint
-- incorrectly prevents different organisations from having opponents
-- with the same normalized name.

-- Use IF EXISTS because on fresh databases (migration from zero) the
-- constraint may not exist if the schema never had @unique on this column.
ALTER TABLE "OpponentTeam" DROP CONSTRAINT IF EXISTS "OpponentTeam_normalizedName_key";