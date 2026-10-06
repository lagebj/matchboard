import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getPlannedMinutesProjectionForMatch } from "@/lib/planned-rotation/planned-rotation";
import { computePlayerMinutesFromIntervals, type ActualIntervalFact } from "@/lib/matches/match-detail-view-model";

export type RotationChangeComparison = {
  changeId: string;
  sequence: number;
  outPlayerId: string | null;
  inPlayerId: string | null;
  outPosition: string | null;
  inPosition: string | null;
  positionOnly: boolean;
  approximateMatchSeconds: number | null;
  actualMatchSeconds: number | null;
  plannedStatus: string;
  outPlayerName: string;
  inPlayerName: string;
  deviation: "applied" | "skipped" | "modified" | "pending" | "delayed" | "unplanned";
  deviationNote: string | null;
};

export type RotationVsActualSummary = {
  rotationId: string | null;
  matchId: string;
  teamId: string;
  rotationStatus: string | null;
  totalPlannedChanges: number;
  applied: number;
  skipped: number;
  modified: number;
  pending: number;
  delayed: number;
  unplannedSubstitutions: number;
  changes: RotationChangeComparison[];
  minuteDeviations: MinuteDeviation[];
  /** Whether a match line-up exists to project planned minutes from (ADR-0157 C6) — `false`
   * means every `plannedMinutes` below is honestly `0` because there is no plan, not a guess. */
  hasLineup: boolean;
  totalMatchSeconds: number | null;
};

export type MinuteDeviation = {
  playerId: string;
  playerName: string;
  plannedMinutes: number;
  /** `null` when the player has no closed `ActualPositionInterval` (never recorded, or only an
   * open/incomplete interval) — genuinely unknown, never assumed to match the plan or guessed
   * as "rest of match" (ADR-0157 C6 required correction). */
  realisedMinutes: number | null;
  /** `null` when `realisedMinutes` is `null` — a deviation cannot be computed from an unknown
   * actual value. */
  deviation: number | null;
  plannedPositions: string[];
  realisedPositions: string[];
};

/** Collapses consecutive duplicate position labels (subbed off and later subbed back on at the
 * same spot reads as one entry, not a repeated one) without reordering or deduplicating
 * non-adjacent repeats. */
function collapseConsecutive(positions: string[]): string[] {
  const result: string[] = [];
  for (const position of positions) {
    if (result[result.length - 1] !== position) result.push(position);
  }
  return result;
}

/**
 * Plan-vs-actual comparison for a match/team (ADR-0157 C6). Planned minutes/positions come from
 * `getPlannedMinutesProjectionForMatch()` — the same owner `PlannedPlayingTimePanel` uses — never
 * a second projection and never the previous `plannedMinutes = 0` placeholder. Realised
 * minutes/positions come only from `ActualPositionInterval` (ARR-0052); `MatchRotation` rows are
 * still used for the planned-change fidelity list (`changes`) below, which is a genuinely
 * different question (did this specific planned substitution get applied on time?), not a source
 * of realised minutes.
 *
 * A saved `PlannedRotation` row is no longer required for this to return data — a match with only
 * a starting line-up and no planned in-match changes still has a real plan (play the starting XI
 * the whole match) worth comparing against reality; `rotationId`/`rotationStatus` are `null` and
 * `changes`/the fidelity counters are empty in that case.
 */
export async function getRotationVsActual(
  matchId: string,
  teamId: string,
  orgFilter: OrgFilterMode,
): Promise<RotationVsActualSummary | null> {
  const orgId = orgFilter.filter.organisationId;
  if (!orgId) return null;

  const rotation = await db.plannedRotation.findUnique({
    where: { matchId_teamId: { matchId, teamId } },
    include: {
      changes: {
        orderBy: { sequence: "asc" },
        include: {
          outPlayer: { select: { id: true, firstName: true, lastName: true } },
          inPlayer: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (rotation && rotation.organisationId !== orgId) return null;

  const matchRotations = await db.matchRotation.findMany({
    where: { matchId, organisationId: orgId },
    include: {
      outPlayer: { select: { id: true, firstName: true, lastName: true } },
      inPlayer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const rotationChanges = rotation?.changes ?? [];

  const changes: RotationChangeComparison[] = rotationChanges.map((c) => {
    const deviation: RotationChangeComparison["deviation"] =
      c.status === "APPLIED" ? "applied" :
      c.status === "SKIPPED" ? "skipped" :
      c.status === "MODIFIED" ? "modified" :
      c.status === "DELAYED" ? "delayed" :
      "pending";

    let deviationNote: string | null = null;
    if (c.status === "SKIPPED") deviationNote = "Planned change was skipped during live match";
    if (c.status === "MODIFIED") deviationNote = "Planned change was modified during live match";
    if (c.status === "PENDING") deviationNote = "Planned change was not resolved during live match";
    if (c.status === "DELAYED") deviationNote = "Planned change was delayed and not yet resolved during live match";
    if (c.status === "APPLIED" && c.actualMatchSeconds !== null && c.approximateMatchSeconds !== null) {
      const deviationSeconds = c.actualMatchSeconds - c.approximateMatchSeconds;
      if (Math.abs(deviationSeconds) >= 60) {
        const deviationMinutes = Math.round(deviationSeconds / 60);
        deviationNote = `Applied ${Math.abs(deviationMinutes)} min ${deviationMinutes > 0 ? "later" : "earlier"} than planned`;
      }
    }

    return {
      changeId: c.id,
      sequence: c.sequence,
      outPlayerId: c.outPlayerId,
      inPlayerId: c.inPlayerId,
      outPosition: c.outPosition,
      inPosition: c.inPosition,
      positionOnly: c.positionOnly,
      approximateMatchSeconds: c.approximateMatchSeconds,
      actualMatchSeconds: c.actualMatchSeconds,
      plannedStatus: c.status,
      outPlayerName: c.outPlayer ? `${c.outPlayer.firstName}${c.outPlayer.lastName ? ` ${c.outPlayer.lastName}` : ""}` : "—",
      inPlayerName: c.inPlayer ? `${c.inPlayer.firstName}${c.inPlayer.lastName ? ` ${c.inPlayer.lastName}` : ""}` : "—",
      deviation,
      deviationNote,
    };
  });

  const plannedPlayerIds = new Set<string>();
  for (const c of rotationChanges) {
    if (c.outPlayerId) plannedPlayerIds.add(c.outPlayerId);
    if (c.inPlayerId) plannedPlayerIds.add(c.inPlayerId);
  }

  const actualPlayerIds = new Set<string>();
  for (const r of matchRotations) {
    if (r.outPlayerId) actualPlayerIds.add(r.outPlayerId);
    if (r.inPlayerId) actualPlayerIds.add(r.inPlayerId);
  }

  let unplannedCount = 0;
  for (const r of matchRotations) {
    if (r.source === "LIVE" && !rotationChanges.some((c) => c.liveEventId === r.liveEventId)) {
      unplannedCount++;
    }
  }

  const playerMap = new Map<string, string>();
  for (const c of rotationChanges) {
    if (c.outPlayer) playerMap.set(c.outPlayer.id, `${c.outPlayer.firstName}${c.outPlayer.lastName ? ` ${c.outPlayer.lastName}` : ""}`);
    if (c.inPlayer) playerMap.set(c.inPlayer.id, `${c.inPlayer.firstName}${c.inPlayer.lastName ? ` ${c.inPlayer.lastName}` : ""}`);
  }
  for (const r of matchRotations) {
    if (r.outPlayer) playerMap.set(r.outPlayer.id, `${r.outPlayer.firstName}${r.outPlayer.lastName ? ` ${r.outPlayer.lastName}` : ""}`);
    if (r.inPlayer) playerMap.set(r.inPlayer.id, `${r.inPlayer.firstName}${r.inPlayer.lastName ? ` ${r.inPlayer.lastName}` : ""}`);
  }

  // Required correction (ADR-0157 C6): the real planned-minutes/position owner, shared with
  // `PlannedPlayingTimePanel` — never a second projection, never a hardcoded `0`.
  const projection = await getPlannedMinutesProjectionForMatch(matchId, teamId, orgFilter);
  const projectionByPlayer = new Map(projection.rows.map((r) => [r.playerId, r]));

  // Actual source: `ActualPositionInterval` only (ARR-0052) — never `MatchRotation.matchSeconds`,
  // which this replaced; that field only tells us a substitution happened, not how long anyone
  // was actually on the pitch, and treating an open interval's remainder as "to full time" was
  // exactly the kind of guess ADR-0157 C6 prohibits.
  const intervalRows = await db.actualPositionInterval.findMany({
    where: { matchId, organisationId: orgId, playerId: { not: null } },
    select: { playerId: true, position: true, startedAtMs: true, endedAtMs: true },
    orderBy: { startedAtMs: "asc" },
  });

  const intervalFacts: ActualIntervalFact[] = intervalRows.map((i) => ({
    participantKey: i.playerId as string,
    startedAtMs: i.startedAtMs,
    endedAtMs: i.endedAtMs,
  }));
  const realisedMinutesByPlayer = computePlayerMinutesFromIntervals(intervalFacts);

  const realisedPositionsByPlayer = new Map<string, string[]>();
  for (const row of intervalRows) {
    if (!row.playerId) continue;
    const list = realisedPositionsByPlayer.get(row.playerId) ?? [];
    list.push(row.position);
    realisedPositionsByPlayer.set(row.playerId, list);
  }

  const allPlayerIds = new Set<string>([
    ...projection.rows
      .filter((r) => r.plannedMinutes > 0 || r.startingPosition !== null)
      .map((r) => r.playerId),
    ...intervalRows.filter((r) => r.playerId !== null).map((r) => r.playerId as string),
    ...plannedPlayerIds,
    ...actualPlayerIds,
  ]);

  const nameLookupIds = [...allPlayerIds].filter((id) => !playerMap.has(id));
  if (nameLookupIds.length > 0) {
    const players = await db.player.findMany({
      where: { id: { in: nameLookupIds }, organisationId: orgId },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const p of players) {
      playerMap.set(p.id, `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`);
    }
  }

  const minuteDeviations: MinuteDeviation[] = [...allPlayerIds].map((playerId) => {
    const projectionRow = projectionByPlayer.get(playerId);
    const plannedMinutes = projectionRow?.plannedMinutes ?? 0;
    const plannedPositions = collapseConsecutive(projectionRow?.positions.map((p) => p.position) ?? []);

    const realisedMinutes = realisedMinutesByPlayer.get(playerId) ?? null;
    const realisedPositions = collapseConsecutive(realisedPositionsByPlayer.get(playerId) ?? []);

    const deviation = realisedMinutes === null ? null : Math.round((realisedMinutes - plannedMinutes) * 10) / 10;

    return {
      playerId,
      playerName: playerMap.get(playerId) ?? "—",
      plannedMinutes: Math.round(plannedMinutes * 10) / 10,
      realisedMinutes,
      deviation,
      plannedPositions,
      realisedPositions,
    };
  });

  return {
    rotationId: rotation?.id ?? null,
    matchId,
    teamId,
    rotationStatus: rotation?.status ?? null,
    totalPlannedChanges: rotationChanges.length,
    applied: rotationChanges.filter((c) => c.status === "APPLIED").length,
    skipped: rotationChanges.filter((c) => c.status === "SKIPPED").length,
    modified: rotationChanges.filter((c) => c.status === "MODIFIED").length,
    pending: rotationChanges.filter((c) => c.status === "PENDING").length,
    delayed: rotationChanges.filter((c) => c.status === "DELAYED").length,
    unplannedSubstitutions: unplannedCount,
    changes,
    minuteDeviations,
    hasLineup: projection.hasLineup,
    totalMatchSeconds: projection.totalMatchSeconds,
  };
}
