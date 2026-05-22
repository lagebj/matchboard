-- CreateEnum
CREATE TYPE "MatchEnvironmentObservation" AS ENUM ('NOT_ASSESSED', 'POSITIVE', 'ACCEPTABLE', 'CONCERN', 'SERIOUS_CONCERN');

-- CreateEnum
CREATE TYPE "OpponentConcernCategory" AS ENUM ('PRESSURE_ON_REFEREE_DECISIONS', 'DISRESPECTFUL_LANGUAGE_OR_SHOUTING', 'UNSPORTING_MATCH_CONDUCT', 'PHYSICAL_PLAY_OR_SAFETY_CONCERN', 'THREATS_OR_INTIMIDATION', 'DISCRIMINATORY_OR_DEGRADING_LANGUAGE', 'SIDELINE_ATMOSPHERE_CONCERN', 'SAFE_MATCH_FRAME_NOT_SUPPORTED', 'OTHER_OBSERVABLE_CONCERN');

-- CreateEnum
CREATE TYPE "OpponentObservationFollowUp" AS ENUM ('NONE', 'DISCUSSED_AFTER_MATCH', 'INFORMED_OWN_CLUB_FAIR_PLAY_CONTACT', 'FORMAL_FOLLOW_UP_OUTSIDE_MATCHBOARD', 'NO_FURTHER_ACTION_REQUIRED');

-- CreateTable: OpponentTeam
CREATE TABLE "OpponentTeam" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpponentTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpponentTeam_normalizedName_key" ON "OpponentTeam"("normalizedName");
CREATE INDEX "OpponentTeam_archivedAt_displayName_idx" ON "OpponentTeam"("archivedAt", "displayName");

-- AlterTable: Add opponentTeamId as nullable first
ALTER TABLE "Match" ADD COLUMN "opponentTeamId" TEXT;

-- Backfill: Create OpponentTeam records from unique normalized opponent names.
-- Use the first encountered display name (by earliest match) as the canonical displayName.
-- The normalizedName is the lowercased, trimmed, whitespace-collapsed version.
INSERT INTO "OpponentTeam" ("id", "displayName", "normalizedName", "createdAt", "updatedAt")
SELECT
    CONCAT('opt_', ROW_NUMBER() OVER (ORDER BY min_started)) AS id,
    display_name,
    normalized_name,
    NOW(),
    NOW()
FROM (
    SELECT
        LOWER(TRIM(REGEXP_REPLACE("opponent", '\s+', ' ', 'g'))) AS normalized_name,
        TRIM(REGEXP_REPLACE("opponent", '\s+', ' ', 'g')) AS display_name,
        MIN("startsAt") AS min_started
    FROM "Match"
    WHERE "opponent" IS NOT NULL AND TRIM("opponent") != ''
    GROUP BY LOWER(TRIM(REGEXP_REPLACE("opponent", '\s+', ' ', 'g'))), TRIM(REGEXP_REPLACE("opponent", '\s+', ' ', 'g'))
) AS distinct_opponents
ON CONFLICT ("normalizedName") DO NOTHING;

-- For normalized duplicates (same lowercase but different casing), pick the earliest display name.
-- The INSERT above may create multiple rows for casing variants; deduplicate by picking the earliest.
-- Actually, we group by normalized_name. Casing variants that normalize to the same key
-- will produce separate rows above. We need to merge them into one.
-- Delete duplicates keeping the one with the earliest original display name.
DELETE FROM "OpponentTeam" ot
WHERE ot."id" NOT IN (
    SELECT MIN(sub."id") AS keep_id
    FROM "OpponentTeam" sub
    GROUP BY sub."normalizedName"
);

-- Link existing matches to their opponent team records using normalized name
UPDATE "Match" m
SET "opponentTeamId" = ot."id"
FROM "OpponentTeam" ot
WHERE LOWER(TRIM(REGEXP_REPLACE(m."opponent", '\s+', ' ', 'g'))) = ot."normalizedName"
  AND m."opponentTeamId" IS NULL;

-- Ensure no match remains without an opponentTeamId
-- For any remaining unlinked matches, create an opponent team from their raw opponent value
INSERT INTO "OpponentTeam" ("id", "displayName", "normalizedName", "createdAt", "updatedAt")
SELECT
    CONCAT('opt_fallback_', ROW_NUMBER() OVER (ORDER BY m."id")),
    COALESCE(TRIM(REGEXP_REPLACE(m."opponent", '\s+', ' ', 'g')), 'Unknown Opponent'),
    COALESCE(LOWER(TRIM(REGEXP_REPLACE(m."opponent", '\s+', ' ', 'g'))), 'unknown opponent'),
    NOW(),
    NOW()
FROM "Match" m
WHERE m."opponentTeamId" IS NULL
  AND m."opponent" IS NOT NULL
  AND TRIM(m."opponent") != ''
  AND NOT EXISTS (
    SELECT 1 FROM "OpponentTeam" ot
    WHERE ot."normalizedName" = LOWER(TRIM(REGEXP_REPLACE(m."opponent", '\s+', ' ', 'g')))
  )
ON CONFLICT ("normalizedName") DO NOTHING;

-- Re-link any still-unlinked matches
UPDATE "Match" m
SET "opponentTeamId" = ot."id"
FROM "OpponentTeam" ot
WHERE m."opponentTeamId" IS NULL
  AND LOWER(TRIM(REGEXP_REPLACE(m."opponent", '\s+', ' ', 'g'))) = ot."normalizedName";

-- Final fallback for any truly empty opponent strings
INSERT INTO "OpponentTeam" ("id", "displayName", "normalizedName", "createdAt", "updatedAt")
VALUES ('unknown-opponent', 'Unknown Opponent', 'unknown opponent', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

UPDATE "Match"
SET "opponentTeamId" = 'unknown-opponent'
WHERE "opponentTeamId" IS NULL;

-- Now set NOT NULL constraint
ALTER TABLE "Match" ALTER COLUMN "opponentTeamId" SET NOT NULL;

-- CreateIndex on Match.opponentTeamId
CREATE INDEX "Match_opponentTeamId_idx" ON "Match"("opponentTeamId");

-- CreateTable: OpponentEncounterObservation
CREATE TABLE "OpponentEncounterObservation" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "opponentTeamId" TEXT NOT NULL,
    "overallEnvironment" "MatchEnvironmentObservation" NOT NULL DEFAULT 'NOT_ASSESSED',
    "opponentPlayersContext" "MatchEnvironmentObservation" NOT NULL DEFAULT 'NOT_ASSESSED',
    "opponentStaffContext" "MatchEnvironmentObservation" NOT NULL DEFAULT 'NOT_ASSESSED',
    "spectatorSidelineContext" "MatchEnvironmentObservation" NOT NULL DEFAULT 'NOT_ASSESSED',
    "concernCategories" "OpponentConcernCategory"[],
    "factualSummary" TEXT,
    "followUp" "OpponentObservationFollowUp" NOT NULL DEFAULT 'NONE',
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpponentEncounterObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpponentEncounterObservation_matchId_key" ON "OpponentEncounterObservation"("matchId");
CREATE INDEX "OpponentEncounterObservation_opponentTeamId_createdAt_idx" ON "OpponentEncounterObservation"("opponentTeamId", "createdAt");
CREATE INDEX "OpponentEncounterObservation_overallEnvironment_idx" ON "OpponentEncounterObservation"("overallEnvironment");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_opponentTeamId_fkey" FOREIGN KEY ("opponentTeamId") REFERENCES "OpponentTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpponentEncounterObservation" ADD CONSTRAINT "OpponentEncounterObservation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpponentEncounterObservation" ADD CONSTRAINT "OpponentEncounterObservation_opponentTeamId_fkey" FOREIGN KEY ("opponentTeamId") REFERENCES "OpponentTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;