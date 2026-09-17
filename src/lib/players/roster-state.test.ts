import { describe, it, expect } from "vitest";
import {
  resolvePlayerRosterState,
  rosterStateLabel,
  resolveRosterFilterFromParams,
  rosterFilterQueryValue,
  playerRosterWhere,
} from "./roster-state";

/**
 * Roster state vs. football availability (roster-state-and-mobile-convergence pass §1-§4). Pure
 * unit coverage for the one place roster state, its URL contract, and its `where` translation are
 * resolved — every consumer (roster filter, mobile row, inspector, accessibility text) reuses
 * these, never re-deriving `active`/`removedAt` combinations itself.
 */
describe("resolvePlayerRosterState", () => {
  it("resolves ACTIVE for a non-removed, active player", () => {
    expect(resolvePlayerRosterState(true, null)).toBe("ACTIVE");
  });

  it("resolves INACTIVE for a non-removed, inactive player", () => {
    expect(resolvePlayerRosterState(false, null)).toBe("INACTIVE");
  });

  it("resolves REMOVED whenever removedAt is set, regardless of active", () => {
    expect(resolvePlayerRosterState(true, new Date("2026-01-01"))).toBe("REMOVED");
    expect(resolvePlayerRosterState(false, new Date("2026-01-01"))).toBe("REMOVED");
  });
});

describe("rosterStateLabel", () => {
  it("labels every state as short, human-readable text", () => {
    expect(rosterStateLabel("ACTIVE")).toBe("Active");
    expect(rosterStateLabel("INACTIVE")).toBe("Inactive");
    expect(rosterStateLabel("REMOVED")).toBe("Removed");
  });
});

describe("resolveRosterFilterFromParams", () => {
  it("resolves Active by default when no params are present", () => {
    expect(resolveRosterFilterFromParams({})).toBe("active");
  });

  it("resolves roster=active to active", () => {
    expect(resolveRosterFilterFromParams({ roster: "active" })).toBe("active");
  });

  it("resolves roster=inactive to inactive", () => {
    expect(resolveRosterFilterFromParams({ roster: "inactive" })).toBe("inactive");
  });

  it("resolves roster=removed to removed", () => {
    expect(resolveRosterFilterFromParams({ roster: "removed" })).toBe("removed");
  });

  it("resolves roster=all to all", () => {
    expect(resolveRosterFilterFromParams({ roster: "all" })).toBe("all");
  });

  it("falls back to active for an unrecognized roster value", () => {
    expect(resolveRosterFilterFromParams({ roster: "bogus" })).toBe("active");
  });

  it("honours a legacy showRemoved=1 as 'removed' when roster is absent", () => {
    expect(resolveRosterFilterFromParams({ showRemoved: "1" })).toBe("removed");
  });

  it("ignores a legacy showRemoved=1 when it isn't exactly '1'", () => {
    expect(resolveRosterFilterFromParams({ showRemoved: "true" })).toBe("active");
  });

  it("prefers an explicit roster over a legacy showRemoved param", () => {
    expect(resolveRosterFilterFromParams({ roster: "active", showRemoved: "1" })).toBe("active");
    expect(resolveRosterFilterFromParams({ roster: "all", showRemoved: "1" })).toBe("all");
  });
});

describe("rosterFilterQueryValue", () => {
  it("omits the query value for the default 'active' filter", () => {
    expect(rosterFilterQueryValue("active")).toBeUndefined();
  });

  it("returns the literal value for every non-default filter", () => {
    expect(rosterFilterQueryValue("inactive")).toBe("inactive");
    expect(rosterFilterQueryValue("removed")).toBe("removed");
    expect(rosterFilterQueryValue("all")).toBe("all");
  });
});

describe("playerRosterWhere", () => {
  it("active resolves to active, non-removed players", () => {
    expect(playerRosterWhere("active")).toEqual({ removedAt: null, active: true });
  });

  it("inactive resolves to active=false, non-removed players", () => {
    expect(playerRosterWhere("inactive")).toEqual({ removedAt: null, active: false });
  });

  it("removed resolves to removedAt not null, regardless of active", () => {
    expect(playerRosterWhere("removed")).toEqual({ removedAt: { not: null } });
  });

  it("all resolves to no active/removedAt constraint at all", () => {
    expect(playerRosterWhere("all")).toEqual({});
  });
});
