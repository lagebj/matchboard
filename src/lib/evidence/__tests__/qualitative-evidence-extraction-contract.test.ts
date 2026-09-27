import { describe, it, expect } from "vitest";
import { safeParseExtractionResponse, validateExtractionSemantics, EXTRACTION_CONTRACT_VERSION, MAX_EXTRACTION_OBSERVATIONS } from "../qualitative-evidence-extraction-contract";

const VALID_OBSERVATION = {
  scope: "TEAM",
  playerRef: null,
  secondaryPlayerRef: null,
  phase: "PROGRESSION",
  polarity: "WORKING",
  period: "SECOND_HALF",
  statement: "Greater midfield depth improved progression.",
  explicitness: "EXPLICIT",
};

function validResponse(overrides: { observations?: unknown[] } = {}) {
  return {
    version: EXTRACTION_CONTRACT_VERSION,
    observations: overrides.observations ?? [VALID_OBSERVATION],
  };
}

describe("safeParseExtractionResponse", () => {
  it("accepts a well-formed response", () => {
    const result = safeParseExtractionResponse(validResponse());
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported version", () => {
    expect(safeParseExtractionResponse({ version: "2", observations: [] }).success).toBe(false);
  });

  it("rejects an unknown field (strict schema)", () => {
    expect(safeParseExtractionResponse({ ...validResponse(), extra: "nope" }).success).toBe(false);
  });

  it("rejects more than the max observations", () => {
    const many = Array.from({ length: MAX_EXTRACTION_OBSERVATIONS + 1 }, () => VALID_OBSERVATION);
    expect(safeParseExtractionResponse(validResponse({ observations: many })).success).toBe(false);
  });

  it("rejects a statement over the max length", () => {
    const tooLong = { ...VALID_OBSERVATION, statement: "x".repeat(501) };
    expect(safeParseExtractionResponse(validResponse({ observations: [tooLong] })).success).toBe(false);
  });

  it("accepts zero observations", () => {
    expect(safeParseExtractionResponse({ version: EXTRACTION_CONTRACT_VERSION, observations: [] }).success).toBe(true);
  });

  it("rejects an unknown enum value for phase/polarity/scope/explicitness/period", () => {
    expect(safeParseExtractionResponse(validResponse({ observations: [{ ...VALID_OBSERVATION, phase: "MIDFIELD" }] })).success).toBe(false);
  });
});

describe("validateExtractionSemantics", () => {
  it("passes for TEAM/OPPONENT scope regardless of allowed refs", () => {
    const parsed = safeParseExtractionResponse(validResponse());
    if (!parsed.success) throw new Error("fixture invalid");
    expect(validateExtractionSemantics(parsed.data, new Set())).toEqual({ valid: true });
  });

  it("rejects a PLAYER-scoped observation when no player refs were ever supplied", () => {
    const raw = validResponse({ observations: [{ scope: "PLAYER", playerRef: "P01", secondaryPlayerRef: null, phase: "GENERAL", polarity: "NEUTRAL", period: null, statement: "Played well.", explicitness: "EXPLICIT" }] });
    const parsed = safeParseExtractionResponse(raw);
    if (!parsed.success) throw new Error("fixture invalid");
    const result = validateExtractionSemantics(parsed.data, new Set());
    expect(result.valid).toBe(false);
  });

  it("accepts a PLAYER-scoped observation whose playerRef is in the allowed set", () => {
    const raw = validResponse({ observations: [{ scope: "PLAYER", playerRef: "P01", secondaryPlayerRef: null, phase: "GENERAL", polarity: "NEUTRAL", period: null, statement: "Played well.", explicitness: "EXPLICIT" }] });
    const parsed = safeParseExtractionResponse(raw);
    if (!parsed.success) throw new Error("fixture invalid");
    expect(validateExtractionSemantics(parsed.data, new Set(["P01"])).valid).toBe(true);
  });

  it("rejects a PAIR observation with the same player twice", () => {
    const raw = validResponse({ observations: [{ scope: "PAIR", playerRef: "P01", secondaryPlayerRef: "P01", phase: "PROGRESSION", polarity: "WORKING", period: null, statement: "Combined well.", explicitness: "EXPLICIT" }] });
    const parsed = safeParseExtractionResponse(raw);
    if (!parsed.success) throw new Error("fixture invalid");
    expect(validateExtractionSemantics(parsed.data, new Set(["P01"])).valid).toBe(false);
  });
});
