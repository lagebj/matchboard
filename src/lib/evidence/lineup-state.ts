import type { PlayerPositionInterval, CurrentLineupEntry } from "@/lib/live-match/live-match-types";

export type LineupPosition = string;

export type LineupChangeEntry = {
  playerId: string;
  fromPosition: LineupPosition | "BENCH";
  toPosition: LineupPosition | "BENCH";
};

export type CompositeLineupChange = {
  matchId: string;
  clientEventId: string;
  effectiveAtMs: number;
  changes: LineupChangeEntry[];
};

export type ProjectedLineup = Map<string, LineupPosition | "BENCH">;

export type StarterAssignment = {
  playerId: string;
  position: LineupPosition;
};

export function projectLineupFromEvents(
  starters: StarterAssignment[],
  rotations: Array<{
    outPlayerId: string;
    inPlayerId: string;
    outPosition: string | null;
    inPosition: string | null;
    positionOnly: boolean;
    matchSeconds: number;
  }>,
  positionChanges: Array<{
    playerId: string;
    fromPosition: string;
    toPosition: string;
    matchSeconds: number;
  }>,
  atMs: number,
): ProjectedLineup {
  const lineup = new Map<string, LineupPosition | "BENCH">();

  for (const starter of starters) {
    lineup.set(starter.playerId, starter.position);
  }

  const sortedRotations = [...rotations]
    .filter((r) => (r.matchSeconds ?? 0) <= atMs)
    .sort((a, b) => (a.matchSeconds ?? 0) - (b.matchSeconds ?? 0));

  for (const rotation of sortedRotations) {
    if (rotation.positionOnly) {
      if (rotation.outPosition && rotation.inPosition) {
        const outPlayerCurrent = lineup.get(rotation.outPlayerId);
        const inPlayerCurrent = lineup.get(rotation.inPlayerId);
        if (outPlayerCurrent && outPlayerCurrent !== "BENCH" && inPlayerCurrent && inPlayerCurrent !== "BENCH") {
          lineup.set(rotation.outPlayerId, rotation.inPosition);
          lineup.set(rotation.inPlayerId, rotation.outPosition);
        }
      }
    } else {
      lineup.set(rotation.outPlayerId, "BENCH");
      const inPosition = rotation.inPosition ?? lineup.get(rotation.outPlayerId) ?? "BENCH";
      if (inPosition !== "BENCH") {
        lineup.set(rotation.inPlayerId, inPosition);
      } else {
        lineup.set(rotation.inPlayerId, inPosition);
      }

      if (rotation.outPosition) {
        lineup.set(rotation.outPlayerId, "BENCH");
      }
    }
  }

  const sortedPositionChanges = [...positionChanges]
    .filter((pc) => (pc.matchSeconds ?? 0) <= atMs)
    .sort((a, b) => (a.matchSeconds ?? 0) - (b.matchSeconds ?? 0));

  for (const change of sortedPositionChanges) {
    const current = lineup.get(change.playerId);
    if (current && current !== "BENCH") {
      lineup.set(change.playerId, change.toPosition);
    }
  }

  return lineup;
}

export function computePositionIntervals(
  starters: StarterAssignment[],
  rotations: Array<{
    outPlayerId: string;
    inPlayerId: string;
    outPosition: string | null;
    inPosition: string | null;
    positionOnly: boolean;
    matchSeconds: number;
  }>,
  positionChanges: Array<{
    playerId: string;
    fromPosition: string;
    toPosition: string;
    matchSeconds: number;
  }>,
  matchEndMs: number | null,
): PlayerPositionInterval[] {
  const intervals: PlayerPositionInterval[] = [];

  for (const starter of starters) {
    intervals.push({
      playerId: starter.playerId,
      position: starter.position,
      startedAtMs: 0,
      endedAtMs: null,
    });
  }

  const sortedEvents = [
    ...rotations.map((r) => ({
      type: "rotation" as const,
      outPlayerId: r.outPlayerId,
      inPlayerId: r.inPlayerId,
      outPosition: r.outPosition,
      inPosition: r.inPosition,
      positionOnly: r.positionOnly,
      atMs: r.matchSeconds,
    })),
    ...positionChanges.map((pc) => ({
      type: "positionChange" as const,
      playerId: pc.playerId,
      fromPosition: pc.fromPosition,
      toPosition: pc.toPosition,
      atMs: pc.matchSeconds,
    })),
  ].sort((a, b) => a.atMs - b.atMs);

  for (const event of sortedEvents) {
    if (event.type === "rotation") {
      if (event.positionOnly) {
        const outInterval = intervals.find(
          (i) => i.playerId === event.outPlayerId && i.endedAtMs === null,
        );
        if (outInterval) {
          outInterval.endedAtMs = event.atMs;
        }

        intervals.push({
          playerId: event.outPlayerId,
          position: event.inPosition ?? outInterval?.position ?? "unknown",
          startedAtMs: event.atMs,
          endedAtMs: null,
        });

        const inInterval = intervals.find(
          (i) => i.playerId === event.inPlayerId && i.endedAtMs === null,
        );
        if (inInterval) {
          inInterval.endedAtMs = event.atMs;
        }

        intervals.push({
          playerId: event.inPlayerId,
          position: event.outPosition ?? inInterval?.position ?? "unknown",
          startedAtMs: event.atMs,
          endedAtMs: null,
        });
      } else {
        const outInterval = intervals.find(
          (i) => i.playerId === event.outPlayerId && i.endedAtMs === null && i.position !== "BENCH",
        );
        if (outInterval) {
          outInterval.endedAtMs = event.atMs;
        }

        intervals.push({
          playerId: event.outPlayerId,
          position: "BENCH",
          startedAtMs: event.atMs,
          endedAtMs: null,
        });

        const inPosition = event.inPosition ?? outInterval?.position ?? "unknown";

        const inBenchInterval = intervals.find(
          (i) => i.playerId === event.inPlayerId && i.endedAtMs === null && i.position === "BENCH",
        );
        if (inBenchInterval) {
          inBenchInterval.endedAtMs = event.atMs;
        }

        intervals.push({
          playerId: event.inPlayerId,
          position: inPosition,
          startedAtMs: event.atMs,
          endedAtMs: null,
        });
      }
    } else if (event.type === "positionChange") {
      const currentInterval = intervals.find(
        (i) => i.playerId === event.playerId && i.endedAtMs === null,
      );
      if (currentInterval) {
        currentInterval.endedAtMs = event.atMs;
      }

      intervals.push({
        playerId: event.playerId,
        position: event.toPosition,
        startedAtMs: event.atMs,
        endedAtMs: null,
      });
    }
  }

  if (matchEndMs !== null) {
    for (const interval of intervals) {
      if (interval.endedAtMs === null) {
        interval.endedAtMs = matchEndMs;
      }
    }
  }

  return intervals;
}

export function getLineupAtGoalTime(
  starters: StarterAssignment[],
  rotations: Array<{
    outPlayerId: string;
    inPlayerId: string;
    outPosition: string | null;
    inPosition: string | null;
    positionOnly: boolean;
    matchSeconds: number;
  }>,
  positionChanges: Array<{
    playerId: string;
    fromPosition: string;
    toPosition: string;
    matchSeconds: number;
  }>,
  goalMs: number,
): CurrentLineupEntry[] {
  const projected = projectLineupFromEvents(starters, rotations, positionChanges, goalMs);

  const entries: CurrentLineupEntry[] = [];

  for (const [playerId, position] of projected.entries()) {
    if (position !== "BENCH") {
      entries.push({
        playerId,
        playerName: "",
        position,
        enteredAtMs: 0,
        isStarter: starters.some((s) => s.playerId === playerId),
      });
    }
  }

  return entries;
}

export function validateCompositeLineupChange(
  change: CompositeLineupChange,
  currentLineup: ProjectedLineup,
  _onPitchPlayerIds: Set<string>,
  _benchPlayerIds: Set<string>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const positionsAfterChange = new Map<string, LineupPosition | "BENCH">();
  for (const [playerId, position] of currentLineup.entries()) {
    positionsAfterChange.set(playerId, position);
  }

  for (const entry of change.changes) {
    if (!positionsAfterChange.has(entry.playerId)) {
      errors.push(`Player ${entry.playerId} is not in the match`);
    }
  }

  for (const entry of change.changes) {
    positionsAfterChange.set(entry.playerId, entry.toPosition);
  }

  const onPitchPlayers = new Set<string>();
  const positionAssignments = new Map<string, string[]>();

  for (const [playerId, position] of positionsAfterChange.entries()) {
    if (position !== "BENCH") {
      onPitchPlayers.add(playerId);
      const existing = positionAssignments.get(position) ?? [];
      existing.push(playerId);
      positionAssignments.set(position, existing);
    }
  }

  for (const [position, players] of positionAssignments.entries()) {
    if (players.length > 1) {
      errors.push(`Position ${position} has ${players.length} players: ${players.join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function computeTotalMinutesByPosition(
  intervals: PlayerPositionInterval[],
): Map<string, number> {
  const minutes = new Map<string, number>();

  for (const interval of intervals) {
    if (interval.position === "BENCH") continue;

    const startMs = interval.startedAtMs;
    const endMs = interval.endedAtMs ?? startMs;
    const durationMs = endMs - startMs;
    const durationMin = durationMs / 60000;

    const current = minutes.get(interval.position) ?? 0;
    minutes.set(interval.position, current + durationMin);
  }

  return minutes;
}