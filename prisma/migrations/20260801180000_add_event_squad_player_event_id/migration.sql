-- Add eventId to EventSquadPlayer for cross-squad uniqueness constraint
-- A player may only belong to one squad per event.

-- Step 1: Add nullable eventId column
ALTER TABLE "EventSquadPlayer" ADD COLUMN "eventId" TEXT;

-- Step 2: Backfill eventId from EventSquad relation
UPDATE "EventSquadPlayer" esp
SET "eventId" = es."eventId"
FROM "EventSquad" es
WHERE esp."eventSquadId" = es."id";

-- Step 3: Make eventId NOT NULL
ALTER TABLE "EventSquadPlayer" ALTER COLUMN "eventId" SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE "EventSquadPlayer"
  ADD CONSTRAINT "EventSquadPlayer_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Add unique constraint (one player per event across all squads)
ALTER TABLE "EventSquadPlayer"
  ADD CONSTRAINT "EventSquadPlayer_eventId_playerId_key" UNIQUE ("eventId", "playerId");

-- Step 6: Add index on eventId for query performance
CREATE INDEX "EventSquadPlayer_eventId_idx" ON "EventSquadPlayer"("eventId");