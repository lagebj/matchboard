-- CreateEnum: HelperProvenance
CREATE TYPE "HelperProvenance" AS ENUM ('HELPER', 'MATCH_DAY_ADDITION');

-- AlterTable: add provenance column to MatchHelperAssignment with default HELPER
ALTER TABLE "MatchHelperAssignment" ADD COLUMN "provenance" "HelperProvenance" NOT NULL DEFAULT E'HELPER';