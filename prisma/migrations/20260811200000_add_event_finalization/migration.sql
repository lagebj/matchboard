-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- AlterTable: add finalization fields to Event
ALTER TABLE "Event" ADD COLUMN "status" "EventStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Event" ADD COLUMN "finalizedAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "finalizedBy" TEXT;