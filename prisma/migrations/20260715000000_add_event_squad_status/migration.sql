-- CreateEnum
CREATE TYPE "EventSquadStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- AlterTable
ALTER TABLE "EventSquad" ADD COLUMN "status" "EventSquadStatus" NOT NULL DEFAULT 'DRAFT';