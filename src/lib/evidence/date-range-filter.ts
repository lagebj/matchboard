/**
 * Merges an optional `{ from, to }` pair into one Prisma `startsAt` range filter.
 *
 * Two separate conditional spreads each keyed `startsAt` (e.g.
 * `{ ...(from ? { startsAt: { gte: from } } : {}), ...(to ? { startsAt: { lte: to } } : {}) }`)
 * silently let the second spread clobber the first instead of merging — a real bug found while
 * building the Evidence-Informed Match Planning programme's historical catch-up tool (Bundle 2),
 * also present in `opponent-replay.ts`'s equivalent queries before this fix. Both bounds must
 * live on the same object.
 */
export function startsAtRangeFilter(options?: { from?: Date; to?: Date }): { gte?: Date; lte?: Date } | undefined {
  if (!options?.from && !options?.to) return undefined;
  return {
    ...(options.from ? { gte: options.from } : {}),
    ...(options.to ? { lte: options.to } : {}),
  };
}
