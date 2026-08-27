import { ActualIntervalSource } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  computePositionIntervals,
  type StarterAssignment,
} from "@/lib/evidence/lineup-state";
import { ROLE_TYPE_TO_LINE, laneFromGridX, type FormationSlotRoleType } from "@/lib/formations/types";

type RotationInput = {
  outPlayerId: string;
  inPlayerId: string;
  outPosition: string | null;
  inPosition: string | null;
  positionOnly: boolean;
  matchSeconds: number;
};

type PositionChangeInput = {
  playerId: string;
  fromPosition: string;
  toPosition: string;
  matchSeconds: number;
};

export type ActualIntervalRow = {
  playerId: string;
  position: string;
  line: string | null;
  lane: string | null;
  startedAtMs: number;
  endedAtMs: number | null;
  source: ActualIntervalSource;
  approximateTiming: boolean;
};

export async function rebuildActualTimeline(matchId: string): Promise<{
  intervalsCreated: number;
}> {
  const match = await db.match.findFirst({
    where: { id: matchId },
    select: {
      id: true,
      organisationId: true,
      matchDurationMinutes: true,
    },
  });

  if (!match) {
    throw new Error("Match not found.");
  }

  const matchEndMs = match.matchDurationMinutes
    ? match.matchDurationMinutes * 60 * 1000
    : null;

  const starters = await getStartingLineup(matchId);
  const rotations = await getMatchRotations(matchId);
  const positionChanges = await getPositionChanges(matchId);

  const computedIntervals = computePositionIntervals(
    starters,
    rotations,
    positionChanges,
    matchEndMs,
  );

  const intervalRows: ActualIntervalRow[] = computedIntervals.map((interval) => ({
    playerId: interval.playerId,
    position: interval.position,
    line: interval.line ?? null,
    lane: interval.lane ?? null,
    startedAtMs: interval.startedAtMs,
    endedAtMs: interval.endedAtMs,
    source: inferSource(interval, starters),
    approximateTiming: false,
  }));

  await db.$transaction(async (tx) => {
    await tx.actualPositionInterval.deleteMany({
      where: { matchId },
    });

    if (intervalRows.length > 0) {
      await tx.actualPositionInterval.createMany({
        data: intervalRows.map((row) => ({
          matchId,
          organisationId: match.organisationId,
          playerId: row.playerId,
          position: row.position,
          line: row.line,
          lane: row.lane,
          startedAtMs: row.startedAtMs,
          endedAtMs: row.endedAtMs,
          source: row.source,
          approximateTiming: row.approximateTiming,
        })),
      });
    }

    await populatePlayerActualPositions(tx, matchId, intervalRows);
  });

  return { intervalsCreated: intervalRows.length };
}

async function getStartingLineup(matchId: string): Promise<StarterAssignment[]> {
  const lineup = await db.matchLineup.findFirst({
    where: { matchId },
    select: { id: true },
  });

  if (!lineup) return [];

  const assignments = await db.matchLineupAssignment.findMany({
    where: { matchLineupId: lineup.id, playerId: { not: null } },
    select: {
      playerId: true,
      slotId: true,
    },
  });

  if (assignments.length === 0) return [];

  const slotIds = assignments.map((a) => a.slotId);
  const slots = await db.formationSlot.findMany({
    where: { id: { in: slotIds } },
    select: { id: true, roleType: true, label: true, gridX: true },
  });

  const slotMap = new Map(slots.map((s) => [s.id, s]));

  return assignments
    .filter((a) => a.playerId !== null)
    .map((a) => {
      const slot = slotMap.get(a.slotId);
      const roleType = slot?.roleType as FormationSlotRoleType | undefined;
      return {
        playerId: a.playerId!,
        position: slot?.roleType || slot?.label || "unknown",
        line: roleType ? (ROLE_TYPE_TO_LINE[roleType] ?? null) : null,
        lane: slot ? laneFromGridX(slot.gridX) : null,
      };
    });
}

async function getMatchRotations(matchId: string): Promise<RotationInput[]> {
  const rotations = await db.matchRotation.findMany({
    where: { matchId },
    select: {
      outPlayerId: true,
      inPlayerId: true,
      outPosition: true,
      inPosition: true,
      positionOnly: true,
      matchSeconds: true,
    },
    orderBy: { matchSeconds: "asc" },
  });

  return rotations.map((r) => ({
    outPlayerId: r.outPlayerId,
    inPlayerId: r.inPlayerId,
    outPosition: r.outPosition,
    inPosition: r.inPosition,
    positionOnly: r.positionOnly,
    matchSeconds: r.matchSeconds ?? 0,
  }));
}

async function getPositionChanges(matchId: string): Promise<PositionChangeInput[]> {
  const events = await db.liveMatchEvent.findMany({
    where: {
      matchId,
      eventType: "POSITIONS_CHANGED",
      correctionType: null,
    },
    select: {
      playerId: true,
      payload: true,
      matchSeconds: true,
    },
    orderBy: { matchSeconds: "asc" },
  });

  return events
    .filter((e) => e.playerId && e.payload)
    .map((e) => {
      const payload = e.payload as Record<string, unknown> | null;
      return {
        playerId: e.playerId!,
        fromPosition: (payload?.fromPosition as string) ?? "unknown",
        toPosition: (payload?.toPosition as string) ?? "unknown",
        matchSeconds: e.matchSeconds ?? 0,
      };
    });
}

function inferSource(
  interval: { playerId: string; position: string; startedAtMs: number; endedAtMs: number | null },
  starters: StarterAssignment[],
): ActualIntervalSource {
  const isStarter = starters.some((s) => s.playerId === interval.playerId) && interval.startedAtMs === 0;

  if (isStarter) {
    return ActualIntervalSource.STARTING_LINEUP;
  }

  return ActualIntervalSource.SUBSTITUTION;
}

async function populatePlayerActualPositions(
  tx: { postMatchPlayerActual: { findMany: typeof db.postMatchPlayerActual.findMany; update: typeof db.postMatchPlayerActual.update } },
  matchId: string,
  intervals: ActualIntervalRow[],
): Promise<void> {
  const playerPositionMap = new Map<string, Set<string>>();

  for (const interval of intervals) {
    if (interval.position !== "BENCH" && interval.position !== "unknown") {
      const positions = playerPositionMap.get(interval.playerId) ?? new Set<string>();
      positions.add(interval.position);
      playerPositionMap.set(interval.playerId, positions);
    }
  }

  const actuals = await tx.postMatchPlayerActual.findMany({
    where: { matchId },
    select: { id: true, playerId: true },
  });

  for (const actual of actuals) {
    const positions = playerPositionMap.get(actual.playerId);
    if (positions && positions.size > 0) {
      await tx.postMatchPlayerActual.update({
        where: { id: actual.id },
        data: { actualPositions: [...positions] },
      });
    }
  }
}

export async function getActualPositionIntervals(
  matchId: string,
): Promise<ActualIntervalRow[]> {
  const rows = await db.actualPositionInterval.findMany({
    where: { matchId },
    orderBy: [{ startedAtMs: "asc" }],
  });

  return rows.map((r) => ({
    playerId: r.playerId,
    position: r.position,
    line: r.line,
    lane: r.lane,
    startedAtMs: r.startedAtMs,
    endedAtMs: r.endedAtMs,
    source: r.source as ActualIntervalSource,
    approximateTiming: r.approximateTiming,
  }));
}

export async function getPlayerPositionIntervals(
  matchId: string,
  playerId: string,
): Promise<ActualIntervalRow[]> {
  const rows = await db.actualPositionInterval.findMany({
    where: { matchId, playerId },
    orderBy: [{ startedAtMs: "asc" }],
  });

  return rows.map((r) => ({
    playerId: r.playerId,
    position: r.position,
    line: r.line,
    lane: r.lane,
    startedAtMs: r.startedAtMs,
    endedAtMs: r.endedAtMs,
    source: r.source as ActualIntervalSource,
    approximateTiming: r.approximateTiming,
  }));
}

export async function getPlayerMatchPositions(
  matchId: string,
  playerId: string,
): Promise<string[]> {
  const intervals = await getPlayerPositionIntervals(matchId, playerId);
  return [...new Set(intervals.filter((i) => i.position !== "BENCH" && i.position !== "unknown").map((i) => i.position))];
}