-- ADR-0140: Event persisted clock parity with League (ADR-0133 H2). Same fields/semantics as
-- LiveMatchSession's clock columns — no second clock model. Additive only (nullable / defaulted
-- columns): existing rows default to BEFORE / not running / 0 elapsed, no historical clock
-- reconstruction is attempted, no row is deleted, no report is changed.

ALTER TABLE "EventLiveMatchSession"
  ADD COLUMN "clockPeriod" "MatchPeriod" NOT NULL DEFAULT 'BEFORE',
  ADD COLUMN "clockRunning" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "clockPeriodStartedAt" TIMESTAMP(3),
  ADD COLUMN "clockElapsedBeforeMs" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clockUpdatedAt" TIMESTAMP(3);
