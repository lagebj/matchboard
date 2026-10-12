import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, extraction, coachNote } from "../fixtures";
import { safeParseExtractionResponse } from "@/lib/evidence/qualitative-evidence-extraction-contract";

/**
 * Independent review finding R1 (round 1): the original version of this test ("every observation
 * is a claim present in the coach's own text, not invented") only asserted statements were
 * nonempty — it would have passed even with the unsupported `period: "SECOND_HALF"` fabrication
 * the review actually found. These assertions are tied to the exact claims in `coachNote.text`,
 * not a generic nonempty check.
 *
 * Independent review finding A11-F1 (round 2): round 1's own fix left `phase: "BUILD_UP"` on the
 * SAME observation unexamined — "deeper midfield" names a position, not a phase the note actually
 * states. Fixed to `GENERAL`; see the fixture's own doc comment for the full reasoning.
 */
describe("A11-coach-text-and-parsed-evidence fixture — semantic grounding", () => {
  const composure = extraction.observations[0];
  const uncertainty = extraction.observations[1];
  const pressing = extraction.observations[2];

  it("the coach's note names no half for the composure claim — 'today' scopes it to the match, not a period", () => {
    // Guards the premise the assertion below depends on: the ONLY half-scoped clause in the note
    // is the team-pressing sentence (checked separately below); the composure sentence ends at
    // "today" with no half mentioned anywhere in it.
    const composureSentence = coachNote.text.split(".")[0];
    expect(composureSentence).toMatch(/Tobias looked composed receiving the ball in deeper midfield today/);
    expect(composureSentence).not.toMatch(/half/i);
  });

  it("Tobias's composure observation has no unsupported period — the note never scopes it to a half", () => {
    expect(composure.statement).toMatch(/composed receiving the ball in deeper midfield/);
    expect(composure.period).toBeNull();
  });

  it("Tobias's composure observation has no unsupported tactical phase — the note names a position, not a phase (A11-F1)", () => {
    // "deeper midfield" is where it happened, not which tactical phase it was; the note does not
    // say build-up, progression, or any other phase, so the extraction must fall back to GENERAL.
    expect(composure.statement).not.toMatch(/build.?up|progression|transition/i);
    expect(composure.phase).toBe("GENERAL");
  });

  it("the team's pressing observation retains its explicitly-supported second-half period", () => {
    expect(coachNote.text).toMatch(/pressed more cohesively in the second half/);
    expect(pressing.statement).toMatch(/pressed more cohesively in the second half/);
    expect(pressing.period).toBe("SECOND_HALF");
    expect(pressing.scope).toBe("TEAM");
    expect(pressing.playerRef).toBeNull();
  });

  it("uncertain positional suitability remains TENTATIVE, never resolved into a confirmed conclusion", () => {
    expect(coachNote.text).toMatch(/not fully sure it translates to a full match at RCM/);
    expect(uncertainty.explicitness).toBe("TENTATIVE");
    expect(uncertainty.polarity).toBe("UNCERTAIN");
    expect(uncertainty.statement).not.toMatch(/\bwill\b|\bconfirmed\b|\bproven\b/i);
  });

  it("every PLAYER-scoped observation resolves to Tobias, the only player explicitly named in the note", () => {
    const playerScoped = extraction.observations.filter((o) => o.scope === "PLAYER" || o.scope === "PAIR");
    expect(playerScoped.length).toBeGreaterThan(0);
    for (const obs of playerScoped) {
      expect(coachNote.text).toMatch(/Tobias/);
      expect(obs.playerRef).not.toBeNull();
    }
  });

  it("no observation introduces a claim with no basis in the note (composure, uncertainty, and pressing are the only three claims the note makes)", () => {
    expect(extraction.observations).toHaveLength(3);
    const statements = extraction.observations.map((o) => o.statement);
    expect(statements[0]).toMatch(/composed/);
    expect(statements[1]).toMatch(/full match at RCM/);
    expect(statements[2]).toMatch(/pressed more cohesively/);
  });

  it("re-validates against the real extraction response schema independently", () => {
    const result = safeParseExtractionResponse(extraction);
    expect(result.success).toBe(true);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
