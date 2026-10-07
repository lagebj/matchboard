import { describe, it, expect } from "vitest";
import {
  resolveRetiredInsightDestination,
  type RetiredInsightRedirectSearchParams,
} from "../retired-insight-redirects";

function dest(
  slug: string,
  params: RetiredInsightRedirectSearchParams = {},
  search = new URLSearchParams(),
): string {
  return resolveRetiredInsightDestination(slug, params, search);
}

/**
 * ADR-0157 slice C8 — retired `/insights/*` deep links redirect to their contextual owner with
 * selected-entity query params preserved (`11_INSIGHTS_ROUTE_DISPOSITION.md`), never to a
 * generic hub that discards intent.
 */
describe("resolveRetiredInsightDestination", () => {
  it("routes the opportunity family to Season Review's Opportunity tab", () => {
    for (const slug of ["opportunity", "opportunity-quality", "opportunity-gap", "load"]) {
      expect(dest(slug, { leagueSeasonId: "LS1" })).toBe(
        `/season?tab=opportunity&leagueSeasonId=LS1`,
      );
    }
  });

  it("preserves a leagueSeasonId from the raw search string when not in the typed params", () => {
    const search = new URLSearchParams("leagueSeasonId=LS2");
    expect(dest("opportunity-gap", {}, search)).toBe(`/season?tab=opportunity&leagueSeasonId=LS2`);
  });

  it("routes position-exposure to Player Detail evidence for one player, Season development otherwise", () => {
    expect(dest("position-exposure", { playerId: "P1" })).toBe(`/players/P1?tab=evidence`);
    expect(dest("position-exposure", { leagueSeasonId: "LS1" })).toBe(
      `/season?tab=development&leagueSeasonId=LS1`,
    );
  });

  it("routes player-pathways to Player Detail matches for one player, Season players otherwise", () => {
    expect(dest("player-pathways", { playerId: "P1" })).toBe(`/players/P1?tab=matches`);
    expect(dest("player-pathways", { leagueSeasonId: "LS1" })).toBe(
      `/season?tab=players&leagueSeasonId=LS1`,
    );
  });

  it("routes planned-vs-actual to the completed match with its tab, Season overview otherwise", () => {
    expect(dest("planned-vs-actual", { matchId: "M1" })).toBe(`/matches/M1?tab=after-match`);
    expect(dest("planned-vs-actual", { leagueSeasonId: "LS1" })).toBe(
      `/season?tab=overview&leagueSeasonId=LS1`,
    );
  });

  it("routes coverage/continuity/match-phase-patterns to Season teams", () => {
    for (const slug of ["coverage", "continuity", "match-phase-patterns"]) {
      expect(dest(slug, { leagueSeasonId: "LS1" })).toBe(`/season?tab=teams&leagueSeasonId=LS1`);
    }
  });

  it("routes player-combinations to the exact opponent when present", () => {
    expect(dest("player-combinations", { teamId: "T1" })).toBe(`/opponents/T1`);
    expect(dest("player-combinations")).toBe(`/season?tab=teams`);
  });

  it("routes actionable current-state jobs to Today", () => {
    for (const slug of ["policy-warnings", "conflicts", "operational-health"]) {
      expect(dest(slug)).toBe(`/today`);
    }
  });

  it("falls back to Season overview for an unknown slug without dropping params", () => {
    expect(dest("some-future-insight", { leagueSeasonId: "LS1" })).toBe(
      `/season?tab=overview&leagueSeasonId=LS1`,
    );
  });

  it("never produces a destination with a doubled or dangling question mark", () => {
    const search = new URLSearchParams([["leagueSeasonId", "LS1"], ["playerId", "P1"]]);
    const result = dest("position-exposure", { playerId: "P1" }, search);
    expect(result).not.toContain("??");
    expect(result.endsWith("?")).toBe(false);
  });
});