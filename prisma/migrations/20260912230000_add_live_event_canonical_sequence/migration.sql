-- ADR-0138 (Canonical Live Operations & Delayed-Concurrency, Bundle 2): persisted per-session
-- canonical sequence and acceptance/capture audit fields on both live event models. Additive
-- only (nullable columns) — safe under ADR-0105 regardless of deploy order. Every existing row
-- (and every row written via the direct-HTTP path until Bundle 4's single-mutation-path
-- cutover, ARR-0045) keeps `sequence = NULL`; Postgres treats multiple NULLs as distinct in a
-- unique constraint, so adding the constraint now does not require a backfill first.

ALTER TABLE "LiveMatchEvent"
  ADD COLUMN "sequence" INTEGER,
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "clientCapturedAt" TIMESTAMP(3),
  ADD COLUMN "originClientId" TEXT;

ALTER TABLE "EventLiveMatchEvent"
  ADD COLUMN "sequence" INTEGER,
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "clientCapturedAt" TIMESTAMP(3),
  ADD COLUMN "originClientId" TEXT;

CREATE UNIQUE INDEX "LiveMatchEvent_sessionId_sequence_key" ON "LiveMatchEvent"("sessionId", "sequence");

CREATE UNIQUE INDEX "EventLiveMatchEvent_sessionId_sequence_key" ON "EventLiveMatchEvent"("sessionId", "sequence");
