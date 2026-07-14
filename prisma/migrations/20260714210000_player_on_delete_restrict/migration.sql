-- Change onDelete from Cascade to Restrict on PlayerPosition.playerId
ALTER TABLE "PlayerPosition" DROP CONSTRAINT "PlayerPosition_playerId_fkey",
  ADD CONSTRAINT "PlayerPosition_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Change onDelete from Cascade to Restrict on MovementCandidate.playerId
ALTER TABLE "MovementCandidate" DROP CONSTRAINT "MovementCandidate_playerId_fkey",
  ADD CONSTRAINT "MovementCandidate_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add explicit Restrict on Player FKs that previously had implicit Restrict (no onDelete specified)
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_playerId_fkey",
  ADD CONSTRAINT "Availability_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Selection" DROP CONSTRAINT "Selection_playerId_fkey",
  ADD CONSTRAINT "Selection_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MovementLedger" DROP CONSTRAINT "MovementLedger_playerId_fkey",
  ADD CONSTRAINT "MovementLedger_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlayerLock" DROP CONSTRAINT "PlayerLock_playerId_fkey",
  ADD CONSTRAINT "PlayerLock_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PostMatchPlayerActual" DROP CONSTRAINT "PostMatchPlayerActual_playerId_fkey",
  ADD CONSTRAINT "PostMatchPlayerActual_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Goal" DROP CONSTRAINT "Goal_playerId_fkey",
  ADD CONSTRAINT "Goal_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Assist" DROP CONSTRAINT "Assist_playerId_fkey",
  ADD CONSTRAINT "Assist_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchReportAbsence" DROP CONSTRAINT "MatchReportAbsence_playerId_fkey",
  ADD CONSTRAINT "MatchReportAbsence_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchReportPlayerStat" DROP CONSTRAINT "MatchReportPlayerStat_playerId_fkey",
  ADD CONSTRAINT "MatchReportPlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlayerReadinessSignal" DROP CONSTRAINT "PlayerReadinessSignal_playerId_fkey",
  ADD CONSTRAINT "PlayerReadinessSignal_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchExecutionFeedback" DROP CONSTRAINT "MatchExecutionFeedback_playerId_fkey",
  ADD CONSTRAINT "MatchExecutionFeedback_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventPlayerAvailability" DROP CONSTRAINT "EventPlayerAvailability_playerId_fkey",
  ADD CONSTRAINT "EventPlayerAvailability_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventSquadPlayer" DROP CONSTRAINT "EventSquadPlayer_playerId_fkey",
  ADD CONSTRAINT "EventSquadPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;