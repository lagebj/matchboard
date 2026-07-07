-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "Match" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN "cancelledReason" TEXT;