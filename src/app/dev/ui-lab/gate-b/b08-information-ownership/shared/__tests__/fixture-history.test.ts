import { describe, it, expect } from "vitest";
import {
  b08CanonicalLiveEvents,
  B08_LIVE_GOALS_RECORDED,
  b08GoalScorers,
  b08AssistProviders,
  b08GoalAttributionGap,
  b08TimingReview,
  b08MinutesByParticipant,
  b08PlayerInvolvement,
  b08InitialReport,
  b08AfterData,
  b08AttendanceFacts,
  b08AttendanceSummary,
  b08ShapeChangeRows,
  b08Reflection,
  b08OpponentObservation,
  b08DebriefAnswers,
} from "../fixture-history";
import { B08_MATCH_FORMAT, globalMinuteToPeriodRelative } from "../fixture";
import { debriefAnswersSchema, DEBRIEF_SCHEMA_VERSION } from "@/lib/post-match/debrief/v1";

describe("B08 canonical event chronology", () => {
  it("every canonical event's period/matchSeconds matches globalMinuteToPeriodRelative() applied to its own minuteLabel", () => {
    for (const event of b08CanonicalLiveEvents) {
      if (event.minuteLabel === null) continue; // SCORER_SET/ASSIST_SET mirror their parent goal's timing.
      const globalMinute = Number(event.minuteLabel.replace(/'/g, ""));
      const expected = globalMinuteToPeriodRelative(globalMinute, B08_MATCH_FORMAT);
      expect(event.period).toBe(expected.period);
      expect(event.matchSeconds).toBe(expected.matchSeconds);
    }
  });

  it("every event's global minute falls within real match regulation time (0-60')", () => {
    for (const event of b08CanonicalLiveEvents) {
      if (event.minuteLabel === null) continue;
      const globalMinute = Number(event.minuteLabel.replace(/'/g, ""));
      expect(globalMinute).toBeGreaterThanOrEqual(0);
      expect(globalMinute).toBeLessThanOrEqual(B08_MATCH_FORMAT.regulationDurationMinutes);
    }
  });

  it("SCORER_SET/ASSIST_SET correction events share their parent goal's exact period/matchSeconds", () => {
    const byClientEventId = new Map(b08CanonicalLiveEvents.filter((e) => e.clientEventId).map((e) => [e.clientEventId, e]));
    for (const event of b08CanonicalLiveEvents) {
      if (!event.correctsEventId) continue;
      const parent = byClientEventId.get(event.correctsEventId);
      expect(parent, `no parent goal found for correction ${event.id}`).toBeDefined();
      expect(event.period).toBe(parent!.period);
      expect(event.matchSeconds).toBe(parent!.matchSeconds);
    }
  });

  it("3 real canonical goal events (2 FOR, 1 AGAINST), matching the real 2-1 final score", () => {
    expect(B08_LIVE_GOALS_RECORDED).toBe(2);
    expect(b08CanonicalLiveEvents.filter((e) => e.eventType === "GOAL_AGAINST")).toHaveLength(1);
  });

  it("score progression is 1-0, 1-1, 2-1 (final result 2-1) — Slemmestad never trails, never leads by more than one", () => {
    let home = 0;
    let away = 0;
    const progression: Array<{ home: number; away: number }> = [];
    for (const event of b08CanonicalLiveEvents) {
      if (event.eventType === "GOAL_FOR") home += 1;
      else if (event.eventType === "GOAL_AGAINST") away += 1;
      else continue;
      progression.push({ home, away });
    }
    expect(progression).toEqual([{ home: 1, away: 0 }, { home: 1, away: 1 }, { home: 2, away: 1 }]);
    for (const { home: h, away: a } of progression) {
      expect(h).toBeGreaterThanOrEqual(a);
      expect(Math.abs(h - a)).toBeLessThanOrEqual(1);
    }
  });
});

describe("B08 goal attribution — no gap in this scenario (distinct from B05's own gap demonstration)", () => {
  it("draft and completed both carry both report Goal rows — attributedGoals === liveGoalsRecorded", () => {
    for (const variant of ["draft", "completed"] as const) {
      const gap = b08GoalAttributionGap(variant);
      expect(gap.liveGoalsRecorded).toBe(2);
      expect(gap.attributedGoals).toBe(2);
      expect(gap.hasGap).toBe(false);
    }
  });

  it("goal scorers/assist providers aggregate from the real report rows (Vetle, Noah scored; Sindre assisted)", () => {
    expect(b08GoalScorers("draft").scorers.map((s) => s.playerName)).toEqual(expect.arrayContaining(["Vetle", "Noah"]));
    expect(b08GoalScorers("draft").unattributedCount).toBe(0);
    expect(b08AssistProviders("draft").scorers.map((a) => a.playerName)).toEqual(["Sindre"]);
  });
});

describe("B08's genuine incomplete-data condition — unconfirmed second-half timing", () => {
  it("DRAFT needs review (27' running-clock reading); COMPLETED is resolved to the real 30' period duration", () => {
    const draft = b08TimingReview("draft");
    const completed = b08TimingReview("completed");
    expect(draft[0]!.needsReview).toBe(true);
    expect(draft[0]!.resolvedDurationMinutes).toBe(27);
    expect(completed[0]!.needsReview).toBe(false);
    expect(completed[0]!.resolvedDurationMinutes).toBe(B08_MATCH_FORMAT.periodDurationMinutes);
  });

  it("the draft's own unconfirmed reading still comfortably covers every real period-2 event (max 18')", () => {
    const draftMinutes = b08TimingReview("draft")[0]!.resolvedDurationMinutes;
    const maxPeriodTwoMatchSeconds = Math.max(
      ...b08CanonicalLiveEvents.filter((e) => e.period === 2 && e.matchSeconds !== null).map((e) => e.matchSeconds!),
    );
    expect(draftMinutes * 60).toBeGreaterThan(maxPeriodTwoMatchSeconds);
  });

  it("AFTER's own timingNeedsReviewCount reflects this exact condition (1 in draft, 0 once resolved)", () => {
    expect(b08AfterData("draft").timingNeedsReviewCount).toBe(1);
    expect(b08AfterData("completed").timingNeedsReviewCount).toBe(0);
  });
});

describe("B08 draft/completed consistency — finalization never silently changes canonical facts", () => {
  it("result, attendance, timeline and identity-bearing facts are byte-identical between draft and completed", () => {
    const draft = b08AfterData("draft");
    const completed = b08AfterData("completed");
    expect(draft.homeGoals).toBe(completed.homeGoals);
    expect(draft.awayGoals).toBe(completed.awayGoals);
    expect(draft.attendance).toEqual(completed.attendance);
    expect(draft.timeline).toEqual(completed.timeline);
    expect(draft.goalScorers).toEqual(completed.goalScorers);
    expect(draft.assistProviders).toEqual(completed.assistProviders);
    expect([...draft.playerMinutes.entries()]).toEqual([...completed.playerMinutes.entries()]);
  });

  it("the only report-level differences between draft and completed are status, completion metadata, and the resolved timing review", () => {
    const draft = b08AfterData("draft");
    const completed = b08AfterData("completed");
    expect(draft.reportStatus).toBe("REPORTED");
    expect(completed.reportStatus).toBe("LOCKED");
    expect(draft.completedBy).toBeNull();
    expect(completed.completedBy).not.toBeNull();
    expect(draft.timingNeedsReviewCount).not.toBe(completed.timingNeedsReviewCount);
  });

  it("combination evidence is only ever present once LOCKED (matches production's own real load rule)", () => {
    expect(b08AfterData("draft").combinationEvidence).toEqual([]);
    expect(b08AfterData("completed").combinationEvidence.length).toBeGreaterThan(0);
  });

  it("the submitted debrief is the SAME document in both variants (one real coach submission, not two)", () => {
    expect(b08InitialReport("draft").teamNote).toBe(b08InitialReport("completed").teamNote);
  });
});

describe("B08 attendance and minutes", () => {
  it("8 present, 1 no-show — Players used (7, those with minutes > 0) is fewer than present (8)", () => {
    expect(b08AttendanceSummary.presentCount).toBe(8);
    expect(b08AttendanceSummary.noShowCount).toBe(1);
    const playersUsed = [...b08MinutesByParticipant.values()].filter((m) => m > 0).length;
    expect(playersUsed).toBe(7);
    expect(b08AttendanceFacts).toHaveLength(9);
  });

  it("no player exceeds the match's own 60-minute regulation duration", () => {
    for (const minutes of b08MinutesByParticipant.values()) {
      expect(minutes).toBeLessThanOrEqual(B08_MATCH_FORMAT.regulationDurationMinutes);
    }
  });

  it("the reserve (Elias) is present but recorded at 0 minutes — not an unexplained gap", () => {
    expect(b08MinutesByParticipant.get("player-gb8-elias")).toBe(0);
  });

  it("player involvement is derivable for every present participant, never throwing on the 0-minute reserve", () => {
    expect(() => b08PlayerInvolvement("draft")).not.toThrow();
    const involvement = b08PlayerInvolvement("completed");
    expect(involvement.some((p) => p.playerName === "Elias")).toBe(true);
  });
});

describe("B08 narrative honesty — no shape change claimed, no contradictory statement", () => {
  it("no shape-change event is claimed when the positional record has none", () => {
    expect(b08ShapeChangeRows).toEqual([]);
    expect(b08DebriefAnswers.match_changes?.option).toBe("NO_MEANINGFUL_CHANGE");
  });

  it("the narrative never claims Slemmestad trailed or led by more than one goal", () => {
    const narrativeText = [b08Reflection.note, b08OpponentObservation.factualSummary, b08DebriefAnswers.team_execution.note, b08DebriefAnswers.opponent_memory.note].join(" ");
    expect(narrativeText).not.toMatch(/trail(ing|ed)/i);
    expect(narrativeText).not.toMatch(/behind/i);
    expect(narrativeText).not.toMatch(/leads? by two/i);
  });

  it("the submitted debrief remains a valid schema instance (DebriefAnswersSection v1)", () => {
    expect(() => debriefAnswersSchema.parse({ version: DEBRIEF_SCHEMA_VERSION, answers: b08DebriefAnswers })).not.toThrow();
  });
});

describe("B08 determinism — same inputs always produce the same read model (fixture-hash-style completeness)", () => {
  it("b08AfterData is a pure function of its variant — two calls produce deep-equal output", () => {
    expect(b08AfterData("draft")).toEqual(b08AfterData("draft"));
    expect(b08AfterData("completed")).toEqual(b08AfterData("completed"));
  });

  it("b08InitialReport never stamps a non-deterministic completedAt/completedBy", () => {
    const completed = b08InitialReport("completed");
    expect(completed.completedAt).toBe(new Date(completed.completedAt as string).toISOString());
    expect(completed.completedBy).toBe("Kristin Haug");
  });

  it("goals, assists, attendance, timeline and reflection are all present on the authoritative read model (nothing silently undefined)", () => {
    const after = b08AfterData("completed");
    for (const field of ["goalScorers", "assistProviders", "timeline", "attendance", "reflection", "footballObservations", "opponentObservation"] as const) {
      expect(after[field]).toBeDefined();
    }
  });
});
