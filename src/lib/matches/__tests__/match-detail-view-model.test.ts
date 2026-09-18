import { describe, it, expect } from "vitest";
import {
  deriveMatchDetailSurfaceState,
  buildMatchPreparationDisplayItems,
  summarizeMatchAttendance,
  aggregateGoalScorers,
  aggregateAssistProviders,
  buildMatchTimelineFromLiveEvents,
  buildMatchTimelineFromReportGoals,
  buildMatchTimeline,
  computePlayerMinutesFromIntervals,
  buildPlayerInvolvement,
  type MatchCanonicalLiveEventFact,
} from "@/lib/matches/match-detail-view-model";
import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";

describe("deriveMatchDetailSurfaceState", () => {
  it("keeps planning_open/planning_closed/live/cancelled on BEFORE (no third composition)", () => {
    const before: MatchLifecycleStatus[] = ["planning_open", "planning_closed", "live", "cancelled"];
    for (const status of before) {
      expect(deriveMatchDetailSurfaceState(status)).toBe("BEFORE");
    }
  });

  it("moves played/report_incomplete/done to AFTER", () => {
    const after: MatchLifecycleStatus[] = ["played", "report_incomplete", "done"];
    for (const status of after) {
      expect(deriveMatchDetailSurfaceState(status)).toBe("AFTER");
    }
  });
});

describe("buildMatchPreparationDisplayItems", () => {
  it("marks squad/lineup ready and computes a transparent ready-for-match AND", () => {
    const items = buildMatchPreparationDisplayItems({
      squadSelectedCount: 12,
      squadTarget: 11,
      hasLineup: true,
      hasPlannedRotation: false,
    });
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(byKey.squad.complete).toBe(true);
    expect(byKey.squad.detail).toBe("12/11");
    expect(byKey.lineup.complete).toBe(true);
    expect(byKey.rotation.complete).toBe(false);
    expect(byKey.rotation.optional).toBe(true);
    expect(byKey.ready.complete).toBe(true);
  });

  it("is not ready when lineup is missing, regardless of squad", () => {
    const items = buildMatchPreparationDisplayItems({
      squadSelectedCount: 12,
      squadTarget: 11,
      hasLineup: false,
      hasPlannedRotation: true,
    });
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(byKey.ready.complete).toBe(false);
  });

  it("is not ready when squad is empty", () => {
    const items = buildMatchPreparationDisplayItems({
      squadSelectedCount: 0,
      squadTarget: 11,
      hasLineup: true,
      hasPlannedRotation: false,
    });
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(byKey.squad.complete).toBe(false);
    expect(byKey.ready.complete).toBe(false);
  });
});

describe("summarizeMatchAttendance", () => {
  it("counts present/no-show and names no-shows explicitly", () => {
    const summary = summarizeMatchAttendance([
      { attendanceStatus: "PRESENT", playerName: "Emil" },
      { attendanceStatus: "PRESENT", playerName: "Noah" },
      { attendanceStatus: "NO_SHOW", playerName: "Safwan D" },
    ]);
    expect(summary.presentCount).toBe(2);
    expect(summary.noShowCount).toBe(1);
    expect(summary.totalCount).toBe(3);
    expect(summary.noShowNames).toEqual(["Safwan D"]);
  });
});

describe("aggregateGoalScorers / aggregateAssistProviders", () => {
  it("aggregates by player, highest count first, alphabetical tiebreak", () => {
    const { scorers, unattributedCount } = aggregateGoalScorers([
      { id: "g1", participantKey: "p1", playerName: "Sebastian R", minute: 4, type: "NORMAL" },
      { id: "g2", participantKey: "p2", playerName: "Nikita F", minute: 8, type: "NORMAL" },
      { id: "g3", participantKey: "p1", playerName: "Sebastian R", minute: 12, type: "NORMAL" },
      { id: "g4", participantKey: null, playerName: null, minute: 50, type: "NORMAL" },
    ]);
    expect(scorers).toEqual([
      { participantKey: "p1", playerName: "Sebastian R", count: 2 },
      { participantKey: "p2", playerName: "Nikita F", count: 1 },
    ]);
    expect(unattributedCount).toBe(1);
  });

  it("never infers an assist — aggregates only real recorded rows", () => {
    const { scorers } = aggregateAssistProviders([
      { id: "a1", participantKey: "p2", playerName: "Nikita F", type: "NORMAL" },
    ]);
    expect(scorers).toEqual([{ participantKey: "p2", playerName: "Nikita F", count: 1 }]);
  });
});

function liveEvent(overrides: Partial<MatchCanonicalLiveEventFact>): MatchCanonicalLiveEventFact {
  return {
    id: "e1",
    eventType: "GOAL_FOR",
    playerName: null,
    // Deliberately different from `id` by default — matches real production `LiveMatchEvent`
    // rows, where `id` (database primary key) and `clientEventId` (client-generated) are
    // unrelated string formats. A regression that matches on `id` instead of `clientEventId`
    // must fail every test in this block, not just a dedicated one.
    clientEventId: "client-e1",
    correctsEventId: null,
    minuteLabel: null,
    period: 1,
    matchSeconds: null,
    ...overrides,
  };
}

describe("buildMatchTimelineFromLiveEvents (canonical linkage truth rule)", () => {
  it("pairs scorer and assist only via correctsEventId pointing at the goal's clientEventId — never its database id", () => {
    const items = buildMatchTimelineFromLiveEvents([
      liveEvent({ id: "goal-1-dbid", clientEventId: "goal-1-client", eventType: "GOAL_FOR", minuteLabel: "12'" }),
      liveEvent({ id: "scorer-1", eventType: "SCORER_SET", correctsEventId: "goal-1-client", playerName: "Emil" }),
      liveEvent({ id: "assist-1", eventType: "ASSIST_SET", correctsEventId: "goal-1-client", playerName: "Noah" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "GOAL_FOR",
      minuteLabel: "12'",
      playerName: "Emil",
      assistPlayerName: "Noah",
      sourceIsCanonicalLiveEvent: true,
    });
  });

  it("does not pair when correctsEventId matches the goal's database id instead of its clientEventId (the real production bug this fixes)", () => {
    const items = buildMatchTimelineFromLiveEvents([
      liveEvent({ id: "goal-1-dbid", clientEventId: "goal-1-client", eventType: "GOAL_FOR" }),
      // Wrong on purpose: targets the database id, as a real EVENT_REVERSED row would (a
      // different, unrelated correctsEventId convention) — must never accidentally match here.
      liveEvent({ id: "scorer-1", eventType: "SCORER_SET", correctsEventId: "goal-1-dbid", playerName: "Emil" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].playerName).toBeNull();
  });

  it("shows a goal with a scorer but no assist when no ASSIST_SET targets it — never inferred", () => {
    const items = buildMatchTimelineFromLiveEvents([
      liveEvent({ id: "goal-2", clientEventId: "goal-2-client", eventType: "GOAL_FOR", minuteLabel: "18'" }),
      liveEvent({ id: "scorer-2", eventType: "SCORER_SET", correctsEventId: "goal-2-client", playerName: "Elias" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].playerName).toBe("Elias");
    expect(items[0].assistPlayerName).toBeNull();
  });

  it("never pairs an assist to the wrong goal merely because both exist in the stream", () => {
    const items = buildMatchTimelineFromLiveEvents([
      liveEvent({ id: "goal-a", clientEventId: "goal-a-client", eventType: "GOAL_FOR", minuteLabel: "10'" }),
      liveEvent({ id: "goal-b", clientEventId: "goal-b-client", eventType: "GOAL_FOR", minuteLabel: "20'" }),
      liveEvent({ id: "assist-b", eventType: "ASSIST_SET", correctsEventId: "goal-b-client", playerName: "Noah" }),
    ]);
    const goalA = items.find((i) => i.id === "goal-a")!;
    const goalB = items.find((i) => i.id === "goal-b")!;
    expect(goalA.assistPlayerName).toBeNull();
    expect(goalB.assistPlayerName).toBe("Noah");
  });

  it("orders strictly by period + within-period elapsed time, ignoring input order — robust to missing coordinator sequence (ARR-0045)", () => {
    // Input deliberately out of chronological order, as a real mixed sequence/no-sequence
    // dataset can arrive from the DB query (NULLS LAST on a plain `ORDER BY sequence` clusters
    // every unsequenced row — predominantly rotations — at the very end regardless of when they
    // actually happened).
    const items = buildMatchTimelineFromLiveEvents([
      liveEvent({ id: "late-goal", eventType: "GOAL_FOR", period: 1, matchSeconds: 2_000_000, minuteLabel: "33'" }),
      liveEvent({ id: "rotation-out", eventType: "ROTATION_OUT", period: 1, matchSeconds: 500_000, playerName: "Elias" }),
      liveEvent({ id: "rotation-in", eventType: "ROTATION_IN", period: 1, matchSeconds: 500_500, playerName: "Henrik" }),
      liveEvent({ id: "early-goal", eventType: "GOAL_FOR", period: 1, matchSeconds: 100_000, minuteLabel: "1'" }),
    ]);
    expect(items.map((i) => i.id)).toEqual(["early-goal", "rotation-out", "late-goal"]);
  });

  it("sorts PERIOD_START first and PERIOD_END last within a period, and MATCH_END after everything", () => {
    const items = buildMatchTimelineFromLiveEvents([
      liveEvent({ id: "match-end", eventType: "MATCH_END", period: 3 }),
      liveEvent({ id: "period-end", eventType: "PERIOD_END", period: 1 }),
      liveEvent({ id: "goal", eventType: "GOAL_FOR", period: 1, matchSeconds: 100_000 }),
      liveEvent({ id: "period-start", eventType: "PERIOD_START", period: 1 }),
    ]);
    expect(items.map((i) => i.id)).toEqual(["period-start", "goal", "period-end", "match-end"]);
  });

  it("pairs rotation out/in within the existing tolerance window", () => {
    const items = buildMatchTimelineFromLiveEvents([
      liveEvent({
        id: "out-1",
        eventType: "ROTATION_OUT",
        playerName: "Elias",
        period: 2,
        matchSeconds: 100_000,
        minuteLabel: "37'",
      }),
      liveEvent({
        id: "in-1",
        eventType: "ROTATION_IN",
        playerName: "Henrik",
        period: 2,
        matchSeconds: 101_000,
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "ROTATION", playerName: "Henrik", secondaryPlayerName: "Elias" });
  });

  it("does not fabricate a rotation partner outside the tolerance window", () => {
    const items = buildMatchTimelineFromLiveEvents([
      liveEvent({ id: "out-2", eventType: "ROTATION_OUT", playerName: "Elias", period: 2, matchSeconds: 100_000 }),
      liveEvent({ id: "in-2", eventType: "ROTATION_IN", playerName: "Henrik", period: 2, matchSeconds: 200_000 }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].playerName).toBeNull();
  });

  it("omits ROTATION_IN/SCORER_SET/ASSIST_SET as their own rows", () => {
    const items = buildMatchTimelineFromLiveEvents([
      liveEvent({ id: "in-3", eventType: "ROTATION_IN", playerName: "Henrik" }),
      liveEvent({ id: "scorer-3", eventType: "SCORER_SET", correctsEventId: "missing-goal", playerName: "Emil" }),
    ]);
    expect(items).toHaveLength(0);
  });
});

describe("buildMatchTimelineFromReportGoals (fallback, no live events)", () => {
  it("never pairs an assist — assists have no stored linkage to a specific goal", () => {
    const items = buildMatchTimelineFromReportGoals([
      { id: "g1", participantKey: "p1", playerName: "Emil", minute: 12, type: "NORMAL" },
    ]);
    expect(items).toEqual([
      {
        id: "g1",
        kind: "GOAL_FOR",
        minuteLabel: "12'",
        playerName: "Emil",
        assistPlayerName: null,
        secondaryPlayerName: null,
        sourceIsCanonicalLiveEvent: false,
      },
    ]);
  });

  it("sorts by minute, unknown minutes last", () => {
    const items = buildMatchTimelineFromReportGoals([
      { id: "g2", participantKey: "p2", playerName: "Noah", minute: null, type: "NORMAL" },
      { id: "g1", participantKey: "p1", playerName: "Emil", minute: 5, type: "NORMAL" },
    ]);
    expect(items.map((i) => i.id)).toEqual(["g1", "g2"]);
  });
});

describe("buildMatchTimeline (source selection — never both, per data-mapping rule 3)", () => {
  it("uses live events when any exist, ignoring report goals entirely", () => {
    const items = buildMatchTimeline({
      canonicalLiveEvents: [liveEvent({ id: "goal-1", eventType: "GOAL_FOR" })],
      reportGoals: [{ id: "g1", participantKey: "p1", playerName: "Emil", minute: 1, type: "NORMAL" }],
    });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("goal-1");
    expect(items[0].sourceIsCanonicalLiveEvent).toBe(true);
  });

  it("falls back to report goals when no live events exist", () => {
    const items = buildMatchTimeline({
      canonicalLiveEvents: [],
      reportGoals: [{ id: "g1", participantKey: "p1", playerName: "Emil", minute: 1, type: "NORMAL" }],
    });
    expect(items).toHaveLength(1);
    expect(items[0].sourceIsCanonicalLiveEvent).toBe(false);
  });
});

describe("computePlayerMinutesFromIntervals", () => {
  it("sums closed intervals per participant, in whole minutes", () => {
    const minutes = computePlayerMinutesFromIntervals([
      { participantKey: "p1", startedAtMs: 0, endedAtMs: 60_000 },
      { participantKey: "p1", startedAtMs: 60_000, endedAtMs: 120_000 },
      { participantKey: "p2", startedAtMs: 0, endedAtMs: 30_000 },
    ]);
    expect(minutes.get("p1")).toBe(2);
    expect(minutes.get("p2")).toBe(1);
  });

  it("excludes never-closed intervals rather than guessing an end time", () => {
    const minutes = computePlayerMinutesFromIntervals([
      { participantKey: "p1", startedAtMs: 0, endedAtMs: null },
    ]);
    expect(minutes.has("p1")).toBe(false);
  });
});

describe("buildPlayerInvolvement", () => {
  it("only includes present participants, with real goals/assists/observations/minutes", () => {
    const rows = buildPlayerInvolvement({
      presentParticipants: [
        { participantKey: "p1", playerName: "Emil" },
        { participantKey: "p2", playerName: "Noah" },
      ],
      goals: [{ id: "g1", participantKey: "p1", playerName: "Emil", minute: 1, type: "NORMAL" }],
      assists: [{ id: "a1", participantKey: "p2", playerName: "Noah", type: "NORMAL" }],
      observationCountByParticipant: new Map([["p1", 2]]),
      minutesByParticipant: new Map([["p1", 70]]),
    });
    expect(rows).toEqual([
      { participantKey: "p1", playerName: "Emil", goals: 1, assists: 0, observationCount: 2, minutes: 70 },
      { participantKey: "p2", playerName: "Noah", goals: 0, assists: 1, observationCount: 0, minutes: null },
    ]);
  });

  it("never fabricates minutes for a player with no closed interval data", () => {
    const rows = buildPlayerInvolvement({
      presentParticipants: [{ participantKey: "p1", playerName: "Emil" }],
      goals: [],
      assists: [],
      observationCountByParticipant: new Map(),
      minutesByParticipant: new Map(),
    });
    expect(rows[0].minutes).toBeNull();
  });
});
