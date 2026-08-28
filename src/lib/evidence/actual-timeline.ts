import { ActualIntervalSource } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  computePositionIntervals,
  type StarterAssignment,
} from "@/lib/evidence/lineup-state";
import { ROLE_TYPE_TO_LINE, laneFromGridX, type FormationSlotRoleType } from "@/lib/formations/types";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";

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

/**
 * Dispatches actual-timeline reconstruction to the right source implementation.
 * League matches use `rebuildActualTimeline` (unchanged). Event matches use
 * `rebuildEventActualTimeline` (added when Event evidence adapters land — see ADR-0104).
 */
export async function rebuildActualTimelineForRef(ref: FootballMatchRef): Promise<{ intervalsCreated: number }> {
  if (ref.kind === "LEAGUE_MATCH") {
    return rebuildActualTimeline(ref.matchId);
  }
  return rebuildEventActualTimeline(ref.eventMatchId);
}

/**
 * Event-match equivalent of `rebuildActualTimeline`. No structured `MatchRotation`
 * table exists for Event matches (ADR-0104 §5) — starting state comes from
 * `EventMatchLineupAssignment`, and rotations/position-only changes are reconstructed
 * from raw `EventLiveMatchEvent` rows using the same shared `LiveMatchEventType`
 * vocabulary League's live-match reporting uses. `ROTATION_OUT`/`ROTATION_IN` are
 * recorded as two separate per-player events (not one paired substitution record), so
 * they are paired here by matching `matchSeconds` — an OUT with no matching IN at the
 * same timestamp is skipped rather than guessed (no interval invented for it).
 */
export async function rebuildEventActualTimeline(eventMatchId: string): Promise<{
  intervalsCreated: number;
}> {
  const eventMatch = await db.eventMatch.findFirst({
    where: { id: eventMatchId },
    select: {
      id: true,
      organisationId: true,
      event: { select: { matchDurationMinutes: true } },
    },
  });

  if (!eventMatch) {
    throw new Error("Event match not found.");
  }

  const matchEndMs = eventMatch.event.matchDurationMinutes
    ? eventMatch.event.matchDurationMinutes * 60 * 1000
    : null;

  const starters = await getEventStartingLineup(eventMatchId);
  const { rotations, positionChanges } = await getEventRotationsAndPositionChanges(eventMatchId);

  const computedIntervals = computePositionIntervals(starters, rotations, positionChanges, matchEndMs);

  const intervalRows: ActualIntervalRow[] = computedIntervals.map((interval) => ({
    playerId: interval.playerId,
    position: interval.position,
    line: interval.line ?? null,
    lane: interval.lane ?? null,
    startedAtMs: interval.startedAtMs,
    endedAtMs: interval.endedAtMs,
    source: interval.startedAtMs === 0 && starters.some((s) => s.playerId === interval.playerId)
      ? ActualIntervalSource.STARTING_LINEUP
      : ActualIntervalSource.SUBSTITUTION,
    approximateTiming: false,
  }));

  await db.$transaction(async (tx) => {
    await tx.actualPositionInterval.deleteMany({ where: { eventMatchId } });

    if (intervalRows.length > 0) {
      await tx.actualPositionInterval.createMany({
        data: intervalRows.map((row) => ({
          eventMatchId,
          organisationId: eventMatch.organisationId,
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

    await populateEventPlayerActualPositions(tx, eventMatchId, intervalRows);
  });

  return { intervalsCreated: intervalRows.length };
}

async function getEventStartingLineup(eventMatchId: string): Promise<StarterAssignment[]> {
  const lineup = await db.eventMatchLineup.findFirst({
    where: { eventMatchId },
    select: { id: true },
  });

  if (!lineup) return [];

  const assignments = await db.eventMatchLineupAssignment.findMany({
    where: { lineupId: lineup.id, playerId: { not: null } },
    select: { playerId: true, slotId: true, roleType: true },
  });

  if (assignments.length === 0) return [];

  const slotIds = assignments.map((a) => a.slotId).filter((id): id is string => id !== null);
  const slots = slotIds.length > 0
    ? await db.formationSlot.findMany({
        where: { id: { in: slotIds } },
        select: { id: true, roleType: true, label: true, gridX: true },
      })
    : [];
  const slotMap = new Map(slots.map((s) => [s.id, s]));

  return assignments
    .filter((a) => a.playerId !== null)
    .map((a) => {
      const slot = a.slotId ? slotMap.get(a.slotId) : undefined;
      const roleType = (slot?.roleType ?? a.roleType) as FormationSlotRoleType | undefined;
      return {
        playerId: a.playerId!,
        position: slot?.roleType || slot?.label || a.roleType || "unknown",
        line: roleType ? (ROLE_TYPE_TO_LINE[roleType] ?? null) : null,
        // lane needs FormationSlot.gridX (a grid coordinate) -- EventMatchLineupAssignment's
        // own x/y are free-form pitch coordinates in a different space, not interchangeable.
        // Stays unknown (never guessed) when no linked FormationSlot is available.
        lane: slot ? laneFromGridX(slot.gridX) : null,
      };
    });
}

async function getEventRotationsAndPositionChanges(eventMatchId: string): Promise<{
  rotations: RotationInput[];
  positionChanges: PositionChangeInput[];
}> {
  const events = await db.eventLiveMatchEvent.findMany({
    where: {
      eventMatchId,
      eventType: { in: ["ROTATION_OUT", "ROTATION_IN", "POSITIONS_CHANGED"] },
      correctionType: null,
    },
    select: { eventType: true, playerId: true, payload: true, matchSeconds: true, createdAt: true },
    orderBy: [{ matchSeconds: "asc" }, { createdAt: "asc" }],
  });

  const rotations: RotationInput[] = [];
  const positionChanges: PositionChangeInput[] = [];

  const outsBySeconds = new Map<number, string[]>();
  const insBySeconds = new Map<number, string[]>();

  for (const e of events) {
    if (!e.playerId) continue;
    const seconds = e.matchSeconds ?? 0;
    if (e.eventType === "ROTATION_OUT") {
      const list = outsBySeconds.get(seconds) ?? [];
      list.push(e.playerId);
      outsBySeconds.set(seconds, list);
    } else if (e.eventType === "ROTATION_IN") {
      const list = insBySeconds.get(seconds) ?? [];
      list.push(e.playerId);
      insBySeconds.set(seconds, list);
    } else if (e.eventType === "POSITIONS_CHANGED") {
      const payload = e.payload as Record<string, unknown> | null;
      positionChanges.push({
        playerId: e.playerId,
        fromPosition: (payload?.fromPosition as string) ?? "unknown",
        toPosition: (payload?.toPosition as string) ?? "unknown",
        matchSeconds: seconds,
      });
    }
  }

  for (const [seconds, outs] of outsBySeconds) {
    const ins = insBySeconds.get(seconds) ?? [];
    const pairCount = Math.min(outs.length, ins.length);
    for (let i = 0; i < pairCount; i++) {
      rotations.push({
        outPlayerId: outs[i],
        inPlayerId: ins[i],
        outPosition: null,
        inPosition: null,
        positionOnly: false,
        matchSeconds: seconds,
      });
    }
    // An OUT with no matching IN at the same timestamp is skipped -- no interval is
    // invented for a substitution this data cannot actually reconstruct.
  }

  return { rotations, positionChanges };
}

async function populateEventPlayerActualPositions(
  tx: { eventPostMatchPlayer: { findMany: typeof db.eventPostMatchPlayer.findMany; update: typeof db.eventPostMatchPlayer.update } },
  eventMatchId: string,
  intervals: ActualIntervalRow[],
): Promise<void> {
  const report = await db.eventPostMatchReport.findFirst({
    where: { eventMatchId },
    select: { id: true },
  });
  if (!report) return;

  const minutesByPlayer = new Map<string, number>();
  for (const interval of intervals) {
    if (interval.position === "BENCH") continue;
    const durationMs = (interval.endedAtMs ?? interval.startedAtMs) - interval.startedAtMs;
    minutesByPlayer.set(interval.playerId, (minutesByPlayer.get(interval.playerId) ?? 0) + durationMs / 60000);
  }

  const actuals = await tx.eventPostMatchPlayer.findMany({
    where: { reportId: report.id },
    select: { id: true, playerId: true, minutesPlayed: true },
  });

  for (const actual of actuals) {
    const minutes = minutesByPlayer.get(actual.playerId);
    if (minutes !== undefined && actual.minutesPlayed === null) {
      await tx.eventPostMatchPlayer.update({
        where: { id: actual.id },
        data: { minutesPlayed: Math.round(minutes) },
      });
    }
  }
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

export async function getActualPositionIntervalsForRef(ref: FootballMatchRef): Promise<ActualIntervalRow[]> {
  const rows = await db.actualPositionInterval.findMany({
    where: ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId },
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