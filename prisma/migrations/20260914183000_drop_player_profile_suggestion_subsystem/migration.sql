-- ARR-0049: drop the dead PlayerProfileSuggestion approval workflow and its
-- evidence-link table. Zero-row preflight was confirmed against both
-- Production and Test before this migration was authored (see ARR-0049 and
-- the ADR-0138 History entry dated 2026-09-14 for the recorded counts).
-- PlayerDevelopmentObservation is retained unchanged; only its now-orphaned
-- relation to PlayerProfileSuggestionEvidence is removed.

-- DropForeignKey
ALTER TABLE "PlayerProfileSuggestionEvidence" DROP CONSTRAINT "PlayerProfileSuggestionEvidence_observationId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerProfileSuggestionEvidence" DROP CONSTRAINT "PlayerProfileSuggestionEvidence_suggestionId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerProfileSuggestion" DROP CONSTRAINT "PlayerProfileSuggestion_organisationId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerProfileSuggestion" DROP CONSTRAINT "PlayerProfileSuggestion_playerId_fkey";

-- DropTable
DROP TABLE "PlayerProfileSuggestionEvidence";

-- DropTable
DROP TABLE "PlayerProfileSuggestion";

-- DropEnum
DROP TYPE "SuggestionConfidence";

-- DropEnum
DROP TYPE "SuggestionStatus";
