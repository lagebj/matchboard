import type {
  SimulationConflict,
} from "./simulation-types";

export type ConflictInput = {
  playerId: string;
  leagueAssignments: { roundId: string; matchId: string; date: Date | null }[];
  eventAssignments: { eventId: string; eventMatchId: string; startsAt: Date | null; endsAt: Date | null }[];
  totalAssignments: number;
};

export function detectSimulationConflicts(
  inputs: ConflictInput[],
): SimulationConflict[] {
  const conflicts: SimulationConflict[] = [];

  for (const input of inputs) {
    if (input.leagueAssignments.length > 0 && input.eventAssignments.length > 0) {
      for (const league of input.leagueAssignments) {
        for (const event of input.eventAssignments) {
          if (hasTimeOverlap(league.date, event.startsAt, event.endsAt)) {
            conflicts.push({
              type: "player_league_event_overlap",
              playerId: input.playerId,
              leagueMatchId: league.matchId,
              roundId: league.roundId,
              detail: `Player ${input.playerId} has a league match and an event at overlapping times.`,
            });
          }
        }
      }
    }

    if (input.totalAssignments > 2) {
      conflicts.push({
        type: "player_overuse_same_week",
        playerId: input.playerId,
        detail: `Player ${input.playerId} is assigned to ${input.totalAssignments} matches/events in the simulation horizon.`,
      });
    }
  }

  return conflicts;
}

function hasTimeOverlap(
  leagueDate: Date | null,
  eventStart: Date | null,
  eventEnd: Date | null,
): boolean {
  if (!leagueDate || !eventStart || !eventEnd) return false;

  const leagueStart = new Date(leagueDate);
  const leagueEnd = new Date(leagueStart.getTime() + 90 * 60 * 1000);

  return leagueStart < eventEnd && eventStart < leagueEnd;
}

export function detectGkConflicts(
  gkAssignments: {
    playerId: string;
    assignments: { matchId: string; roundId: string; isEvent: boolean }[];
  }[],
): SimulationConflict[] {
  const conflicts: SimulationConflict[] = [];

  for (const gk of gkAssignments) {
    if (gk.assignments.length > 1) {
      const hasOverlap = gk.assignments.some(
        (a) => a.isEvent && gk.assignments.some((b) => !b.isEvent),
      );
      if (hasOverlap) {
        conflicts.push({
          type: "gk_conflict",
          playerId: gk.playerId,
          detail: `Goalkeeper ${gk.playerId} is needed in both league and event matches.`,
        });
      }
    }
  }

  return conflicts;
}

export function detectUnavailablePlayerConflicts(
  unavailablePlayerIds: string[],
  plannedAssignments: { playerId: string; matchId: string; roundId: string }[],
): SimulationConflict[] {
  const conflicts: SimulationConflict[] = [];
  const unavailableSet = new Set(unavailablePlayerIds);

  for (const assignment of plannedAssignments) {
    if (unavailableSet.has(assignment.playerId)) {
      conflicts.push({
        type: "unavailable_player_planned",
        playerId: assignment.playerId,
        leagueMatchId: assignment.matchId,
        roundId: assignment.roundId,
        detail: `Player ${assignment.playerId} is marked unavailable but appears in a simulated plan.`,
      });
    }
  }

  return conflicts;
}