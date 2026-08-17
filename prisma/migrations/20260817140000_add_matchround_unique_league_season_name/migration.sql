-- Add composite unique constraint on MatchRound(leagueSeasonId, name)
-- This prevents duplicate round names within the same league season under race conditions.
-- The application already scopes lookups by leagueSeasonId, so this is a data integrity guard.

CREATE UNIQUE INDEX IF NOT EXISTS "MatchRound_leagueSeasonId_name_key" ON "MatchRound"("leagueSeasonId", "name");