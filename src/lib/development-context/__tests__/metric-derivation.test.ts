import { describe, expect, it } from "vitest";
import {
  buildCoPresenceDrafts,
  buildEventDrafts,
  buildGameStateRoleSecondsDrafts,
  buildRoleSecondsDrafts,
  buildZoneShareDrafts,
  type EligibleEventRow,
} from "../metric-derivation";
import type { MatchStateInterval } from "@/lib/evidence/match-state-timeline";

const SCOPE_KEY = "match-1";

function interval(overrides: Partial<MatchStateInterval> & Pick<MatchStateInterval, "startMs" | "endMs" | "players">): MatchStateInterval {
  return {
    durationMs: overrides.endMs - overrides.startMs,
    period: null,
    matchPhases: [],
    structuralSummary: { onPitchCount: overrides.players.length, byLine: {}, byLane: {} },
    scoreAtStart: { for: 0, against: 0 },
    scoreAtEnd: { for: 0, against: 0 },
    goalsFor: 0,
    goalsAgainst: 0,
    timingQuality: "EXACT",
    ...overrides,
  };
}

function event(overrides: Partial<EligibleEventRow> & Pick<EligibleEventRow, "id" | "eventType" | "playerId">): EligibleEventRow {
  return { matchSeconds: null, payload: null, ...overrides };
}

describe("buildRoleSecondsDrafts (ADR-0155 §4)", () => {
  it("reproduces the mandatory fixture: CM 0-600, RW 600-900, CM 900-1200 => CM 900s, RW 300s", () => {
    const { drafts } = buildRoleSecondsDrafts(
      SCOPE_KEY,
      [
        { playerId: "p1", position: "CM", startedAtMs: 0, endedAtMs: 600_000 },
        { playerId: "p1", position: "RW", startedAtMs: 600_000, endedAtMs: 900_000 },
        { playerId: "p1", position: "CM", startedAtMs: 900_000, endedAtMs: 1_200_000 },
      ],
      1_200_000,
    );

    const byPosition = Object.fromEntries(drafts.map((d) => [d.dimensions.position, d.value]));
    expect(byPosition).toEqual({ CM: 900, RW: 300 });
  });

  it("excludes BENCH and unknown position intervals", () => {
    const { drafts } = buildRoleSecondsDrafts(
      SCOPE_KEY,
      [
        { playerId: "p1", position: "BENCH", startedAtMs: 0, endedAtMs: 600_000 },
        { playerId: "p1", position: "unknown", startedAtMs: 600_000, endedAtMs: 900_000 },
      ],
      1_200_000,
    );
    expect(drafts).toEqual([]);
  });

  it("never fills unresolved role time from a guess when both endedAtMs and matchEndMs are null", () => {
    const { drafts } = buildRoleSecondsDrafts(SCOPE_KEY, [{ playerId: "p1", position: "CM", startedAtMs: 0, endedAtMs: null }], null);
    expect(drafts).toEqual([]);
  });

  it("returns each player's total exposure across positions", () => {
    const { totalExposureSecondsByPlayer } = buildRoleSecondsDrafts(
      SCOPE_KEY,
      [
        { playerId: "p1", position: "CM", startedAtMs: 0, endedAtMs: 600_000 },
        { playerId: "p1", position: "RW", startedAtMs: 600_000, endedAtMs: 900_000 },
      ],
      900_000,
    );
    expect(totalExposureSecondsByPlayer.get("p1")).toBe(900);
  });

  it("produces the same inputRevision regardless of input array order", () => {
    const a = buildRoleSecondsDrafts(
      SCOPE_KEY,
      [
        { playerId: "p1", position: "CM", startedAtMs: 0, endedAtMs: 600_000 },
        { playerId: "p1", position: "CM", startedAtMs: 900_000, endedAtMs: 1_200_000 },
      ],
      1_200_000,
    ).drafts[0]!.inputRevision;

    const b = buildRoleSecondsDrafts(
      SCOPE_KEY,
      [
        { playerId: "p1", position: "CM", startedAtMs: 900_000, endedAtMs: 1_200_000 },
        { playerId: "p1", position: "CM", startedAtMs: 0, endedAtMs: 600_000 },
      ],
      1_200_000,
    ).drafts[0]!.inputRevision;

    expect(a).toBe(b);
  });
});

describe("buildGameStateRoleSecondsDrafts (ADR-0155 §4)", () => {
  it("reproduces the mandatory game-state sequence, split by position", () => {
    const intervals: MatchStateInterval[] = [
      interval({ startMs: 0, endMs: 300_000, players: [{ playerId: "p1", position: "CM", line: null, lane: null }], scoreAtStart: { for: 0, against: 0 } }),
      interval({ startMs: 300_000, endMs: 700_000, players: [{ playerId: "p1", position: "CM", line: null, lane: null }], scoreAtStart: { for: 1, against: 0 } }),
      interval({ startMs: 700_000, endMs: 1_000_000, players: [{ playerId: "p1", position: "CM", line: null, lane: null }], scoreAtStart: { for: 1, against: 1 } }),
      interval({ startMs: 1_000_000, endMs: 1_200_000, players: [{ playerId: "p1", position: "CM", line: null, lane: null }], scoreAtStart: { for: 1, against: 2 } }),
    ];

    const drafts = buildGameStateRoleSecondsDrafts(SCOPE_KEY, intervals);
    const byGameState = Object.fromEntries(drafts.map((d) => [d.dimensions.gameState, d.value]));

    expect(byGameState).toEqual({ DRAWING: 300 + 300, LEADING: 400, TRAILING: 200 });
  });

  it("never redistributes UNKNOWN time into a known state", () => {
    const intervals: MatchStateInterval[] = [
      interval({ startMs: 0, endMs: 100_000, players: [{ playerId: "p1", position: "CM", line: null, lane: null }], timingQuality: "UNAVAILABLE" }),
    ];
    const drafts = buildGameStateRoleSecondsDrafts(SCOPE_KEY, intervals);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.dimensions.gameState).toBe("UNKNOWN");
    expect(drafts[0]!.value).toBe(100);
  });
});

describe("buildCoPresenceDrafts (ADR-0155 §4)", () => {
  it("reproduces the mandatory fixture and emits both players' perspectives", () => {
    const intervals: MatchStateInterval[] = [
      interval({ startMs: 0, endMs: 300_000, players: [{ playerId: "A", position: "CM", line: null, lane: null }] }),
      interval({
        startMs: 300_000,
        endMs: 600_000,
        players: [
          { playerId: "A", position: "CM", line: null, lane: null },
          { playerId: "B", position: "RW", line: null, lane: null },
        ],
      }),
      interval({ startMs: 600_000, endMs: 900_000, players: [{ playerId: "B", position: "RW", line: null, lane: null }] }),
      interval({
        startMs: 900_000,
        endMs: 1_000_000,
        players: [
          { playerId: "A", position: "CM", line: null, lane: null },
          { playerId: "B", position: "RW", line: null, lane: null },
        ],
      }),
      interval({ startMs: 1_000_000, endMs: 1_200_000, players: [{ playerId: "A", position: "CM", line: null, lane: null }] }),
    ];

    const drafts = buildCoPresenceDrafts(SCOPE_KEY, intervals);

    expect(drafts).toHaveLength(2);
    const fromA = drafts.find((d) => d.playerId === "A")!;
    const fromB = drafts.find((d) => d.playerId === "B")!;
    expect(fromA.dimensions.teammateId).toBe("B");
    expect(fromA.value).toBe(400);
    expect(fromB.dimensions.teammateId).toBe("A");
    expect(fromB.value).toBe(400);
  });
});

describe("buildEventDrafts (ADR-0155 §4)", () => {
  it("counts events per player and eventType, and computes event_rate as count/exposure", () => {
    const events: EligibleEventRow[] = [
      event({ id: "e1", eventType: "GOAL_FOR", playerId: "p1" }),
      event({ id: "e2", eventType: "GOAL_FOR", playerId: "p1" }),
      event({ id: "e3", eventType: "MOMENT_MARKED", playerId: "p1" }),
    ];
    const exposure = new Map([["p1", 1200]]);

    const drafts = buildEventDrafts(SCOPE_KEY, events, exposure);

    const goalCount = drafts.find((d) => d.metricKey === "event_count" && d.dimensions.eventType === "GOAL_FOR")!;
    expect(goalCount.value).toBe(2);

    const goalRate = drafts.find((d) => d.metricKey === "event_rate" && d.dimensions.eventType === "GOAL_FOR")!;
    expect(goalRate.numerator).toBe(2);
    expect(goalRate.denominator).toBe(1200);
    expect(goalRate.value).toBeCloseTo(2 / 1200);
    expect(goalRate.presentationScale).toBe(600);
  });

  it("reproduces the mandatory rate fixture: 4 / 1200s => 2.0 per 600s display scale", () => {
    const events: EligibleEventRow[] = [
      event({ id: "e1", eventType: "MOMENT_MARKED", playerId: "p1" }),
      event({ id: "e2", eventType: "MOMENT_MARKED", playerId: "p1" }),
      event({ id: "e3", eventType: "MOMENT_MARKED", playerId: "p1" }),
      event({ id: "e4", eventType: "MOMENT_MARKED", playerId: "p1" }),
    ];
    const drafts = buildEventDrafts(SCOPE_KEY, events, new Map([["p1", 1200]]));
    const rate = drafts.find((d) => d.metricKey === "event_rate")!;

    expect(rate.value * rate.presentationScale!).toBeCloseTo(2.0);
  });

  it("never fabricates a rate from a zero or missing exposure denominator", () => {
    const events: EligibleEventRow[] = [event({ id: "e1", eventType: "GOAL_FOR", playerId: "p1" })];

    const withZeroExposure = buildEventDrafts(SCOPE_KEY, events, new Map([["p1", 0]]));
    const withNoExposure = buildEventDrafts(SCOPE_KEY, events, new Map());

    expect(withZeroExposure.some((d) => d.metricKey === "event_rate")).toBe(false);
    expect(withNoExposure.some((d) => d.metricKey === "event_rate")).toBe(false);
    expect(withZeroExposure.some((d) => d.metricKey === "event_count")).toBe(true);
  });

  it("skips events with no player attribution", () => {
    const events: EligibleEventRow[] = [event({ id: "e1", eventType: "GOAL_FOR", playerId: null })];
    expect(buildEventDrafts(SCOPE_KEY, events, new Map())).toEqual([]);
  });
});

describe("buildZoneShareDrafts — disclosed-inert spatial evidence (ADR-0155 §3)", () => {
  it("reproduces the mandatory spatial-coverage fixture shape for the zero-coordinate case", () => {
    const events: EligibleEventRow[] = Array.from({ length: 10 }, (_, i) =>
      event({ id: `e${i}`, eventType: "MOMENT_MARKED", playerId: "p1" }),
    );
    const drafts = buildZoneShareDrafts(SCOPE_KEY, events);

    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.numerator).toBe(0);
    expect(drafts[0]!.denominator).toBe(10);
    expect(drafts[0]!.quality.coverage).toBe("UNKNOWN");
    expect(drafts[0]!.quality.eligible).toBe(false);
    expect(drafts[0]!.quality.missingInputs).toContain("eventCoordinates");
  });

  it("never emits a row for a player with zero eligible events", () => {
    expect(buildZoneShareDrafts(SCOPE_KEY, [])).toEqual([]);
  });

  it("skips the UNKNOWN-coverage row once any event has a valid coordinate", () => {
    const events: EligibleEventRow[] = [event({ id: "e1", eventType: "MOMENT_MARKED", playerId: "p1", payload: { x: 0.5, y: 0.5 } })];
    expect(buildZoneShareDrafts(SCOPE_KEY, events)).toEqual([]);
  });
});
