import { describe, it, expect } from "vitest";
import { buildMatchFlowChronology } from "@/lib/matches/completed-match-story";
import { chronologyReconcilesWithFinalScore } from "../chronology-reconciliation";
import { b03MatchIdentity, b03Timeline, b04MatchIdentity, b04Timeline } from "../match-b-fixture";

describe("chronologyReconcilesWithFinalScore", () => {
  it("B03: a trustworthy-but-sparse chronology (1-0) does not reconcile with the real final score (6-4)", () => {
    const chronology = buildMatchFlowChronology(b03Timeline);
    expect(chronology.trustworthy).toBe(true);
    expect(chronologyReconcilesWithFinalScore(b03MatchIdentity, chronology)).toBe(false);
  });

  it("B04: a fuller, timed chronology (4-1) reconciles with the real final score (4-1)", () => {
    const chronology = buildMatchFlowChronology(b04Timeline);
    expect(chronology.trustworthy).toBe(true);
    expect(chronologyReconcilesWithFinalScore(b04MatchIdentity, chronology)).toBe(true);
  });

  it("defers to MatchFlowPanel's own untrustworthy disclosure instead of double-disclosing", () => {
    const untrustworthyChronology: ReturnType<typeof buildMatchFlowChronology> = { trustworthy: false, points: [] };
    expect(chronologyReconcilesWithFinalScore(b03MatchIdentity, untrustworthyChronology)).toBe(true);
  });

  it("has nothing to disclose when no goals were recorded at all", () => {
    const emptyChronology: ReturnType<typeof buildMatchFlowChronology> = { trustworthy: true, points: [] };
    expect(chronologyReconcilesWithFinalScore(b03MatchIdentity, emptyChronology)).toBe(true);
  });
});
