-- Event.numberOfHalves: 1 (default, the pre-existing single continuous "Match" period) or 2
-- (First half/Half time/Second half, mirroring League's regulation-time period model).
-- Additive, backfilled to 1 for every existing event -- Event.matchDurationMinutes already means
-- "duration of one half"; for numberOfHalves=1 that is trivially the whole match, so no existing
-- event's live-reporting behaviour changes. See src/lib/live-match/period-config.ts.
ALTER TABLE "Event" ADD COLUMN "numberOfHalves" INTEGER NOT NULL DEFAULT 1;
