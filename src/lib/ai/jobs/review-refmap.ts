import "server-only";
import { Prisma } from "@/generated/prisma/client";

/**
 * The `refMap` persisted-review contract (ref-token resolution fix): every SUCCEEDED review
 * from the 2026-09-28 fix onward carries its own `ref -> {subjectType, entityId}` map. Reviews
 * persisted before the column existed have SQL-NULL `refMap`; rows written since with an
 * explicit `null` carry JSON-null. Either way, a review without a real map degrades to raw
 * `P01`/`M01` tokens at display time — and because every enqueue path treated a same-fingerprint
 * SUCCEEDED review as complete, those scopes would never be re-reviewed and never self-repair.
 *
 * The fix: "SUCCEEDED" for dedup purposes means SUCCEEDED **with** a persisted refMap. A
 * no-map review no longer blocks its own replacement, so any re-trigger (the "Run AI analysis
 * on existing data" tool, or the natural domain trigger) re-reviews the scope once; the
 * runner's atomic supersession keeps the old content visible until the new review actually
 * succeeds, so nothing blinks out.
 *
 * `not: Prisma.AnyNull` is the one null-comparison that excludes both SQL NULL and JSON null
 * on a nullable Json column (verified against Prisma 7.10: `not: DbNull` matches JSON-null
 * rows, `not: JsonNull` matches SQL-NULL rows — each misses the other; AnyNull excludes both).
 */

/** Prisma filter fragment matching a review whose `refMap` column holds a real JSON object. */
export const REFMAP_PRESENT_FILTER = { refMap: { not: Prisma.AnyNull } } as const;
