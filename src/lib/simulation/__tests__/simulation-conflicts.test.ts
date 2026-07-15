import { describe, it, expect } from "vitest";
import {
  detectSimulationConflicts,
  detectGkConflicts,
  detectUnavailablePlayerConflicts,
  type ConflictInput,
} from "../simulation-conflicts";

describe("detectSimulationConflicts", () => {
  it("detects league/event overlap when times conflict", () => {
    const inputs: ConflictInput[] = [
      {
        playerId: "p1",
        leagueAssignments: [
          { roundId: "r1", matchId: "m1", date: new Date("2026-05-01T10:00:00Z") },
        ],
        eventAssignments: [
          { eventId: "e1", eventMatchId: "em1", startsAt: new Date("2026-05-01T10:30:00Z"), endsAt: new Date("2026-05-01T11:00:00Z") },
        ],
        totalAssignments: 2,
      },
    ];

    const conflicts = detectSimulationConflicts(inputs);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe("player_league_event_overlap");
    expect(conflicts[0].playerId).toBe("p1");
  });

  it("does not flag overlap when times do not conflict", () => {
    const inputs: ConflictInput[] = [
      {
        playerId: "p1",
        leagueAssignments: [
          { roundId: "r1", matchId: "m1", date: new Date("2026-05-01T10:00:00Z") },
        ],
        eventAssignments: [
          { eventId: "e1", eventMatchId: "em1", startsAt: new Date("2026-05-01T14:00:00Z"), endsAt: new Date("2026-05-01T15:00:00Z") },
        ],
        totalAssignments: 2,
      },
    ];

    const conflicts = detectSimulationConflicts(inputs);

    expect(conflicts.filter((c) => c.type === "player_league_event_overlap")).toHaveLength(0);
  });

  it("flags player overuse when assignments exceed 2", () => {
    const inputs: ConflictInput[] = [
      {
        playerId: "p1",
        leagueAssignments: [],
        eventAssignments: [],
        totalAssignments: 3,
      },
    ];

    const conflicts = detectSimulationConflicts(inputs);

    expect(conflicts.some((c) => c.type === "player_overuse_same_week")).toBe(true);
  });

  it("does not flag player with only 2 assignments as overuse", () => {
    const inputs: ConflictInput[] = [
      {
        playerId: "p1",
        leagueAssignments: [
          { roundId: "r1", matchId: "m1", date: null },
        ],
        eventAssignments: [
          { eventId: "e1", eventMatchId: "em1", startsAt: null, endsAt: null },
        ],
        totalAssignments: 2,
      },
    ];

    const conflicts = detectSimulationConflicts(inputs);

    expect(conflicts.some((c) => c.type === "player_overuse_same_week")).toBe(false);
  });

  it("returns empty conflicts for empty input", () => {
    const conflicts = detectSimulationConflicts([]);
    expect(conflicts).toHaveLength(0);
  });
});

describe("detectGkConflicts", () => {
  it("flags GK assigned to both league and event", () => {
    const gkAssignments = [
      {
        playerId: "gk1",
        assignments: [
          { matchId: "m1", roundId: "r1", isEvent: false },
          { matchId: "em1", roundId: "", isEvent: true },
        ],
      },
    ];

    const conflicts = detectGkConflicts(gkAssignments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe("gk_conflict");
    expect(conflicts[0].playerId).toBe("gk1");
  });

  it("does not flag GK with only league assignments", () => {
    const gkAssignments = [
      {
        playerId: "gk1",
        assignments: [
          { matchId: "m1", roundId: "r1", isEvent: false },
        ],
      },
    ];

    const conflicts = detectGkConflicts(gkAssignments);

    expect(conflicts).toHaveLength(0);
  });
});

describe("detectUnavailablePlayerConflicts", () => {
  it("flags unavailable players in planned assignments", () => {
    const plannedAssignments = [
      { playerId: "p1", matchId: "m1", roundId: "r1" },
      { playerId: "p2", matchId: "m1", roundId: "r1" },
    ];
    const unavailablePlayerIds = ["p1"];

    const conflicts = detectUnavailablePlayerConflicts(unavailablePlayerIds, plannedAssignments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe("unavailable_player_planned");
    expect(conflicts[0].playerId).toBe("p1");
  });

  it("returns no conflicts when no unavailable players are planned", () => {
    const plannedAssignments = [
      { playerId: "p1", matchId: "m1", roundId: "r1" },
      { playerId: "p2", matchId: "m1", roundId: "r1" },
    ];
    const unavailablePlayerIds = ["p3"];

    const conflicts = detectUnavailablePlayerConflicts(unavailablePlayerIds, plannedAssignments);

    expect(conflicts).toHaveLength(0);
  });

  it("returns empty conflicts for empty input", () => {
    const conflicts = detectUnavailablePlayerConflicts([], []);
    expect(conflicts).toHaveLength(0);
  });
});