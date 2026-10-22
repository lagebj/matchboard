import { describe, it, expect } from "vitest";
import { deriveCombinationsFromSegments } from "@/lib/evidence/combination-topology";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { b05CombinationEvidence } from "../report-data";
import { b05PositionalSegment, b05GoalAttributionEvents, toMatchSegments } from "../combination-source-data";
import { B05_MATCH_ID } from "../../../shared/match-b-fixture";

/**
 * R8-3 remediation — imports the EXACT canonical source records `b05CombinationEvidence` is
 * itself computed from (`combination-source-data.ts`), rather than defining a second,
 * disconnected synthetic model inside this test file. B5/R6 ("apply the same provenance
 * standards to the B05 combination row where needed") — verified against the real, unmodified
 * `deriveCombinationsFromSegments()`. Noah plays RCM and Sindre plays LCM — both `MIDFIELDER` ->
 * the SAME line (`"MID"`), so `HORIZONTAL` is the correct real derivation here (unlike B06
 * Event · After's CF+LCM pair, which is `VERTICAL` — see
 * `b06-league-event-parity/event/after/__tests__/combination-evidence.test.ts`).
 */
describe("B05 combination evidence provenance (B5/R6, R8-3)", () => {
  const ref: FootballMatchRef = { kind: "LEAGUE_MATCH", matchId: B05_MATCH_ID, leagueSeasonId: "season-gate-b" };

  function derivedPartnership() {
    const rows = deriveCombinationsFromSegments(toMatchSegments(b05PositionalSegment), ref, "org-gate-b", "season-gate-b", b05GoalAttributionEvents);
    return rows.find((r) => r.family === "PARTNERSHIP" && r.playerIds.includes("player-gb5-noah") && r.playerIds.includes("player-gb5-sindre"));
  }

  it("the fixture's exported row IS the real derivation's own output (same source records, not a hand-copied value)", () => {
    const derived = derivedPartnership();
    expect(derived).toBeDefined();

    const fixtureRow = b05CombinationEvidence.find((r) => r.playerIds.includes("player-gb5-noah") && r.playerIds.includes("player-gb5-sindre"));
    expect(fixtureRow).toBeDefined();
    // Every field except `createdAt` (display-only, overridden to the fixed completion moment —
    // see report-data.ts's own doc comment) must match byte-for-byte.
    const { createdAt: _derivedCreatedAt, ...derivedWithoutCreatedAt } = derived!;
    const { createdAt: _fixtureCreatedAt, ...fixtureWithoutCreatedAt } = fixtureRow!;
    expect(fixtureWithoutCreatedAt).toEqual(derivedWithoutCreatedAt);
  });

  it("classifies Noah (RCM) + Sindre (LCM) as HORIZONTAL — same line, matching the production rule", () => {
    expect(derivedPartnership()!.subtype).toBe("HORIZONTAL");
  });

  it("shared minutes equal the interval-derived duration (the one 80-minute segment both are present for)", () => {
    expect(derivedPartnership()!.minutesTogether).toBe(80);
  });

  it("goals for/against match the canonical live events (3 FOR, 2 AGAINST) within the segment", () => {
    const derived = derivedPartnership()!;
    expect(derived.goalsForWhilePresent).toBe(3);
    expect(derived.goalsAgainstWhilePresent).toBe(2);
  });

  it("direct contributions match recorded identities — Noah and Sindre each scored once; Vetle's assist is not fabricated as theirs", () => {
    const derived = derivedPartnership()!;
    expect(derived.directGoalContributions).toBe(2);
    expect(derived.directAssistContributions).toBe(0);
  });

  it("opponentDiversity is always 1 for per-match evidence", () => {
    expect(derivedPartnership()!.opponentDiversity).toBe(1);
  });

  it("never derives ESTABLISHED confidence from a single match (deriveConfidence requires matchCount >= 3)", () => {
    const rows = deriveCombinationsFromSegments(toMatchSegments(b05PositionalSegment), ref, "org-gate-b", "season-gate-b", b05GoalAttributionEvents);
    expect(rows.every((r) => r.confidence !== "ESTABLISHED")).toBe(true);
  });

  it("positions are reported in the real function's own sorted order, never a hand-arranged literal", () => {
    // The real deriveCombinationsFromSegments sorts `positions` lexicographically — "LCM" before
    // "RCM" — not the display order a hand-written fixture might have chosen.
    expect(derivedPartnership()!.positions).toEqual(["LCM", "RCM"]);
  });

  it("no Guest Player participates in this positional segment (B05 has none — a real roster of canonical Players only)", () => {
    const participantIds = b05PositionalSegment.participants.map((p) => p.participantId);
    expect(participantIds.every((id) => id.startsWith("player-gb5-"))).toBe(true);
  });
});
