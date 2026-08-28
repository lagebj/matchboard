import { describe, it, expect } from "vitest";
import { deriveCombinationsFromSegments, deriveConfidence, buildSegmentsFromIntervals } from "../combination-topology";
import type { ActualIntervalRow } from "../actual-timeline";
import type { GoalAttributionEvent } from "../combination-goal-attribution";
import type { FootballMatchRef } from "../football-match-ref";

type Slot = { position: string; line: string | null; lane: string | null };

const GK = (): Slot => ({ position: "GOALKEEPER", line: "GK", lane: "CENTRE" });
const LCB = (): Slot => ({ position: "DEFENDER", line: "DEF", lane: "LEFT" });
const RCB = (): Slot => ({ position: "DEFENDER", line: "DEF", lane: "RIGHT" });
const CDM = (): Slot => ({ position: "DEFENSIVE_MIDFIELDER", line: "MID", lane: "CENTRE" });
const CM = (): Slot => ({ position: "MIDFIELDER", line: "MID", lane: "CENTRE" });
const LM = (): Slot => ({ position: "MIDFIELDER", line: "MID", lane: "LEFT" });
const AM = (): Slot => ({ position: "ATTACKING_MIDFIELDER", line: "MID", lane: "CENTRE" });
const LW = (): Slot => ({ position: "FORWARD", line: "ATT", lane: "LEFT" });
const RW = (): Slot => ({ position: "FORWARD", line: "ATT", lane: "RIGHT" });
const ST = (): Slot => ({ position: "FORWARD", line: "ATT", lane: "CENTRE" });
const UNKNOWN = (): Slot => ({ position: "unknown", line: null, lane: null });

describe("Combination topology — deriveCombinationsFromSegments", () => {
  const orgId = "org-1";
  const matchId = "match-1";
  const ref: FootballMatchRef = { kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null };
  const leagueSeasonId = "ls-1";

  function makeSegment(startMs: number, endMs: number, playersOnPitch: Map<string, Slot>) {
    return { startMs, endMs, playersOnPitch };
  }

  it("derives horizontal partnership between two centre-backs", () => {
    const segments = [
      makeSegment(0, 5400000, new Map([
        ["p1", GK()],
        ["p2", LCB()],
        ["p3", RCB()],
        ["p4", CM()],
      ])),
    ];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const cbPartnership = rows.find(
      (r) => r.family === "PARTNERSHIP" && r.playerIds.includes("p2") && r.playerIds.includes("p3"),
    );
    expect(cbPartnership).toBeDefined();
    expect(cbPartnership!.subtype).toBe("HORIZONTAL");
    expect(cbPartnership!.playerIds).toHaveLength(2);
  });

  it("derives goalkeeper link between GK and CB", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", GK()], ["p2", LCB()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const gkLink = rows.find((r) => r.family === "PARTNERSHIP" && r.subtype === "GOALKEEPER_LINK");
    expect(gkLink).toBeDefined();
    expect(gkLink!.playerIds.sort()).toEqual(["p1", "p2"]);
  });

  it("derives vertical partnership between defender and midfielder", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", GK()], ["p2", LCB()], ["p3", CM()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const verticalPartnership = rows.find(
      (r) => r.family === "PARTNERSHIP" && r.playerIds.includes("p2") && r.playerIds.includes("p3") && r.subtype === "VERTICAL",
    );
    expect(verticalPartnership).toBeDefined();
  });

  it("does not guess a partnership subtype when a player's line is unknown", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", LCB()], ["p2", UNKNOWN()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const partnership = rows.find((r) => r.family === "PARTNERSHIP");
    expect(partnership).toBeDefined();
    expect(partnership!.subtype).toBeNull();
  });

  it("accumulates minutes across multiple segments for the same pair", () => {
    const segments = [
      makeSegment(0, 2700000, new Map([["p1", LCB()], ["p2", RCB()]])),
      makeSegment(2700000, 5400000, new Map([["p1", LCB()], ["p2", RCB()], ["p3", CM()]])),
    ];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const cbPartnership = rows.find(
      (r) => r.family === "PARTNERSHIP" && r.playerIds.includes("p1") && r.playerIds.includes("p2"),
    );
    expect(cbPartnership).toBeDefined();
    expect(cbPartnership!.minutesTogether).toBe(90);
  });

  it("derives a defensive line from two or more occupied defensive positions", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", GK()], ["p2", LCB()], ["p3", RCB()], ["p4", CM()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const line = rows.find((r) => r.family === "LINE" && r.subtype === "DEFENSIVE");
    expect(line).toBeDefined();
    expect(line!.playerIds.sort()).toEqual(["p2", "p3"]);
  });

  it("does not derive a line for the goalkeeper (single occupant, not a football line)", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", GK()], ["p2", LCB()], ["p3", RCB()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    expect(rows.find((r) => r.family === "LINE" && r.subtype === ("GOALKEEPER" as never))).toBeUndefined();
  });

  it("derives a left corridor when players in different lines share the left lane", () => {
    const segments = [
      makeSegment(0, 5400000, new Map([
        ["p1", GK()],
        ["p2", { position: "DEFENDER", line: "DEF", lane: "LEFT" }],
        ["p3", LM()],
        ["p4", LW()],
      ])),
    ];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const corridor = rows.find((r) => r.family === "CORRIDOR" && r.subtype === "LEFT");
    expect(corridor).toBeDefined();
    expect(corridor!.playerIds.sort()).toEqual(["p2", "p3", "p4"]);
  });

  it("does not derive a corridor from a single-line lane group", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", LCB()], ["p2", { position: "DEFENDER", line: "DEF", lane: "LEFT" }]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    expect(rows.find((r) => r.family === "CORRIDOR")).toBeUndefined();
  });

  it("derives central-spine triangle for goalkeeper + two centre-backs", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", GK()], ["p2", LCB()], ["p3", RCB()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const triangle = rows.find((r) => r.family === "TRIANGLE" && r.subtype === "CENTRAL_SPINE");
    expect(triangle).toBeDefined();
    expect(triangle!.playerIds.sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("derives defensive triangle for two centre-backs + a defensive midfielder", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", LCB()], ["p2", RCB()], ["p3", CDM()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const triangle = rows.find((r) => r.family === "TRIANGLE" && r.subtype === "DEFENSIVE");
    expect(triangle).toBeDefined();
  });

  it("derives midfield triangle for three central midfield roles", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", CDM()], ["p2", CM()], ["p3", AM()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const triangle = rows.find((r) => r.family === "TRIANGLE" && r.subtype === "MIDFIELD");
    expect(triangle).toBeDefined();
  });

  it("derives attacking triangle for a front three", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", LW()], ["p2", ST()], ["p3", RW()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const triangle = rows.find((r) => r.family === "TRIANGLE" && r.subtype === "ATTACKING");
    expect(triangle).toBeDefined();
  });

  it("derives wide triangle when three players share a lane across different lines", () => {
    const segments = [
      makeSegment(0, 5400000, new Map([
        ["p1", { position: "DEFENDER", line: "DEF", lane: "LEFT" }],
        ["p2", LM()],
        ["p3", LW()],
      ])),
    ];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const triangle = rows.find((r) => r.family === "TRIANGLE" && r.subtype === "WIDE");
    expect(triangle).toBeDefined();
  });

  it("does not classify an arbitrary unrelated trio as a triangle", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", GK()], ["p2", CM()], ["p3", ST()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    expect(rows.find((r) => r.family === "TRIANGLE")).toBeUndefined();
  });

  it("derives a build-up functional unit from goalkeeper + defensive line, excluding the rest of the team", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", GK()], ["p2", LCB()], ["p3", RCB()], ["p4", CM()], ["p5", ST()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const unit = rows.find((r) => r.family === "FUNCTIONAL_UNIT" && r.subtype === "BUILD_UP");
    expect(unit).toBeDefined();
    expect(unit!.playerIds.sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("derives an attacking functional unit from forwards + attacking midfielder, excluding the rest of the team", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", AM()], ["p2", ST()], ["p3", LW()], ["p4", LCB()], ["p5", RCB()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const unit = rows.find((r) => r.family === "FUNCTIONAL_UNIT" && r.subtype === "ATTACKING_UNIT");
    expect(unit).toBeDefined();
  });

  it("does not derive a build-up unit that equals the entire on-pitch team", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", GK()], ["p2", LCB()], ["p3", RCB()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    expect(rows.find((r) => r.family === "FUNCTIONAL_UNIT" && r.subtype === "BUILD_UP")).toBeUndefined();
  });

  it("derives full configuration containing every on-pitch player in the segment", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", GK()], ["p2", LCB()], ["p3", CM()], ["p4", ST()]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const full = rows.find((r) => r.family === "FULL_CONFIGURATION");
    expect(full).toBeDefined();
    expect(full!.playerIds.sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("only produces partnership, a meaningful triangle, and full configuration for a 3-a-side segment", () => {
    const segments = [makeSegment(0, 1800000, new Map([["p1", ST()], ["p2", CM()], ["p3", { position: "DEFENDER", line: "DEF", lane: "CENTRE" }]]))];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId);

    const families = new Set(rows.map((r) => r.family));
    expect(families.has("PARTNERSHIP")).toBe(true);
    expect(families.has("FULL_CONFIGURATION")).toBe(true);
    // No 2+ player LINE/CORRIDOR exists with only one occupant per line/lane in this shape.
    expect(families.has("LINE")).toBe(false);
    expect(families.has("CORRIDOR")).toBe(false);
  });

  it("attributes a goal-for to combinations active at the goal's time and to the direct scorer/assist", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", LCB()], ["p2", RCB()], ["p3", ST()]]))];
    const goalEvents: GoalAttributionEvent[] = [
      { matchMs: 1_000_000, team: "FOR", scorerPlayerId: "p3", assistPlayerId: "p1", approximateTiming: false },
    ];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId, goalEvents);

    const cbPartnership = rows.find((r) => r.family === "PARTNERSHIP" && r.playerIds.includes("p1") && r.playerIds.includes("p2"));
    expect(cbPartnership!.goalsForWhilePresent).toBe(1);
    expect(cbPartnership!.directGoalContributions).toBe(0);

    const scorerAssistPartnership = rows.find((r) => r.family === "PARTNERSHIP" && r.playerIds.includes("p1") && r.playerIds.includes("p3"));
    expect(scorerAssistPartnership!.goalsForWhilePresent).toBe(1);
    expect(scorerAssistPartnership!.directGoalContributions).toBe(1);
    expect(scorerAssistPartnership!.directAssistContributions).toBe(1);
  });

  it("attributes a goal-against to the team without assigning individual blame", () => {
    const segments = [makeSegment(0, 5400000, new Map([["p1", LCB()], ["p2", RCB()]]))];
    const goalEvents: GoalAttributionEvent[] = [
      { matchMs: 1_000_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
    ];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId, goalEvents);

    const partnership = rows.find((r) => r.family === "PARTNERSHIP");
    expect(partnership!.goalsAgainstWhilePresent).toBe(1);
    expect(partnership!.directGoalContributions).toBe(0);
  });

  it("ignores a goal event outside every segment's time window", () => {
    const segments = [makeSegment(0, 1000, new Map([["p1", LCB()], ["p2", RCB()]]))];
    const goalEvents: GoalAttributionEvent[] = [
      { matchMs: 5000, team: "FOR", scorerPlayerId: "p1", assistPlayerId: null, approximateTiming: false },
    ];

    const rows = deriveCombinationsFromSegments(segments, ref, orgId, leagueSeasonId, goalEvents);

    expect(rows.find((r) => r.family === "PARTNERSHIP")!.goalsForWhilePresent).toBe(0);
  });

  it("excludes bench and unknown positions from segments", () => {
    const intervals: ActualIntervalRow[] = [
      { playerId: "p1", position: "DEFENDER", line: "DEF", lane: "LEFT", startedAtMs: 0, endedAtMs: 5400000, source: "STARTING_LINEUP" as const, approximateTiming: false },
      { playerId: "p2", position: "BENCH", line: null, lane: null, startedAtMs: 0, endedAtMs: 2700000, source: "STARTING_LINEUP" as const, approximateTiming: false },
      { playerId: "p2", position: "MIDFIELDER", line: "MID", lane: "CENTRE", startedAtMs: 2700000, endedAtMs: 5400000, source: "SUBSTITUTION" as const, approximateTiming: false },
    ];

    const segments = buildSegmentsFromIntervals(intervals, 5400000);

    for (const segment of segments) {
      for (const [, slot] of segment.playersOnPitch) {
        expect(slot.position).not.toBe("BENCH");
        expect(slot.position).not.toBe("unknown");
      }
    }
    const afterSub = segments.find((s) => s.startMs === 2700000);
    expect(afterSub!.playersOnPitch.get("p2")!.line).toBe("MID");
  });
});

describe("deriveConfidence", () => {
  it("returns INSUFFICIENT for less than 30 minutes", () => {
    expect(deriveConfidence(15, 1, 1)).toBe("INSUFFICIENT");
  });

  it("returns INSUFFICIENT for zero minutes", () => {
    expect(deriveConfidence(0, 1, 1)).toBe("INSUFFICIENT");
  });

  it("returns EMERGING for 30-179 minutes", () => {
    expect(deriveConfidence(60, 2, 2)).toBe("EMERGING");
  });

  it("returns EMERGING for sufficient minutes but low diversity", () => {
    expect(deriveConfidence(200, 2, 1)).toBe("EMERGING");
  });

  it("returns ESTABLISHED for 180+ minutes, 3+ matches, 2+ opponents", () => {
    expect(deriveConfidence(200, 3, 2)).toBe("ESTABLISHED");
  });

  it("returns ESTABLISHED for high minutes and diversity", () => {
    expect(deriveConfidence(500, 5, 3)).toBe("ESTABLISHED");
  });
});
