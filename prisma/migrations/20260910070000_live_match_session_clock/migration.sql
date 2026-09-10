-- ADR-0133 H2: persist the live-match clock so a reload / device swap / reconnect
-- reconstructs it deterministically instead of resetting to "before kickoff".
-- Additive only (nullable / defaulted columns) — safe under ADR-0105 regardless of deploy order.

ALTER TABLE "LiveMatchSession"
  ADD COLUMN "clockPeriod" "MatchPeriod" NOT NULL DEFAULT 'BEFORE',
  ADD COLUMN "clockRunning" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "clockPeriodStartedAt" TIMESTAMP(3),
  ADD COLUMN "clockElapsedBeforeMs" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clockUpdatedAt" TIMESTAMP(3);
