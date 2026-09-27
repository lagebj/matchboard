import { describe, it, expect } from "vitest";
import {
  buildWorkedObservations,
  buildNeedsAttentionObservations,
  buildChangeObservations,
  buildOpponentMemoryObservations,
  normalizeSourceText,
  workedFingerprint,
} from "../map-to-qualitative-evidence";
import { EMPTY_DEBRIEF_ANSWERS, type DebriefAnswersSection } from "../v1";

function answers(overrides: Partial<DebriefAnswersSection> = {}): DebriefAnswersSection {
  return { ...structuredClone(EMPTY_DEBRIEF_ANSWERS.answers), ...overrides };
}

describe("normalizeSourceText", () => {
  it("trims, converts CRLF to LF, and trims trailing whitespace per line, preserving case/punctuation", () => {
    expect(normalizeSourceText("  Hello, World!  \r\nLine two.   \r\n  ")).toBe("Hello, World!\nLine two.");
  });

  it("returns an empty string for null/undefined/blank input", () => {
    expect(normalizeSourceText(null)).toBe("");
    expect(normalizeSourceText(undefined)).toBe("");
    expect(normalizeSourceText("   ")).toBe("");
  });
});

describe("buildWorkedObservations", () => {
  it("creates one TEAM/WORKING observation per selected theme, excluding NOTHING_TO_ADD", () => {
    const result = buildWorkedObservations(answers({ worked: { selected: ["PRESSING", "SET_PLAYS"], comment: "Won it back high twice." } }));
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ scope: "TEAM", phase: "PRESSING", polarity: "WORKING", statement: "Won it back high twice." });
    expect(result[1]).toMatchObject({ phase: "SET_PLAYS", polarity: "WORKING", statement: "Won it back high twice." });
  });

  it("uses a product-generated wrapper statement when there is no comment", () => {
    const result = buildWorkedObservations(answers({ worked: { selected: ["PRESSING"] } }));
    expect(result).toEqual([{ scope: "TEAM", phase: "PRESSING", polarity: "WORKING", statement: "Coach marked Pressing as working." }]);
  });

  it("produces nothing for NOTHING_TO_ADD", () => {
    expect(buildWorkedObservations(answers({ worked: { selected: ["NOTHING_TO_ADD"] } }))).toEqual([]);
  });
});

describe("buildNeedsAttentionObservations", () => {
  it("creates TEAM/PROBLEM observations with the needs-attention wrapper text", () => {
    const result = buildNeedsAttentionObservations(answers({ needs_attention: { selected: ["DEFENSIVE_SHAPE"] } }));
    expect(result).toEqual([{ scope: "TEAM", phase: "DEFENSIVE_SHAPE", polarity: "PROBLEM", statement: "Coach marked Defensive shape as needing attention." }]);
  });
});

describe("buildChangeObservations", () => {
  it("maps WE_CHANGED to a TEAM/GENERAL/NEUTRAL observation using the coach's description", () => {
    const result = buildChangeObservations(answers({ match_changes: { option: "WE_CHANGED", description: "Pushed the fullbacks higher after halftime." } }));
    expect(result).toEqual([{ scope: "TEAM", phase: "GENERAL", polarity: "NEUTRAL", statement: "Pushed the fullbacks higher after halftime." }]);
  });

  it("maps OPPONENT_CHANGED to OPPONENT scope", () => {
    const result = buildChangeObservations(answers({ match_changes: { option: "OPPONENT_CHANGED", description: "They dropped to a back five." } }));
    expect(result).toEqual([{ scope: "OPPONENT", phase: "GENERAL", polarity: "NEUTRAL", statement: "They dropped to a back five." }]);
  });

  it("produces nothing for NO_MEANINGFUL_CHANGE, UNSURE, BOTH_CHANGED (AI_STRUCTURED), or no answer at all", () => {
    expect(buildChangeObservations(answers({ match_changes: { option: "NO_MEANINGFUL_CHANGE" } }))).toEqual([]);
    expect(buildChangeObservations(answers({ match_changes: { option: "UNSURE" } }))).toEqual([]);
    expect(buildChangeObservations(answers({ match_changes: { option: "BOTH_CHANGED", description: "Both sides changed shape." } }))).toEqual([]);
    expect(buildChangeObservations(answers())).toEqual([]);
  });
});

describe("buildOpponentMemoryObservations", () => {
  it("maps a non-empty note to an OPPONENT/GENERAL/NEUTRAL observation", () => {
    expect(buildOpponentMemoryObservations(answers({ opponent_memory: { note: "Pressed high on goal kicks." } }))).toEqual([
      { scope: "OPPONENT", phase: "GENERAL", polarity: "NEUTRAL", statement: "Pressed high on goal kicks." },
    ]);
  });

  it("produces nothing when there is no note", () => {
    expect(buildOpponentMemoryObservations(answers())).toEqual([]);
  });
});

describe("workedFingerprint", () => {
  it("changes when the selection or comment changes, and is stable under reordering", () => {
    const a = workedFingerprint(answers({ worked: { selected: ["PRESSING", "SET_PLAYS"] } }), 1);
    const b = workedFingerprint(answers({ worked: { selected: ["SET_PLAYS", "PRESSING"] } }), 1);
    const c = workedFingerprint(answers({ worked: { selected: ["PRESSING"] } }), 1);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("changes when the schema version changes, even for identical answers", () => {
    const v1 = workedFingerprint(answers({ worked: { selected: ["PRESSING"] } }), 1);
    const v2 = workedFingerprint(answers({ worked: { selected: ["PRESSING"] } }), 2);
    expect(v1).not.toEqual(v2);
  });
});
