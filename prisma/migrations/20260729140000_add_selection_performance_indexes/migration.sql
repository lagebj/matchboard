-- Add performance indexes for the Selection table
-- These indexes support the most frequent query patterns in the selection engine,
-- finalization, and assistant command centre.
-- Selection(matchRoundId, status) — round-level draft/finalized lookups
-- Selection(matchId, status) — per-match draft/finalized lookups
-- Selection(playerId, matchRoundId) — player conflict checks (partial unique already exists for DRAFT)
-- Selection(playerId) — player history lookups

CREATE INDEX IF NOT EXISTS "Selection_matchRoundId_status_idx" ON "Selection"("matchRoundId", "status");
CREATE INDEX IF NOT EXISTS "Selection_matchId_status_idx" ON "Selection"("matchId", "status");
CREATE INDEX IF NOT EXISTS "Selection_playerId_matchRoundId_idx" ON "Selection"("playerId", "matchRoundId");
CREATE INDEX IF NOT EXISTS "Selection_playerId_idx" ON "Selection"("playerId");