-- ADR-0146 §4: the resolved period timeline (MatchPeriodTimingResolution).
--
-- Additive only: two new enums, one new table, no existing column touched. Hand-curated (not a
-- raw `prisma migrate diff` output) — per ARR-0036, a live diff against this repository's actual
-- databases also surfaces pre-existing, unrelated schema drift out of scope here; only the
-- statements for this change are included below, following the exact precedent already
-- established for ActualPositionInterval's matchId/eventMatchId dual-FK convention
-- (20260830110000_add_actual_position_interval, 20260831040000_generalize_evidence_for_event_matches).

CREATE TYPE "TimingResolutionSource" AS ENUM ('EXPLICIT_PERIOD_END', 'FINISH_LIVE_REPORTING', 'RECOVERED_BOUNDED');

CREATE TYPE "TimingReviewStatus" AS ENUM ('NOT_REQUIRED', 'NEEDS_REVIEW', 'REVIEWED');

CREATE TABLE "MatchPeriodTimingResolution" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "matchId" TEXT,
    "eventMatchId" TEXT,
    "period" "MatchPeriod" NOT NULL,
    "rawElapsedMs" INTEGER,
    "resolvedDurationMs" INTEGER NOT NULL,
    "resolutionSource" "TimingResolutionSource" NOT NULL,
    "reviewStatus" "TimingReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPeriodTimingResolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchPeriodTimingResolution_matchId_period_key" ON "MatchPeriodTimingResolution"("matchId", "period");
CREATE UNIQUE INDEX "MatchPeriodTimingResolution_eventMatchId_period_key" ON "MatchPeriodTimingResolution"("eventMatchId", "period");
CREATE INDEX "MatchPeriodTimingResolution_organisationId_idx" ON "MatchPeriodTimingResolution"("organisationId");
CREATE INDEX "MatchPeriodTimingResolution_reviewStatus_idx" ON "MatchPeriodTimingResolution"("reviewStatus");

ALTER TABLE "MatchPeriodTimingResolution" ADD CONSTRAINT "MatchPeriodTimingResolution_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchPeriodTimingResolution" ADD CONSTRAINT "MatchPeriodTimingResolution_eventMatchId_fkey" FOREIGN KEY ("eventMatchId") REFERENCES "EventMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchPeriodTimingResolution" ADD CONSTRAINT "MatchPeriodTimingResolution_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one of matchId/eventMatchId must be set — Prisma cannot express this; hand-added,
-- matching ActualPositionInterval's own exact convention.
ALTER TABLE "MatchPeriodTimingResolution" ADD CONSTRAINT "MatchPeriodTimingResolution_exactly_one_match_source" CHECK (("matchId" IS NOT NULL) != ("eventMatchId" IS NOT NULL));
