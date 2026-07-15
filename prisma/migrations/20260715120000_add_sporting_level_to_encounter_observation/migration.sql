-- AlterTable: Add sporting-level assessment fields to OpponentEncounterObservation
ALTER TABLE "OpponentEncounterObservation" ADD COLUMN "sportingLevel" DECIMAL(3, 1);
ALTER TABLE "OpponentEncounterObservation" ADD COLUMN "sportingLevelNote" TEXT;