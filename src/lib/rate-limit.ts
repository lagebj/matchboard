import { db } from "@/lib/db";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

// Distributed rate limiting backed by RateLimitBucket (ARR-0019, platform-integrity-programme
// Phase 6). Replaces the previous in-process Map, which couldn't enforce limits across
// serverless instances — each cold-started function had its own empty counter. The single
// INSERT ... ON CONFLICT statement below is atomic in Postgres: concurrent callers for the same
// key serialize on the row and cannot double-count within the same window.
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = new Date();
  const newResetAt = new Date(now.getTime() + windowMs);

  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${newResetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${newResetAt} ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"
  `;

  const row = rows[0];
  const count = Number(row.count);
  const resetAt = new Date(row.resetAt).getTime();

  return {
    allowed: count <= limit,
    remaining: Math.max(limit - count, 0),
    resetAt,
  };
}

export async function clearRateLimitStore(): Promise<void> {
  await db.$executeRaw`DELETE FROM "RateLimitBucket"`;
}
