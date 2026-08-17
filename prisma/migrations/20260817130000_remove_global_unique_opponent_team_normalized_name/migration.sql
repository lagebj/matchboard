-- Remove global unique constraint on OpponentTeam.normalizedName.
-- The composite unique constraint @@unique([organisationId, normalizedName])
-- already enforces org-scoped uniqueness. The global unique constraint
-- incorrectly prevents different organisations from having opponents
-- with the same normalized name.

ALTER TABLE "OpponentTeam" DROP CONSTRAINT "OpponentTeam_normalizedName_key";