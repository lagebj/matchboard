import { describe, it, expect } from "vitest";
import { DEBRIEF_STEPS, REQUIRED_DEBRIEF_STEPS, computeInitialStep, countReviewedRequiredSections, isStepComplete } from "../steps";
import { EMPTY_DEBRIEF_ANSWERS, type DebriefAnswersSection } from "../v1";

function answers(overrides: Partial<DebriefAnswersSection> = {}): DebriefAnswersSection {
  return { ...structuredClone(EMPTY_DEBRIEF_ANSWERS.answers), ...overrides };
}

describe("isStepComplete", () => {
  it("optional steps are always complete", () => {
    const a = answers();
    expect(isStepComplete("opponent_memory", a)).toBe(true);
    expect(isStepComplete("player_observations", a)).toBe(true);
    expect(isStepComplete("anything_else", a)).toBe(true);
  });

  it("team_execution is incomplete until all four rows have an explicit value", () => {
    const a = answers({ team_execution: { effort: { value: "STRONG" } } });
    expect(isStepComplete("team_execution", a)).toBe(false);
    a.team_execution = { effort: { value: "STRONG" }, teamCohesion: { value: "OK" }, positionalShape: { value: "NOT_OBSERVED" }, recoveryBehavior: { value: "OK" } };
    expect(isStepComplete("team_execution", a)).toBe(true);
  });

  it("worked/needs_attention require at least one selection, including the no-evidence option", () => {
    expect(isStepComplete("worked", answers())).toBe(false);
    expect(isStepComplete("worked", answers({ worked: { selected: ["NOTHING_TO_ADD"] } }))).toBe(true);
  });

  it("match_changes requires an explicit choice", () => {
    expect(isStepComplete("match_changes", answers())).toBe(false);
    expect(isStepComplete("match_changes", answers({ match_changes: { option: "UNSURE" } }))).toBe(true);
  });

  it("review is complete only once every required step is satisfied", () => {
    expect(isStepComplete("review", answers())).toBe(false);
  });
});

describe("countReviewedRequiredSections", () => {
  it("counts 0 for a brand-new debrief and REQUIRED_DEBRIEF_STEPS.length once everything required is answered", () => {
    expect(countReviewedRequiredSections(answers())).toBe(0);
    const fullyReviewed = answers({
      team_execution: { effort: { value: "STRONG" }, teamCohesion: { value: "OK" }, positionalShape: { value: "OK" }, recoveryBehavior: { value: "OK" } },
      worked: { selected: ["NOTHING_TO_ADD"] },
      needs_attention: { selected: ["NOTHING_TO_ADD"] },
      match_changes: { option: "NO_MEANINGFUL_CHANGE" },
    });
    expect(countReviewedRequiredSections(fullyReviewed)).toBe(REQUIRED_DEBRIEF_STEPS.length);
  });
});

describe("computeInitialStep", () => {
  it("lands on the first incomplete required step", () => {
    expect(computeInitialStep(answers())).toBe("team_execution");
    const a = answers({ team_execution: { effort: { value: "STRONG" }, teamCohesion: { value: "OK" }, positionalShape: { value: "OK" }, recoveryBehavior: { value: "OK" } } });
    expect(computeInitialStep(a)).toBe("worked");
  });

  it("lands on review once every required step is already satisfied", () => {
    const a = answers({
      team_execution: { effort: { value: "STRONG" }, teamCohesion: { value: "OK" }, positionalShape: { value: "OK" }, recoveryBehavior: { value: "OK" } },
      worked: { selected: ["NOTHING_TO_ADD"] },
      needs_attention: { selected: ["NOTHING_TO_ADD"] },
      match_changes: { option: "NO_MEANINGFUL_CHANGE" },
    });
    expect(computeInitialStep(a)).toBe("review");
  });

  it("only ever returns a real step", () => {
    for (const candidate of [answers(), answers({ worked: { selected: ["PRESSING"] } })]) {
      expect(DEBRIEF_STEPS).toContain(computeInitialStep(candidate));
    }
  });
});
