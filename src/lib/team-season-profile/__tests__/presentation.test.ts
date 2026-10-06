import { describe, it, expect } from "vitest";
import { presentPattern, presentChip, shortPatternLabel, confidenceLabel, trajectoryLabel } from "@/lib/team-season-profile/presentation";
import type { TeamSeasonPattern } from "@/lib/team-season-profile/contracts";

function basePattern(overrides: Partial<TeamSeasonPattern>): TeamSeasonPattern {
  return {
    key: "p",
    family: "MATCH_RHYTHM",
    subtype: "OPENING_FIRST_HALF_FOR",
    subjects: {},
    evidenceStrength: "EMERGING",
    trajectory: "PERSISTENT",
    tone: "POSITIVE",
    firstObservedAt: null,
    lastObservedAt: null,
    approximateTiming: false,
    sample: { matches: 5 },
    metrics: { candidateGoals: 5, allGoalsInEligibleMatches: 11, candidateExposureMinutes: 42 },
    sourceRefs: [],
    ...overrides,
  };
}

const CAUSAL_WORDS = ["causes", "makes", "leads to", "responsible for", "because of", "improves", "weakens", "best combination", "worst combination"];

function assertNoCausalLanguage(text: string) {
  const lower = text.toLowerCase();
  for (const word of CAUSAL_WORDS) {
    expect(lower).not.toContain(word);
  }
}

describe("team-season-profile/presentation — confidence/trajectory labels", () => {
  it("never shows INSUFFICIENT as a badge", () => {
    expect(confidenceLabel("INSUFFICIENT")).toBe("");
    expect(confidenceLabel("EMERGING")).toBe("Emerging pattern");
    expect(confidenceLabel("ESTABLISHED")).toBe("Established pattern");
  });

  it("translates every trajectory value", () => {
    expect(trajectoryLabel("NEW")).toBe("New");
    expect(trajectoryLabel("STRENGTHENING")).toBe("Stronger recently");
    expect(trajectoryLabel("WEAKENING")).toBe("Less evident recently");
    expect(trajectoryLabel("DORMANT")).toBe("Not seen recently");
  });
});

describe("team-season-profile/presentation — presentPattern", () => {
  it("presents a match-rhythm pattern with the exact evidence-based sentence shape", () => {
    const view = presentPattern(basePattern({}));
    expect(view.title).toBe("Strong starts");
    expect(view.evidenceSentence).toContain("5 of 11 recorded goals");
    expect(view.evidenceSentence).toContain("5 matches");
    assertNoCausalLanguage(view.evidenceSentence);
  });

  it("presents a tactical theme pattern", () => {
    const view = presentPattern(
      basePattern({
        family: "TACTICAL_THEME",
        subtype: "DEFENSIVE_TRANSITION_PROBLEM",
        sample: { matches: 5, observationCount: 6, recentMatches: 3 },
        metrics: {},
      }),
    );
    expect(view.title).toBe("Defensive transition");
    expect(view.evidenceSentence).toBe("Recorded as a problem in 5 matches this season, including 3 of the last 4.");
    assertNoCausalLanguage(view.evidenceSentence);
  });

  it("presents a player goal-contribution pattern using the supplied player name and never implies ranking", () => {
    const view = presentPattern(
      basePattern({
        family: "PLAYER_CONTRIBUTION",
        subtype: "GOAL_CONTRIBUTION",
        subjects: { playerIds: ["p1"] },
        sample: { matches: 6, exposureMinutes: 173 },
        metrics: { eventCount: 4, totalMinutes: 173, totalMatches: 6, dominantPosition: "FORWARD", dominantPositionCount: 4 },
      }),
      (id) => (id === "p1" ? "Noah" : id),
    );
    expect(view.title).toBe("Noah · Goals");
    expect(view.evidenceSentence).toBe("Noah has 4 recorded goals in 173 minutes across 6 matches, mainly while used as a forward.");
    expect(view.secondarySentence).toBe("No player ranking is implied.");
    assertNoCausalLanguage(view.evidenceSentence);
  });

  it("presents a combination pattern descriptively, never as a chemistry score", () => {
    const view = presentPattern(
      basePattern({
        family: "COMBINATION",
        subtype: "CORRIDOR_RIGHT",
        subjects: { playerIds: ["p1", "p2", "p3"], corridor: "RIGHT" },
        sample: { matches: 4, exposureMinutes: 96, opponentDiversity: 3 },
        metrics: { minutesTogether: 96, matchCount: 4, goalsForWhilePresent: 6, goalsAgainstWhilePresent: 1, directGoalContributions: 3, directAssistContributions: 2, opponentDiversity: 3 },
      }),
      (id) => ({ p1: "Noah", p2: "Emil", p3: "Henrik" })[id] ?? id,
    );
    expect(view.title).toBe("Right corridor · Noah, Emil and Henrik");
    expect(view.isCombination).toBe(true);
    expect(view.evidenceSentence).toContain("96 minutes across 4 matches");
    expect(view.secondarySentence).toContain("6 goals for");
    expect(view.secondarySentence).not.toMatch(/chemistry|influence score/i);
    assertNoCausalLanguage(view.evidenceSentence + " " + (view.secondarySentence ?? ""));
  });
});

describe("team-season-profile/presentation — shortPatternLabel", () => {
  it("maps match-rhythm subtypes to the bundle's exact short chip labels", () => {
    expect(shortPatternLabel(basePattern({ subtype: "OPENING_FIRST_HALF_FOR" }))).toBe("Strong starts");
    expect(shortPatternLabel(basePattern({ subtype: "LATE_FINAL_AGAINST" }))).toBe("Late concessions");
  });

  it("produces a compact label for combination corridors", () => {
    const label = shortPatternLabel(basePattern({ family: "COMBINATION", subtype: "CORRIDOR_RIGHT" }));
    expect(label).toBe("Right-side combination");
  });

  it("never produces a label containing AI-style prose markers", () => {
    const label = shortPatternLabel(basePattern({ family: "TACTICAL_THEME", subtype: "BUILD_UP_WORKING" }));
    expect(label.length).toBeLessThan(40);
  });
});

describe("team-season-profile/presentation — presentChip", () => {
  it("pairs the short label with one evidence sentence and the confidence label", () => {
    const chip = presentChip(basePattern({}));
    expect(chip.shortLabel).toBe("Strong starts");
    expect(chip.evidenceSentence).toContain("5 of 11 recorded goals");
    expect(chip.confidenceLabel).toBe("Emerging pattern");
    assertNoCausalLanguage(chip.evidenceSentence);
  });
});
