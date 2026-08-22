-- Distributed rate-limit counters (ARR-0019, platform-integrity-programme Phase 6).
-- Replaces the in-process Map in src/lib/rate-limit.ts, which couldn't enforce limits
-- across serverless instances. Brand-new table, no data migration needed.

CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
