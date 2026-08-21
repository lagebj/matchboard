-- Migrate MatchRound.status from String to MatchRoundStatus enum (Phase 11 Sec68, ADR-0083)
--
-- The only two values ever intentionally persisted are DRAFT and FINALIZED (verified: every
-- write site in src/ and scripts/ writes one of these two literals). A confirmed bug in
-- unfinalize-match-round.ts/unfinalize-single-match.ts could have persisted a UI-derived display
-- value (BLOCKED/READY, computed by deriveRoundStatus() for display only) instead of the literal
-- DRAFT it should have written -- fixed in the same application-code change as this migration.
-- Any existing row with an unexpected value is coerced back to DRAFT before the type change,
-- since that is what the fixed code would have written, so this migration cannot fail on
-- whatever the real data currently contains.
--
-- The existing "MatchRound_status_check" constraint (added in
-- 20260802120000_add_enum_check_constraints) mirrored the full 5-value UI display vocabulary
-- (NOT_GENERATED/DRAFT/BLOCKED/READY/FINALIZED) rather than the 2-value persistence rule -- it's
-- exactly why the bug above could write BLOCKED/READY without ever violating a database
-- constraint. The new enum type replaces it with a stricter, correct guarantee.

-- Step 1: Coerce any row with an unexpected status value back to DRAFT, so nothing below can
-- fail regardless of what real data currently contains
UPDATE "MatchRound" SET "status" = 'DRAFT' WHERE "status" NOT IN ('DRAFT', 'FINALIZED');

-- Step 2: Drop the now-superseded check constraint and the text column's default (a text-literal
-- default cannot be automatically cast to the new enum type)
ALTER TABLE "MatchRound" DROP CONSTRAINT IF EXISTS "MatchRound_status_check";
ALTER TABLE "MatchRound" ALTER COLUMN "status" DROP DEFAULT;

-- Step 3: Create the enum type and convert the column
CREATE TYPE "MatchRoundStatus" AS ENUM ('DRAFT', 'FINALIZED');
ALTER TABLE "MatchRound" ALTER COLUMN "status" TYPE "MatchRoundStatus" USING "status"::"MatchRoundStatus";

-- Step 4: Restore the default value, now typed as the enum
ALTER TABLE "MatchRound" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
