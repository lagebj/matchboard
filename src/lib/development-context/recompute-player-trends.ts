import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { computeTrendDraft, dimensionGroupKey, type TrendDraft, type TrendWindowMeasurement } from "./trend-derivation";
import { getMetricDefinition, TREND_ENABLED_METRIC_KEYS } from "./metric-registry";
import type { EvidenceRef, MetricKey } from "./types";

/**
 * Trend recompute (ADR-0155 step B6). Player-scoped, not match-scoped -- a trend aggregates
 * across a player's whole eligible match history for one metric+dimension combination, so this
 * replaces all of a player's current `DerivedTrend` rows wholesale in one transaction, the same
 * "replace current derived materialization" rule `persistMatchContextPack` already follows for
 * `DerivedMeasurement`.
 *
 * No `server-only` guard, matching every other file in this module (see context-pack.ts's own
 * comment on why).
 */

type EligibleRow = {
  metricKey: string;
  dimensions: unknown;
  value: number;
  numerator: number | null;
  denominator: number | null;
  matchId: string | null;
  eventMatchId: string | null;
  scopeKey: string;
};

async function resolveStartsAtByScopeKey(rows: EligibleRow[]): Promise<Map<string, Date>> {
  const matchIds = [...new Set(rows.filter((r) => r.matchId).map((r) => r.matchId!))];
  const eventMatchIds = [...new Set(rows.filter((r) => r.eventMatchId).map((r) => r.eventMatchId!))];

  const [matches, eventMatches] = await Promise.all([
    matchIds.length > 0 ? db.match.findMany({ where: { id: { in: matchIds } }, select: { id: true, startsAt: true } }) : [],
    eventMatchIds.length > 0
      ? db.eventMatch.findMany({ where: { id: { in: eventMatchIds } }, select: { id: true, startsAt: true } })
      : [],
  ]);

  const startsAtByScopeKey = new Map<string, Date>();
  for (const match of matches) startsAtByScopeKey.set(match.id, match.startsAt);
  for (const eventMatch of eventMatches) startsAtByScopeKey.set(eventMatch.id, eventMatch.startsAt);
  return startsAtByScopeKey;
}

/** Recomputes and replaces every `DerivedTrend` row for one player, across every trend-enabled metric and dimension combination they have eligible data for. */
export async function recomputePlayerTrends(playerId: string, organisationId: string): Promise<{ trendsWritten: number }> {
  const rows = (await db.derivedMeasurement.findMany({
    where: { playerId, eligible: true, metricKey: { in: [...TREND_ENABLED_METRIC_KEYS] } },
    select: { metricKey: true, dimensions: true, value: true, numerator: true, denominator: true, matchId: true, eventMatchId: true, scopeKey: true },
  })) as EligibleRow[];

  if (rows.length === 0) {
    await db.derivedTrend.deleteMany({ where: { playerId } });
    return { trendsWritten: 0 };
  }

  const startsAtByScopeKey = await resolveStartsAtByScopeKey(rows);

  const groups = new Map<string, { metricKey: MetricKey; dimensions: Record<string, string>; items: (TrendWindowMeasurement & { startsAt: Date })[] }>();
  for (const row of rows) {
    const startsAt = startsAtByScopeKey.get(row.scopeKey);
    if (!startsAt) continue; // cannot chronologically order without a date -- skip rather than guess.

    const dimensions = row.dimensions as Record<string, string>;
    const key = dimensionGroupKey(row.metricKey, dimensions);
    const group = groups.get(key) ?? { metricKey: row.metricKey as MetricKey, dimensions, items: [] };
    group.items.push({
      scopeKey: row.scopeKey,
      value: row.value,
      numerator: row.numerator ?? undefined,
      denominator: row.denominator ?? undefined,
      startsAt,
    });
    groups.set(key, group);
  }

  const drafts: TrendDraft[] = [];
  for (const group of groups.values()) {
    const definition = getMetricDefinition(group.metricKey);
    const chronological = [...group.items].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const draft = computeTrendDraft(definition, group.dimensions, chronological);
    if (draft) drafts.push(draft);
  }

  await db.$transaction(async (tx) => {
    await tx.derivedTrend.deleteMany({ where: { playerId } });
    if (drafts.length > 0) {
      await tx.derivedTrend.createMany({
        data: drafts.map((draft) => {
          const sourceRefs: EvidenceRef[] = [...new Set([...draft.previousWindowScopeKeys, ...draft.latestWindowScopeKeys])].map((scopeKey) => ({
            kind: "DERIVED_MEASUREMENT",
            id: scopeKey,
          }));
          return {
            organisationId,
            playerId,
            metricKey: draft.metricKey,
            metricVersion: draft.metricVersion,
            dimensions: draft.dimensions as unknown as Prisma.InputJsonValue,
            previousWindowMatchIds: draft.previousWindowScopeKeys as unknown as Prisma.InputJsonValue,
            latestWindowMatchIds: draft.latestWindowScopeKeys as unknown as Prisma.InputJsonValue,
            previousValue: draft.previousValue,
            latestValue: draft.latestValue,
            delta: draft.delta,
            direction: draft.direction,
            materialityThreshold: draft.materialityThreshold,
            coverage: "COMPLETE",
            eligible: true,
            missingInputs: [] as unknown as Prisma.InputJsonValue,
            warnings: [] as unknown as Prisma.InputJsonValue,
            sourceRefs: sourceRefs as unknown as Prisma.InputJsonValue,
            inputRevision: draft.inputRevision,
          };
        }),
      });
    }
  });

  return { trendsWritten: drafts.length };
}
