import { describe, it, expect } from "vitest";
import {
  parseDebriefAnswers,
  safeParseDebriefAnswers,
  findDebriefReviewGaps,
  isDebriefReadyToSubmit,
  EMPTY_DEBRIEF_ANSWERS,
  DEBRIEF_SCHEMA_VERSION,
} from "../v1";

/**
 * ADR-0152 §3 / bundle §07.7 test plan "Debrief schema": valid full answer, NOT_OBSERVED,
 * NOTHING_TO_ADD, NOTHING_TO_ADD mutually exclusive, >3 themes rejected, change requiring text,
 * text limits, max five player observations, unknown question, unsupported version.
 */

// Intentionally loosely typed: several tests below assign deliberately malformed shapes to
// exercise the runtime Zod validation, which a strict inferred type would reject at compile time
// before the test ever runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fullValidAnswers(): any {
  return {
    version: DEBRIEF_SCHEMA_VERSION,
    answers: {
      team_execution: {
        effort: { value: "STRONG" },
        teamCohesion: { value: "OK" },
        positionalShape: { value: "NEEDS_ATTENTION" },
        recoveryBehavior: { value: "NOT_OBSERVED" },
        note: "Good energy after the break.",
      },
      worked: { selected: ["PRESSING", "BUILD_UP"], comment: "Won the ball high twice." },
      needs_attention: { selected: ["DEFENSIVE_TRANSITION"], comment: "Slow to recover centrally." },
      match_changes: { option: "WE_CHANGED", description: "Moved a midfielder higher after 25 minutes.", period: "First half" },
      opponent_memory: { note: "Pressed high on goal kicks." },
      player_observations: [{ playerId: "p1", observationCode: "SECURE_ON_BALL", direction: "POSITIVE", note: "Composed under pressure." }],
      anything_else: { note: "Good response after conceding." },
    },
  };
}

describe("debrief v1 schema (ADR-0152 §3)", () => {
  it("accepts a fully answered debrief", () => {
    expect(() => parseDebriefAnswers(fullValidAnswers())).not.toThrow();
  });

  it("accepts NOT_OBSERVED for a team-execution row", () => {
    const answers = fullValidAnswers();
    answers.answers.team_execution.effort = { value: "NOT_OBSERVED" };
    expect(() => parseDebriefAnswers(answers)).not.toThrow();
  });

  it("accepts NOTHING_TO_ADD alone for worked/needs_attention", () => {
    const answers = fullValidAnswers();
    answers.answers.worked = { selected: ["NOTHING_TO_ADD"] };
    answers.answers.needs_attention = { selected: ["NOTHING_TO_ADD"] };
    expect(() => parseDebriefAnswers(answers)).not.toThrow();
  });

  it("rejects NOTHING_TO_ADD combined with another theme", () => {
    const answers = fullValidAnswers();
    answers.answers.worked = { selected: ["NOTHING_TO_ADD", "PRESSING"] };
    expect(safeParseDebriefAnswers(answers).success).toBe(false);
  });

  it("rejects more than three selected themes", () => {
    const answers = fullValidAnswers();
    answers.answers.worked = { selected: ["BUILD_UP", "PROGRESSION", "PRESSING", "SET_PLAYS"] };
    expect(safeParseDebriefAnswers(answers).success).toBe(false);
  });

  it("requires description text for WE_CHANGED/OPPONENT_CHANGED/BOTH_CHANGED", () => {
    for (const option of ["WE_CHANGED", "OPPONENT_CHANGED", "BOTH_CHANGED"] as const) {
      const answers = fullValidAnswers();
      answers.answers.match_changes = { option };
      expect(safeParseDebriefAnswers(answers).success, option).toBe(false);
    }
  });

  it("does not require description text for NO_MEANINGFUL_CHANGE or UNSURE", () => {
    for (const option of ["NO_MEANINGFUL_CHANGE", "UNSURE"] as const) {
      const answers = fullValidAnswers();
      answers.answers.match_changes = { option };
      expect(safeParseDebriefAnswers(answers).success, option).toBe(true);
    }
  });

  it("enforces the 2,000-character limit on long-text fields", () => {
    const answers = fullValidAnswers();
    answers.answers.anything_else = { note: "x".repeat(2001) };
    expect(safeParseDebriefAnswers(answers).success).toBe(false);
  });

  it("enforces the 500-character limit on a player-observation note", () => {
    const answers = fullValidAnswers();
    answers.answers.player_observations = [{ playerId: "p1", observationCode: "SECURE_ON_BALL", direction: "POSITIVE", note: "x".repeat(501) }];
    expect(safeParseDebriefAnswers(answers).success).toBe(false);
  });

  it("rejects more than five player observations", () => {
    const answers = fullValidAnswers();
    answers.answers.player_observations = Array.from({ length: 6 }, (_, i) => ({
      playerId: `p${i}`,
      observationCode: "SECURE_ON_BALL",
      direction: "POSITIVE" as const,
    }));
    expect(safeParseDebriefAnswers(answers).success).toBe(false);
  });

  it("rejects an unknown question id", () => {
    const answers = fullValidAnswers() as unknown as { answers: Record<string, unknown> };
    answers.answers.some_future_question = { value: "X" };
    expect(safeParseDebriefAnswers(answers).success).toBe(false);
  });

  it("rejects an unsupported schema version", () => {
    const answers = { ...fullValidAnswers(), version: 2 };
    expect(safeParseDebriefAnswers(answers).success).toBe(false);
  });

  it("accepts the empty starting-point answers (nothing reviewed yet)", () => {
    expect(() => parseDebriefAnswers(EMPTY_DEBRIEF_ANSWERS)).not.toThrow();
  });
});

describe("findDebriefReviewGaps / isDebriefReadyToSubmit (ADR-0152 §3.6)", () => {
  it("reports every gap when nothing has been reviewed", () => {
    expect(findDebriefReviewGaps(EMPTY_DEBRIEF_ANSWERS.answers)).toEqual(["team_execution", "worked", "needs_attention", "match_changes"]);
    expect(isDebriefReadyToSubmit(EMPTY_DEBRIEF_ANSWERS.answers)).toBe(false);
  });

  it("is ready once every required section has an explicit answer, including no-evidence choices", () => {
    const answers = parseDebriefAnswers(fullValidAnswers()).answers;
    expect(findDebriefReviewGaps(answers)).toEqual([]);
    expect(isDebriefReadyToSubmit(answers)).toBe(true);
  });

  it("a no-evidence choice on every required row still counts as fully reviewed", () => {
    const answers = parseDebriefAnswers({
      version: DEBRIEF_SCHEMA_VERSION,
      answers: {
        team_execution: {
          effort: { value: "NOT_OBSERVED" },
          teamCohesion: { value: "NOT_OBSERVED" },
          positionalShape: { value: "NOT_OBSERVED" },
          recoveryBehavior: { value: "NOT_OBSERVED" },
        },
        worked: { selected: ["NOTHING_TO_ADD"] },
        needs_attention: { selected: ["NOTHING_TO_ADD"] },
        match_changes: { option: "NO_MEANINGFUL_CHANGE" },
        opponent_memory: {},
        player_observations: [],
        anything_else: {},
      },
    }).answers;
    expect(isDebriefReadyToSubmit(answers)).toBe(true);
  });

  it("flags a single missing team-execution row even when the other three are answered", () => {
    const answers = parseDebriefAnswers({
      version: DEBRIEF_SCHEMA_VERSION,
      answers: {
        team_execution: {
          effort: { value: "STRONG" },
          teamCohesion: { value: "STRONG" },
          positionalShape: { value: "STRONG" },
          // recoveryBehavior intentionally omitted
        },
        worked: { selected: ["NOTHING_TO_ADD"] },
        needs_attention: { selected: ["NOTHING_TO_ADD"] },
        match_changes: { option: "NO_MEANINGFUL_CHANGE" },
        opponent_memory: {},
        player_observations: [],
        anything_else: {},
      },
    }).answers;
    expect(findDebriefReviewGaps(answers)).toEqual(["team_execution"]);
  });
});
