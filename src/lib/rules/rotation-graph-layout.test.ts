import { describe, it, expect } from "vitest";
import { computeRotationGraphLayout, ROTATION_GRAPH_VIEW_BOX_SIZE } from "./rotation-graph-layout";

const center = ROTATION_GRAPH_VIEW_BOX_SIZE / 2;

function distanceFromCenter(node: { x: number; y: number }): number {
  return Math.sqrt((node.x - center) ** 2 + (node.y - center) ** 2);
}

describe("computeRotationGraphLayout", () => {
  it("lays out teams evenly around a circle", () => {
    const teams = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
      { id: "d", name: "D" },
    ];
    const layout = computeRotationGraphLayout(teams, []);
    expect(layout.nodes).toHaveLength(4);
    const radii = layout.nodes.map(distanceFromCenter);
    for (const radius of radii) {
      expect(radius).toBeCloseTo(radii[0], 5);
    }
  });

  it("produces one edge per rotation path with matching role/purpose/priority", () => {
    const teams = [
      { id: "a", name: "Team A" },
      { id: "b", name: "Team B" },
    ];
    const layout = computeRotationGraphLayout(teams, [
      {
        id: "p1",
        fromTeamId: "a",
        fromTeamName: "Team A",
        toTeamId: "b",
        toTeamName: "Team B",
        role: "SUPPORT",
        purpose: "Cover shortfall",
        priority: 1,
      },
    ]);
    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0]).toMatchObject({
      id: "p1",
      fromId: "a",
      toId: "b",
      role: "SUPPORT",
      purpose: "Cover shortfall",
      priority: 1,
    });
    expect(layout.edges[0].path).toMatch(/^M .+ Q .+/);
  });

  it("skips self-referencing paths", () => {
    const teams = [{ id: "a", name: "Team A" }];
    const layout = computeRotationGraphLayout(teams, [
      {
        id: "p1",
        fromTeamId: "a",
        fromTeamName: "Team A",
        toTeamId: "a",
        toTeamName: "Team A",
        role: "SUPPORT",
        purpose: "invalid",
        priority: null,
      },
    ]);
    expect(layout.edges).toHaveLength(0);
  });

  it("skips paths referencing teams not in the node set", () => {
    const teams = [{ id: "a", name: "Team A" }];
    const layout = computeRotationGraphLayout(teams, [
      {
        id: "p1",
        fromTeamId: "a",
        fromTeamName: "Team A",
        toTeamId: "missing",
        toTeamName: "Unknown",
        role: "SUPPORT",
        purpose: "orphaned",
        priority: null,
      },
    ]);
    expect(layout.edges).toHaveLength(0);
  });

  it("curves reciprocal paths apart so they don't overlap", () => {
    const teams = [
      { id: "a", name: "Team A" },
      { id: "b", name: "Team B" },
    ];
    const layout = computeRotationGraphLayout(teams, [
      { id: "p1", fromTeamId: "a", fromTeamName: "Team A", toTeamId: "b", toTeamName: "Team B", role: "SUPPORT", purpose: "a to b", priority: null },
      { id: "p2", fromTeamId: "b", fromTeamName: "Team B", toTeamId: "a", toTeamName: "Team A", role: "DEVELOPMENT", purpose: "b to a", priority: null },
    ]);
    expect(layout.edges).toHaveLength(2);
    expect(layout.edges[0].path).not.toEqual(layout.edges[1].path);
  });

  it("distributes multiple paths on the same pair across a curvature range", () => {
    const teams = [
      { id: "a", name: "Team A" },
      { id: "b", name: "Team B" },
    ];
    const layout = computeRotationGraphLayout(teams, [
      { id: "p1", fromTeamId: "a", fromTeamName: "Team A", toTeamId: "b", toTeamName: "Team B", role: "SUPPORT", purpose: "one", priority: null },
      { id: "p2", fromTeamId: "a", fromTeamName: "Team A", toTeamId: "b", toTeamName: "Team B", role: "DEVELOPMENT", purpose: "two", priority: null },
      { id: "p3", fromTeamId: "a", fromTeamName: "Team A", toTeamId: "b", toTeamName: "Team B", role: "BACKFILL", purpose: "three", priority: null },
    ]);
    const paths = layout.edges.map((e) => e.path);
    expect(new Set(paths).size).toBe(3);
  });

  it("skips paths with a role outside SUPPORT/DEVELOPMENT/BACKFILL", () => {
    const teams = [
      { id: "a", name: "Team A" },
      { id: "b", name: "Team B" },
    ];
    const layout = computeRotationGraphLayout(teams, [
      { id: "p1", fromTeamId: "a", fromTeamName: "Team A", toTeamId: "b", toTeamName: "Team B", role: "CORE", purpose: "not a movement path", priority: null },
    ]);
    expect(layout.edges).toHaveLength(0);
  });

  it("handles zero teams and zero paths without crashing", () => {
    const layout = computeRotationGraphLayout([], []);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
  });
});
