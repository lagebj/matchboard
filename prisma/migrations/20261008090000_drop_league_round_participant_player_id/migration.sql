-- ADR-0158: LeagueRoundParticipant.playerId was added by ADR-0106 "for now", kept nullable
-- alongside guestPlayerId for hypothetical future Player round-registration. Mechanical
-- verification (repo-wide grep, excluding generated Prisma output) found zero current writer
-- and zero current reader of this column anywhere in application code -- only guestPlayerId is
-- ever populated. This table becomes guest-only by construction, mirroring
-- LeagueMatchGuestAssignment's own guest-only design.
--
-- Self-verifying guard (ADR-0105 destructive-migration discipline): abort instead of silently
-- dropping data if production ever disagrees with the mechanical verification above.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "LeagueRoundParticipant" WHERE "playerId" IS NOT NULL) THEN
    RAISE EXCEPTION 'LeagueRoundParticipant.playerId has non-null rows; refusing to drop the column. See ADR-0158.';
  END IF;
  IF EXISTS (SELECT 1 FROM "LeagueRoundParticipant" WHERE "guestPlayerId" IS NULL) THEN
    RAISE EXCEPTION 'LeagueRoundParticipant.guestPlayerId has null rows; refusing to make it required. See ADR-0158.';
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "LeagueRoundParticipant" DROP CONSTRAINT "LeagueRoundParticipant_playerId_fkey";

-- DropIndex (backed @@unique([matchRoundId, playerId]))
DROP INDEX "LeagueRoundParticipant_matchRoundId_playerId_key";

-- DropConstraint (the exactly-one-participant CHECK -- no longer needed, guest-only now)
ALTER TABLE "LeagueRoundParticipant" DROP CONSTRAINT "LeagueRoundParticipant_exactly_one_participant";

-- AlterTable
ALTER TABLE "LeagueRoundParticipant"
  DROP COLUMN "playerId",
  ALTER COLUMN "guestPlayerId" SET NOT NULL;
