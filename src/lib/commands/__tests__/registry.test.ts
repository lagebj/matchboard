import { describe, it, expect } from "vitest";
import type { ActorContext } from "@/lib/auth/actor-context";
import { getAvailableCommands, COMMAND_REGISTRY } from "@/lib/commands/registry";

function makeContext(role: ActorContext["role"]): ActorContext {
  return {
    userId: "user-1",
    email: "coach@example.com",
    membershipId: "membership-1",
    organisationId: "org-1",
    organisationSlug: "test-club",
    role,
    accessibleGroupIds: [],
    groupAccesses: [],
    orgFilter: {
      type: "org",
      organisationId: "org-1",
      filter: { organisationId: "org-1" },
      filterNullable: { organisationId: "org-1" },
    },
  };
}

describe("command registry", () => {
  it("every registry entry has a unique id", () => {
    const ids = COMMAND_REGISTRY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("navigate commands are available to every role, including VIEWER", () => {
    const ctx = makeContext("VIEWER");
    const resolved = getAvailableCommands(ctx);
    const navIds = resolved.filter((c) => c.category === "navigate").map((c) => c.id);
    expect(navIds).toEqual(
      expect.arrayContaining(["nav-today", "nav-league", "nav-teams", "nav-players", "nav-events", "nav-more"]),
    );
  });

  it("VIEWER cannot see create or admin commands", () => {
    const resolved = getAvailableCommands(makeContext("VIEWER"));
    expect(resolved.some((c) => c.category === "create")).toBe(false);
    expect(resolved.some((c) => c.category === "admin")).toBe(false);
  });

  it("COACH can see create commands but not admin commands", () => {
    const resolved = getAvailableCommands(makeContext("COACH"));
    expect(resolved.some((c) => c.id === "create-team")).toBe(true);
    expect(resolved.some((c) => c.category === "admin")).toBe(false);
  });

  it("ADMIN and OWNER can see admin commands (Simulation, Policy workbench)", () => {
    for (const role of ["ADMIN", "OWNER"] as const) {
      const resolved = getAvailableCommands(makeContext(role));
      const adminIds = resolved.filter((c) => c.category === "admin").map((c) => c.id);
      expect(adminIds).toEqual(expect.arrayContaining(["nav-simulation", "nav-workbench"]));
    }
  });

  it("resolves hrefs against the given organisation slug", () => {
    const resolved = getAvailableCommands(makeContext("OWNER"));
    const today = resolved.find((c) => c.id === "nav-today");
    expect(today?.href).toBe("/o/test-club/today");
  });
});
