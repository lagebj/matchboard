import { describe, it, expect } from "vitest";
import { initialRoster, rosterDisplayCount, rosterIncludesPlayer, addPlayerToRoster } from "../roster-projection";

describe("roster-projection", () => {
  it("starts at the baseline count with no added players", () => {
    const roster = initialRoster(8);
    expect(rosterDisplayCount(roster)).toBe(8);
    expect(rosterIncludesPlayer(roster, "player-x")).toBe(false);
  });

  it("addPlayerToRoster appends the player and the displayed count is derived, not stored separately", () => {
    const roster = addPlayerToRoster(initialRoster(8), "player-x");
    expect(rosterDisplayCount(roster)).toBe(9);
    expect(rosterIncludesPlayer(roster, "player-x")).toBe(true);
  });

  it("is idempotent — adding the same player twice never double-counts (data-consistency guarantee, not a new permission system)", () => {
    const once = addPlayerToRoster(initialRoster(8), "player-x");
    const twice = addPlayerToRoster(once, "player-x");
    expect(rosterDisplayCount(twice)).toBe(9);
    expect(twice.addedPlayerIds).toEqual(["player-x"]);
  });

  it("does not mutate the input roster (pure reducer)", () => {
    const original = initialRoster(8);
    addPlayerToRoster(original, "player-x");
    expect(original.addedPlayerIds).toEqual([]);
    expect(rosterDisplayCount(original)).toBe(8);
  });

  it("tracks multiple distinct players independently", () => {
    let roster = initialRoster(8);
    roster = addPlayerToRoster(roster, "player-x");
    roster = addPlayerToRoster(roster, "player-y");
    expect(rosterDisplayCount(roster)).toBe(10);
    expect(rosterIncludesPlayer(roster, "player-x")).toBe(true);
    expect(rosterIncludesPlayer(roster, "player-y")).toBe(true);
    expect(rosterIncludesPlayer(roster, "player-z")).toBe(false);
  });
});
