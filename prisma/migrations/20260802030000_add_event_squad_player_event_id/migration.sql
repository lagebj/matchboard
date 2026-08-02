-- Add eventId column to EventSquadPlayer for cross-squad uniqueness constraint
-- and add unique constraint on [eventId, playerId]

-- Step 1: Add nullable eventId column
ALTER TABLE "EventSquadPlayer" ADD COLUMN "eventId" TEXT;

-- Step 2: Backfill eventId from EventSquad relationship
UPDATE "EventSquadPlayer" esp
SET "eventId" = es."eventId"
FROM "EventSquad" es
WHERE esp."eventSquadId" = es."id";

-- Step 3: Make eventId NOT NULL (will fail if any rows still have null)
ALTER TABLE "EventSquadPlayer" ALTER COLUMN "eventId" SET NOT NULL;

-- Step 4: Add unique constraint on [eventId, playerId]
CREATE UNIQUE INDEX IF NOT EXISTS "EventSquadPlayer_eventId_playerId_key" ON "EventSquadPlayer"("eventId", "playerId");