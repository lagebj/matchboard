-- AlterTable: add lineup assignment fields to EventSquadPlayer
ALTER TABLE "EventSquadPlayer" ADD COLUMN "assignedSlotIndex" INTEGER;
ALTER TABLE "EventSquadPlayer" ADD COLUMN "assignedSlotLabel" TEXT;
ALTER TABLE "EventSquadPlayer" ADD COLUMN "lineupOrder" INTEGER;