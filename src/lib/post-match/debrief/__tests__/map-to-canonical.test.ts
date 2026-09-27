import { describe, it, expect } from "vitest";
import { mapTeamExecutionToTeamReflection, mapOpponentMemory, mapAnythingElseToReportNote, mapPlayerObservations } from "../map-to-canonical";
import { parseDebriefAnswers, DEBRIEF_SCHEMA_VERSION, type DebriefAnswersSection } from "../v1";

function answersWith(overrides: Partial<Record<string, unknown>>): DebriefAnswersSection {
  return parseDebriefAnswers({
    version: DEBRIEF_SCHEMA_VERSION,
    answers: {
      team_execution: {},
      worked: { selected: [] },
      needs_attention: { selected: [] },
      opponent_memory: {},
      player_observations: [],
      anything_else: {},
      ...overrides,
    },
  }).answers;
}

describe("mapTeamExecutionToTeamReflection (ADR-0152 §3/§4)", () => {
  it("maps STRONG/OK/NEEDS_ATTENTION through unchanged", () => {
    const answers = answersWith({
      team_execution: {
        effort: { value: "STRONG" },
        teamCohesion: { value: "OK" },
        positionalShape: { value: "NEEDS_ATTENTION" },
        recoveryBehavior: { value: "STRONG" },
        note: "Note text",
      },
    });
    expect(mapTeamExecutionToTeamReflection(answers)).toEqual({
      effort: "STRONG",
      teamCohesion: "OK",
      positionalShape: "NEEDS_ATTENTION",
      recoveryBehavior: "STRONG",
      note: "Note text",
    });
  });

  it("maps NOT_OBSERVED to null on the canonical model", () => {
    const answers = answersWith({
      team_execution: {
        effort: { value: "NOT_OBSERVED" },
        teamCohesion: { value: "NOT_OBSERVED" },
        positionalShape: { value: "NOT_OBSERVED" },
        recoveryBehavior: { value: "NOT_OBSERVED" },
      },
    });
    expect(mapTeamExecutionToTeamReflection(answers)).toEqual({
      effort: null,
      teamCohesion: null,
      positionalShape: null,
      recoveryBehavior: null,
      note: null,
    });
  });

  it("maps an unanswered row to null, same as NOT_OBSERVED", () => {
    const answers = answersWith({ team_execution: {} });
    expect(mapTeamExecutionToTeamReflection(answers).effort).toBeNull();
  });

  it("maps a blank/whitespace-only note to null, never an empty string", () => {
    const answers = answersWith({ team_execution: { note: "   " } });
    expect(mapTeamExecutionToTeamReflection(answers).note).toBeNull();
  });
});

describe("mapOpponentMemory — never silently overwrite existing distinct text (bundle §03.6)", () => {
  it("returns the new note when there is no existing summary", () => {
    const answers = answersWith({ opponent_memory: { note: "Pressed high on goal kicks." } });
    expect(mapOpponentMemory(answers, null)).toBe("Pressed high on goal kicks.");
  });

  it("preserves the existing summary unchanged when there is no new note", () => {
    const answers = answersWith({ opponent_memory: {} });
    expect(mapOpponentMemory(answers, "Existing summary.")).toBe("Existing summary.");
  });

  it("is a no-op when the new note exactly repeats the existing summary", () => {
    const answers = answersWith({ opponent_memory: { note: "Existing summary." } });
    expect(mapOpponentMemory(answers, "Existing summary.")).toBe("Existing summary.");
  });

  it("is a no-op when the existing summary already contains the new note", () => {
    const answers = answersWith({ opponent_memory: { note: "Pressed high." } });
    expect(mapOpponentMemory(answers, "Earlier note. Pressed high. Later note.")).toBe("Earlier note. Pressed high. Later note.");
  });

  it("appends distinct new text rather than replacing the existing summary", () => {
    const answers = answersWith({ opponent_memory: { note: "Space opened up behind the press." } });
    expect(mapOpponentMemory(answers, "They pressed high on goal kicks.")).toBe(
      "They pressed high on goal kicks.\n\nSpace opened up behind the press.",
    );
  });
});

describe("mapAnythingElseToReportNote", () => {
  it("maps text through, trimmed", () => {
    expect(mapAnythingElseToReportNote(answersWith({ anything_else: { note: "  Good response after conceding.  " } }))).toBe(
      "Good response after conceding.",
    );
  });

  it("maps a blank note to null", () => {
    expect(mapAnythingElseToReportNote(answersWith({ anything_else: {} }))).toBeNull();
  });
});

describe("mapPlayerObservations", () => {
  it("passes each observation through with a trimmed-or-null note", () => {
    const answers = answersWith({
      player_observations: [
        { playerId: "p1", observationCode: "SECURE_ON_BALL", direction: "POSITIVE", note: "  Composed.  " },
        { playerId: "p2", observationCode: "PASSING_EFFECTIVE", direction: "NEGATIVE" },
      ],
    });
    expect(mapPlayerObservations(answers)).toEqual([
      { playerId: "p1", observationCode: "SECURE_ON_BALL", direction: "POSITIVE", note: "Composed." },
      { playerId: "p2", observationCode: "PASSING_EFFECTIVE", direction: "NEGATIVE", note: null },
    ]);
  });
});
