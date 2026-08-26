import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export type RotationChangeComparison = {
  changeId: string;
  sequence: number;
  outPlayerId: string | null;
  inPlayerId: string | null;
  outPosition: string | null;
  inPosition: string | null;
  positionOnly: boolean;
  approximateMatchSeconds: number | null;
  plannedStatus: string;
  outPlayerName: string;
  inPlayerName: string;
  deviation: "applied" | "skipped" | "modified" | "pending" | "unplanned";
  deviationNote: string | null;
};

export type RotationVsActualSummary = {
  rotationId: string;
  matchId: string;
  teamId: string;
  rotationStatus: string;
  totalPlannedChanges: number;
  applied: number;
  skipped: number;
  modified: number;
  pending: number;
  unplannedSubstitutions: number;
  changes: RotationChangeComparison[];
  minuteDeviations: MinuteDeviation[];
};

export type MinuteDeviation = {
  playerId: string;
  playerName: string;
  plannedMinutes: number;
  realisedMinutes: number;
  deviation: number;
  plannedPositions: string[];
  realisedPositions: string[];
};

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

  if (!rotation) return null;
  if (rotation.organisationId !== orgId) return null;

  const matchRotations = await db.matchRotation.findMany({
    where: { matchId, organisationId: orgId },
    include: {
      outPlayer: { select: { id: true, firstName: true, lastName: true } },
      inPlayer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const changes: RotationChangeComparison[] = rotation.changes.map((c) => {
    const deviation: RotationChangeComparison["deviation"] =
      c.status === "APPLIED" ? "applied" :
      c.status === "SKIPPED" ? "skipped" :
      c.status === "MODIFIED" ? "modified" :
      "pending";

    let deviationNote: string | null = null;
    if (c.status === "SKIPPED") deviationNote = "Planned change was skipped during live match";
    if (c.status === "MODIFIED") deviationNote = "Planned change was modified during live match";
    if (c.status === "PENDING") deviationNote = "Planned change was not resolved during live match";

    return {
      changeId: c.id,
      sequence: c.sequence,
      outPlayerId: c.outPlayerId,
      inPlayerId: c.inPlayerId,
      outPosition: c.outPosition,
      inPosition: c.inPosition,
      positionOnly: c.positionOnly,
      approximateMatchSeconds: c.approximateMatchSeconds,
      plannedStatus: c.status,
      outPlayerName: c.outPlayer ? `${c.outPlayer.firstName}${c.outPlayer.lastName ? ` ${c.outPlayer.lastName}` : ""}` : "—",
      inPlayerName: c.inPlayer ? `${c.inPlayer.firstName}${c.inPlayer.lastName ? ` ${c.inPlayer.lastName}` : ""}` : "—",
      deviation,
      deviationNote,
    };
  });

  const plannedPlayerIds = new Set<string>();
  for (const c of rotation.changes) {
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
    if (r.source === "LIVE" && !rotation.changes.some((c) => c.liveEventId === r.liveEventId)) {
      unplannedCount++;
    }
  }

  const minuteDeviations: MinuteDeviation[] = [];

  const allPlayerIds = new Set([...plannedPlayerIds, ...actualPlayerIds]);
  const playerMap = new Map<string, string>();
  for (const c of rotation.changes) {
    if (c.outPlayer) playerMap.set(c.outPlayer.id, `${c.outPlayer.firstName}${c.outPlayer.lastName ? ` ${c.outPlayer.lastName}` : ""}`);
    if (c.inPlayer) playerMap.set(c.inPlayer.id, `${c.inPlayer.firstName}${c.inPlayer.lastName ? ` ${c.inPlayer.lastName}` : ""}`);
  }
  for (const r of matchRotations) {
    if (r.outPlayer) playerMap.set(r.outPlayer.id, `${r.outPlayer.firstName}${r.outPlayer.lastName ? ` ${r.outPlayer.lastName}` : ""}`);
    if (r.inPlayer) playerMap.set(r.inPlayer.id, `${r.inPlayer.firstName}${r.inPlayer.lastName ? ` ${r.inPlayer.lastName}` : ""}`);
  }

  const selections = await db.selection.findMany({
    where: { matchId, status: "FINALIZED", match: { teamId } },
    select: { playerId: true },
  });

  const match = await db.match.findFirst({
    where: { id: matchId },
    select: { gameFormat: true },
  });

  const totalMatchSeconds = getMatchDurationSeconds(match?.gameFormat);

  for (const playerId of allPlayerIds) {
    const plannedMinutes = 0;
    const plannedPositions: string[] = [];

    const realisedRotations = matchRotations.filter(
      (r) => r.outPlayerId === playerId || r.inPlayerId === playerId
    );

    const isSubstitutedOut = realisedRotations.some((r) => r.outPlayerId === playerId && !r.positionOnly);
    const isSubstitutedIn = realisedRotations.some((r) => r.inPlayerId === playerId);

    const isPlannedStarter = selections.some((s) => s.playerId === playerId);
    let realisedMinutes = 0;
    const realisedPositions: string[] = [];

    if (isPlannedStarter && !isSubstitutedOut) {
      realisedMinutes = totalMatchSeconds / 60;
      realisedPositions.push("starter");
    } else if (isPlannedStarter && isSubstitutedOut) {
      const outRotation = realisedRotations.find((r) => r.outPlayerId === playerId && !r.positionOnly);
      if (outRotation) {
        const outSeconds = outRotation.matchSeconds ?? totalMatchSeconds / 2;
        realisedMinutes = outSeconds / 60;
        realisedPositions.push(outRotation.outPosition ?? "starter");
      }
    }

    if (isSubstitutedIn) {
      const inRotation = realisedRotations.find((r) => r.inPlayerId === playerId && !r.positionOnly);
      if (inRotation) {
        const inSeconds = inRotation.matchSeconds ?? 0;
        realisedMinutes += (totalMatchSeconds - inSeconds) / 60;
        realisedPositions.push(inRotation.inPosition ?? "bench");
      }
    }

    if (realisedMinutes > 0 || isPlannedStarter) {
      minuteDeviations.push({
        playerId,
        playerName: playerMap.get(playerId) ?? "—",
        plannedMinutes: Math.round(plannedMinutes * 10) / 10,
        realisedMinutes: Math.round(realisedMinutes * 10) / 10,
        deviation: Math.round((realisedMinutes - plannedMinutes) * 10) / 10,
        plannedPositions,
        realisedPositions,
      });
    }
  }

  return {
    rotationId: rotation.id,
    matchId: rotation.matchId,
    teamId: rotation.teamId,
    rotationStatus: rotation.status,
    totalPlannedChanges: rotation.changes.length,
    applied: rotation.changes.filter((c) => c.status === "APPLIED").length,
    skipped: rotation.changes.filter((c) => c.status === "SKIPPED").length,
    modified: rotation.changes.filter((c) => c.status === "MODIFIED").length,
    pending: rotation.changes.filter((c) => c.status === "PENDING").length,
    unplannedSubstitutions: unplannedCount,
    changes,
    minuteDeviations,
  };
}

function getMatchDurationSeconds(gameFormat: string | null | undefined): number {
  const durations: Record<string, number> = {
    "5v5": 40 * 60,
    "7v7": 50 * 60,
    "9v9": 60 * 60,
    "11v11": 90 * 60,
  };
  if (gameFormat && gameFormat in durations) return durations[gameFormat];
  return 60 * 60;
}