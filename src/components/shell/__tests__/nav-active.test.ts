import { describe, it, expect } from "vitest";
import { isNavItemActive, LEAGUE_SECONDARY_PREFIXES } from "../nav-active";

/**
 * Contract test for ADR-0157 C8's "Active nav state": `More` is gone, `/opponents` (and
 * `/season`) make League active, and admin/settings-style routes select no primary item
 * rather than inventing a fifth nav entry.
 */
describe("isNavItemActive", () => {
  const leagueHref = "/o/fjordvik-fk/fixtures";
  const todayHref = "/o/fjordvik-fk/today";
  const playersHref = "/o/fjordvik-fk/players";

  it("matches the item whose href is a pathname prefix", () => {
    expect(isNavItemActive("/o/fjordvik-fk/today", todayHref)).toBe(true);
    expect(isNavItemActive("/o/fjordvik-fk/today/sub", todayHref)).toBe(true);
    expect(isNavItemActive("/o/fjordvik-fk/players/p1", playersHref)).toBe(true);
  });

  it("makes League active for /opponents", () => {
    expect(isNavItemActive("/o/fjordvik-fk/opponents", leagueHref)).toBe(true);
    expect(isNavItemActive("/o/fjordvik-fk/opponents/opp-1", leagueHref)).toBe(true);
  });

  it("makes League active for /season (Season Review, ADR-0157 C7)", () => {
    expect(isNavItemActive("/o/fjordvik-fk/season", leagueHref)).toBe(true);
  });

  it("still makes League active for rounds/matches/teams", () => {
    expect(isNavItemActive("/o/fjordvik-fk/rounds/r1", leagueHref)).toBe(true);
    expect(isNavItemActive("/o/fjordvik-fk/matches/m1", leagueHref)).toBe(true);
    expect(isNavItemActive("/o/fjordvik-fk/teams/t1", leagueHref)).toBe(true);
  });

  it("selects no primary item for admin/settings-style routes", () => {
    for (const path of [
      "/o/fjordvik-fk/settings",
      "/o/fjordvik-fk/groups",
      "/o/fjordvik-fk/rules",
      "/o/fjordvik-fk/simulation",
      "/o/fjordvik-fk/workbench",
    ]) {
      expect(isNavItemActive(path, todayHref)).toBe(false);
      expect(isNavItemActive(path, leagueHref)).toBe(false);
      expect(isNavItemActive(path, playersHref)).toBe(false);
    }
  });

  it("no longer has a More branch at all", () => {
    expect(isNavItemActive("/o/fjordvik-fk/more", "/o/fjordvik-fk/more")).toBe(true); // prefix match only
    // /more is not one of the four real items' hrefs, so nothing in the real nav resolves to it.
    expect(LEAGUE_SECONDARY_PREFIXES).not.toContain("/more");
  });

  it("LEAGUE_SECONDARY_PREFIXES contains exactly the expected secondary routes", () => {
    expect(LEAGUE_SECONDARY_PREFIXES).toEqual(["/rounds", "/matches", "/teams", "/season", "/opponents"]);
  });
});
