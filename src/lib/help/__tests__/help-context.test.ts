import { describe, it, expect } from "vitest";
import { resolveHelpContextId, getHelpTarget, HELP_TARGETS } from "../help-context";

describe("resolveHelpContextId", () => {
  it("resolves the org-scoped Today route", () => {
    expect(resolveHelpContextId("/o/fjordvik-fk/today")).toBe("today");
  });

  it("treats the org root as Today", () => {
    expect(resolveHelpContextId("/o/fjordvik-fk")).toBe("today");
  });

  it("resolves Players, Fixtures, and Round Board", () => {
    expect(resolveHelpContextId("/o/fjordvik-fk/players")).toBe("players");
    expect(resolveHelpContextId("/o/fjordvik-fk/fixtures")).toBe("fixtures");
    expect(resolveHelpContextId("/o/fjordvik-fk/rounds/abc123")).toBe("round-board");
  });

  it("distinguishes match live, post-match, and tactics contexts", () => {
    expect(resolveHelpContextId("/o/fjordvik-fk/matches/abc/live")).toBe("match-live");
    expect(resolveHelpContextId("/o/fjordvik-fk/matches/abc/post-match")).toBe("post-match");
    expect(resolveHelpContextId("/o/fjordvik-fk/matches/abc")).toBe("match-tactics");
  });

  it("resolves opponents, events, evidence, reports, and settings", () => {
    expect(resolveHelpContextId("/o/fjordvik-fk/opponents/xyz")).toBe("opponents");
    expect(resolveHelpContextId("/o/fjordvik-fk/events/xyz")).toBe("events");
    expect(resolveHelpContextId("/o/fjordvik-fk/insights/player-combinations")).toBe("evidence");
    expect(resolveHelpContextId("/o/fjordvik-fk/season")).toBe("reports");
    expect(resolveHelpContextId("/o/fjordvik-fk/settings")).toBe("settings");
  });

  it("returns null for an unrecognised route rather than guessing", () => {
    expect(resolveHelpContextId("/o/fjordvik-fk/some-unknown-page")).toBeNull();
  });

  it("works without an org prefix too", () => {
    expect(resolveHelpContextId("/players")).toBe("players");
  });
});

describe("getHelpTarget", () => {
  it("returns the docs home for a null context", () => {
    expect(getHelpTarget(null)).toEqual({ docsPath: "/docs", label: "Documentation" });
  });

  it("returns a real target for every declared HelpContextId", () => {
    for (const [id, target] of Object.entries(HELP_TARGETS)) {
      expect(getHelpTarget(id as keyof typeof HELP_TARGETS)).toEqual(target);
      expect(target.docsPath.startsWith("/docs")).toBe(true);
    }
  });
});
