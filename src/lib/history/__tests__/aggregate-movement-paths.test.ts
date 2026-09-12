import { describe, it, expect } from "vitest";
import { aggregateMovementPaths } from "../aggregate-movement-paths";

describe("aggregateMovementPaths", () => {
  it("groups entries by (fromTeamName, toTeamName, role) and counts unique players", () => {
    const paths = aggregateMovementPaths([
      { fromTeamName: "Hvit", toTeamName: "Rød", role: "SUPPORT", playerId: "p1", occurredAt: new Date("2026-08-01") },
      { fromTeamName: "Hvit", toTeamName: "Rød", role: "SUPPORT", playerId: "p2", occurredAt: new Date("2026-09-01") },
      { fromTeamName: "Hvit", toTeamName: "Rød", role: "SUPPORT", playerId: "p1", occurredAt: new Date("2026-07-01") },
    ]);
    expect(paths).toEqual([
      {
        fromTeamName: "Hvit",
        toTeamName: "Rød",
        role: "SUPPORT",
        count: 3,
        uniquePlayers: 2,
        lastUsed: new Date("2026-09-01").toISOString(),
      },
    ]);
  });

  it("keeps a different role between the same two teams as a separate path", () => {
    const paths = aggregateMovementPaths([
      { fromTeamName: "Hvit", toTeamName: "Rød", role: "SUPPORT", playerId: "p1", occurredAt: new Date("2026-08-01") },
      { fromTeamName: "Hvit", toTeamName: "Rød", role: "DEVELOPMENT", playerId: "p2", occurredAt: new Date("2026-08-02") },
    ]);
    expect(paths).toHaveLength(2);
  });

  it("sorts by count descending", () => {
    const paths = aggregateMovementPaths([
      { fromTeamName: "Blå", toTeamName: "Rød", role: "DEVELOPMENT", playerId: "p1", occurredAt: new Date("2026-08-01") },
      { fromTeamName: "Hvit", toTeamName: "Rød", role: "SUPPORT", playerId: "p2", occurredAt: new Date("2026-08-01") },
      { fromTeamName: "Hvit", toTeamName: "Rød", role: "SUPPORT", playerId: "p3", occurredAt: new Date("2026-08-02") },
    ]);
    expect(paths[0]).toMatchObject({ fromTeamName: "Hvit", count: 2 });
    expect(paths[1]).toMatchObject({ fromTeamName: "Blå", count: 1 });
  });

  it("returns an empty array for no entries", () => {
    expect(aggregateMovementPaths([])).toEqual([]);
  });
});
