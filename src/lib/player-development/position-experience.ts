import { db } from "@/lib/db";
import { type OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export type PositionExperienceRow = {
  playerId: string;
  positionId: string;
  matchCount: number;
  distinctRoundCount: number;
  lastPlayedAt: Date | null;
  observations: Array<{
    id: string;
    direction: string;
    observedAt: Date;
    matchId: string;
  }>;
};

export async function getPositionExperienceForPlayer(
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<PositionExperienceRow[]> {
  if (orgFilter.type !== "org") return [];

  const observations = await db.playerDevelopmentObservation.findMany({
    where: {
      playerId,
      kind: "POSITION",
      ...orgFilter.filterNullable,
    },
    orderBy: { observedAt: "desc" },
    select: {
      id: true,
      positionId: true,
      direction: true,
      observedAt: true,
      matchId: true,
    },
  });

  const byPosition = new Map<string, Array<{
    id: string;
    direction: string;
    observedAt: Date;
    matchId: string;
  }>>();

  for (const obs of observations) {
    if (!obs.positionId) continue;
    const existing = byPosition.get(obs.positionId) ?? [];
    existing.push({
      id: obs.id,
      direction: obs.direction,
      observedAt: obs.observedAt,
      matchId: obs.matchId,
    });
    byPosition.set(obs.positionId, existing);
  }

  const results: PositionExperienceRow[] = [];

  for (const [positionId, obsList] of byPosition) {
    const matchIds = new Set(obsList.map((o) => o.matchId));
    const lastPlayedAt = obsList.length > 0
      ? obsList.reduce((latest: Date, o) => o.observedAt > latest ? o.observedAt : latest, obsList[0].observedAt)
      : null;

    results.push({
      playerId,
      positionId,
      matchCount: matchIds.size,
      distinctRoundCount: matchIds.size,
      lastPlayedAt,
      observations: obsList,
    });
  }

  return results.sort((a, b) => b.matchCount - a.matchCount);
}

export function evaluatePositionEvidence(
  observations: Array<{
    id: string;
    direction: string;
    observedAt: Date;
    matchId: string;
  }>,
  baselineAt: Date | null,
): { confidence: "LOW" | "MEDIUM" | "HIGH"; direction: "POSITIVE" | "NEGATIVE" | null; alignedCount: number; distinctMatchCount: number } | null {
  const afterBaseline = baselineAt
    ? observations.filter((o) => o.observedAt > baselineAt)
    : observations;

  if (afterBaseline.length === 0) return null;

  const positive = afterBaseline.filter((o) => o.direction === "POSITIVE");
  const negative = afterBaseline.filter((o) => o.direction === "NEGATIVE");
  const aligned = positive.length >= negative.length ? positive : negative;
  const contradictory = positive.length >= negative.length ? negative : positive;
  const distinctMatchIds = new Set(afterBaseline.map((o) => o.matchId));

  const alignedCount = aligned.length;
  const distinctMatchCount = distinctMatchIds.size;

  if (alignedCount < 3 || distinctMatchCount < 3 || alignedCount - contradictory.length < 2) {
    return { confidence: "LOW", direction: null, alignedCount, distinctMatchCount };
  }
  if (alignedCount >= 5 && distinctMatchCount >= 4 && contradictory.length <= 1) {
    return { confidence: "HIGH", direction: positive.length >= negative.length ? "POSITIVE" : "NEGATIVE", alignedCount, distinctMatchCount };
  }
  return { confidence: "MEDIUM", direction: positive.length >= negative.length ? "POSITIVE" : "NEGATIVE", alignedCount, distinctMatchCount };
}