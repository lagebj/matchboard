import { describe, it, expect } from "vitest";
import {
  selectTodayComposition,
  buildTodayDecisionWhyContent,
  humanizeReasonCodes,
  selectTodayWeekChronologyItems,
} from "../today-composition";
import type { TodayPrimaryAction } from "../today-primary-action";
import type { CoachDecision } from "@/lib/situational/situation-types";
import type { PlanIntegritySignal } from "@/lib/selection/compute-plan-integrity";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import type { DueDecisionReviewCard } from "@/lib/assistant/types";

function coachDecision(overrides: Partial<CoachDecision> = {}): CoachDecision {
  return {
    id: "d1",
    candidateId: "c1",
    situation: "NEXT",
    horizon: "NEXT",
    visibility: "NORMAL",
    urgency: "NORMAL",
    interaction: "INFORM",
    title: "Title",
    alternatives: [],
    affectedEntities: [],
    reasonCodes: [],
    ...overrides,
  };
}

describe("today-composition — selectTodayComposition", () => {
  it("is QUIET when there is no primary action and no due review", () => {
    expect(selectTodayComposition({ kind: "NONE" }, false)).toBe("QUIET");
  });

  it("is DECISION when a primary action exists", () => {
    const action: TodayPrimaryAction = { kind: "GENERIC", decision: coachDecision() };
    expect(selectTodayComposition(action, false)).toBe("DECISION");
  });

  it("is DECISION when a due review exists even with no primary action", () => {
    expect(selectTodayComposition({ kind: "NONE" }, true)).toBe("DECISION");
  });
});

describe("today-composition — buildTodayDecisionWhyContent", () => {
  it("returns null for NONE (nothing to explain)", () => {
    expect(buildTodayDecisionWhyContent({ kind: "NONE" })).toBeNull();
  });

  it("returns null for SELECTION_DECISION (already shown inline by TodayDecisionRow)", () => {
    const action = { kind: "SELECTION_DECISION" } as unknown as TodayPrimaryAction;
    expect(buildTodayDecisionWhyContent(action)).toBeNull();
  });

  it("builds problem/why/consequence from a plan-integrity signal", () => {
    const signal: PlanIntegritySignal = {
      idempotencyKey: "k1",
      kind: "BLOCKED",
      ruleCode: "SQUAD_BELOW_MINIMUM",
      matchRoundId: "r1",
      title: "Squad below minimum",
      currentState: "Squad has 8 of 11 required players.",
      consequence: "The match cannot be played as planned.",
      classificationReason: "Fewer than the minimum accepted squad size are currently planned.",
      primaryActionLabel: "Review squad",
      primaryActionTarget: "/rounds/r1",
    };
    const content = buildTodayDecisionWhyContent({ kind: "PLAN_INTEGRITY_SIGNAL", signal });
    expect(content).toEqual({
      problem: "Squad has 8 of 11 required players.",
      why: ["Fewer than the minimum accepted squad size are currently planned."],
      consequence: "The match cannot be played as planned.",
      caveats: [],
    });
  });

  it("builds problem/why/caveats from a generic decision's reasonCodes and evidenceSupport", () => {
    const decision = coachDecision({
      summary: "Something changed.",
      reasonCodes: ["HARD_CONSEQUENCE", "MULTIPLE_ALTERNATIVES"],
      evidenceSupport: { maturity: "EMERGING", coverage: "PARTIAL", freshness: "CURRENT", changeState: "NEW", sources: [], caveats: ["Small sample."] },
    });
    const content = buildTodayDecisionWhyContent({ kind: "GENERIC", decision });
    expect(content?.problem).toBe("Something changed.");
    expect(content?.why).toEqual([
      "Leaving this unresolved could affect whether the match is playable or the squad is complete.",
      "There is more than one valid option here.",
    ]);
    expect(content?.caveats).toEqual(["Small sample."]);
  });
});

describe("today-composition — humanizeReasonCodes", () => {
  it("maps every known Rego situation reason code to a human sentence", () => {
    const codes = ["MATCH_LIVE", "MATCH_IMMINENT", "HARD_CONSEQUENCE", "REQUIRES_REVIEW"];
    const labels = humanizeReasonCodes(codes);
    expect(labels).toHaveLength(4);
    for (const label of labels) {
      expect(label).not.toMatch(/^[A-Z_]+$/); // never a raw machine code
    }
  });

  it("passes an unknown code through unchanged rather than dropping it", () => {
    expect(humanizeReasonCodes(["SOME_FUTURE_CODE"])).toEqual(["SOME_FUTURE_CODE"]);
  });

  it("deduplicates repeated labels", () => {
    expect(humanizeReasonCodes(["MATCH_LIVE", "MATCH_LIVE"])).toHaveLength(1);
  });
});

describe("today-composition — selectTodayWeekChronologyItems", () => {
  function match(id: string, kickoffDate: string): MatchPresentation {
    return {
      id,
      href: `/matches/${id}`,
      homeTeam: "Us",
      awayTeam: "Them",
      ownTeamSide: "home",
      kickoffDate,
      kickoffTime: "10:00",
      lifecycle: "planning_open",
      score: null,
      clockLabel: null,
      outcome: null,
    } as unknown as MatchPresentation;
  }

  function review(id: string, dueAt: string): DueDecisionReviewCard {
    return {
      reviewId: id,
      targetType: "TEAM_FOCUS",
      targetId: "t1",
      targetName: "Team A",
      decisionText: "Focus text",
      dueAt,
      createdAt: dueAt,
      ageDays: 1,
      targetHref: `/teams/t1`,
      label: "Team focus ready to revisit",
    };
  }

  it("merges matches and reviews in chronological order", () => {
    const items = selectTodayWeekChronologyItems({
      upcomingMatches: [match("m2", "2026-03-10"), match("m1", "2026-03-05")],
      dueDecisionReviews: [review("r1", "2026-03-07T00:00:00.000Z")],
    });
    expect(items.map((i) => i.key)).toEqual(["match:m1", "review:r1", "match:m2"]);
  });

  it("caps at 4 items by default", () => {
    const items = selectTodayWeekChronologyItems({
      upcomingMatches: Array.from({ length: 6 }, (_, i) => match(`m${i}`, `2026-03-0${i + 1}`)),
      dueDecisionReviews: [],
    });
    expect(items).toHaveLength(4);
  });

  it("returns an empty list when there is nothing this week", () => {
    expect(selectTodayWeekChronologyItems({ upcomingMatches: [], dueDecisionReviews: [] })).toEqual([]);
  });
});
