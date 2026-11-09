import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { deriveCombinationsFromSegments } from "@/lib/evidence/combination-topology";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import {
  b08CombinationEvidence,
  b08PositionalSegments,
  b08GoalAttributionEvents,
  b08RotationEvents,
  b08MinutesByParticipant,
  toMatchSegments,
} from "../fixture-history";
import { B08_MATCH_ID, B08_MATCH_FORMAT } from "../fixture";

/**
 * Verifies `b08CombinationEvidence` (fixture-history.ts) IS the real
 * `deriveCombinationsFromSegments()`'s own output for B08's own canonical source records — never
 * a hand-invented value. Mirrors `b05-post-match-report/shared/__tests__/combination-evidence.test.ts`.
 */
describe("B08 combination evidence provenance", () => {
  const ref: FootballMatchRef = { kind: "LEAGUE_MATCH", matchId: B08_MATCH_ID, leagueSeasonId: "season-gate-b" };

  function derivedRows() {
    return deriveCombinationsFromSegments(toMatchSegments(b08PositionalSegments), ref, "org-gate-b", "season-gate-b", b08GoalAttributionEvents);
  }

  function derivedPartnership() {
    return derivedRows().find((r) => r.family === "PARTNERSHIP" && r.playerIds.includes("player-gb8-noah") && r.playerIds.includes("player-gb8-sindre"));
  }

  it("the fixture's exported row IS the real derivation's own output (same source records, not hand-copied)", () => {
    const derived = derivedPartnership();
    expect(derived).toBeDefined();
    const fixtureRow = b08CombinationEvidence.find((r) => r.playerIds.includes("player-gb8-noah") && r.playerIds.includes("player-gb8-sindre"));
    expect(fixtureRow).toBeDefined();
    const { createdAt: _derivedCreatedAt, ...derivedWithoutCreatedAt } = derived!;
    const { createdAt: _fixtureCreatedAt, ...fixtureWithoutCreatedAt } = fixtureRow!;
    expect(fixtureWithoutCreatedAt).toEqual(derivedWithoutCreatedAt);
  });

  it("classifies Noah (RCM) + Sindre (LCM) as HORIZONTAL — same line", () => {
    expect(derivedPartnership()!.subtype).toBe("HORIZONTAL");
  });

  it("shared minutes equal 60 — both present the entire real match", () => {
    expect(derivedPartnership()!.minutesTogether).toBe(60);
  });

  it("goals for/against match the canonical live events (2 FOR, 1 AGAINST)", () => {
    const derived = derivedPartnership()!;
    expect(derived.goalsForWhilePresent).toBe(2);
    expect(derived.goalsAgainstWhilePresent).toBe(1);
  });

  it("direct contributions reflect the real scorer/assist identities — Noah scored, Sindre assisted (a genuine direct combination, not fabricated)", () => {
    const derived = derivedPartnership()!;
    expect(derived.directGoalContributions).toBe(1);
    expect(derived.directAssistContributions).toBe(1);
  });

  it("opponentDiversity is 1 and confidence never reaches ESTABLISHED from a single match", () => {
    expect(derivedPartnership()!.opponentDiversity).toBe(1);
    expect(derivedRows().every((r) => r.confidence !== "ESTABLISHED")).toBe(true);
  });

  it("positions are reported in the real function's own sorted order, never hand-arranged", () => {
    expect(derivedPartnership()!.positions).toEqual(["LCM", "RCM"]);
  });

  it("segment-derived minute totals agree exactly with b08MinutesByParticipant for every on-field player", () => {
    const totals = new Map<string, number>();
    for (const segment of b08PositionalSegments) {
      const durationMinutes = (segment.endMs - segment.startMs) / 60_000;
      for (const participant of segment.participants) {
        totals.set(participant.participantId, (totals.get(participant.participantId) ?? 0) + durationMinutes);
      }
    }
    for (const [participantId, minutes] of totals) {
      expect(b08MinutesByParticipant.get(participantId)).toBe(minutes);
    }
  });

  it("the segment sequence spans exactly the declared regulation duration", () => {
    const totalMs = b08PositionalSegments[b08PositionalSegments.length - 1]!.endMs - b08PositionalSegments[0]!.startMs;
    expect(totalMs / 60_000).toBe(B08_MATCH_FORMAT.regulationDurationMinutes);
  });

  it("no on-field segment exceeds the declared 7v7 format ceiling", () => {
    for (const segment of b08PositionalSegments) {
      expect(segment.participants.length).toBeLessThanOrEqual(B08_MATCH_FORMAT.maxOnFieldPlayers);
    }
  });

  it("no substitution/rotation boundary is claimed — b08RotationEvents is explicitly empty, matching the single unbroken segment", () => {
    expect(b08RotationEvents).toEqual([]);
    expect(b08PositionalSegments).toHaveLength(1);
  });

  it("every known goal scorer and assist provider is on pitch at their own event's timestamp", () => {
    const segments = toMatchSegments(b08PositionalSegments);
    for (const event of b08GoalAttributionEvents) {
      const segment = segments.find((s) => event.matchMs >= s.startMs && event.matchMs < s.endMs);
      expect(segment, `no segment covers matchMs ${event.matchMs}`).toBeDefined();
      if (event.scorerPlayerId) expect(segment!.playersOnPitch.has(event.scorerPlayerId)).toBe(true);
      if (event.assistPlayerId) expect(segment!.playersOnPitch.has(event.assistPlayerId)).toBe(true);
    }
  });

  it("the fixture-history module's combination data does not import any production database module into the client bundle", () => {
    const source = readFileSync(new URL("../fixture-history.ts", import.meta.url), "utf8");
    expect(source).toContain('import type { CombinationEvidenceRow, MatchSegment, PlayerSlot } from "@/lib/evidence/combination-topology"');
    expect(source).not.toMatch(/from ["']@\/lib\/db["']/);
    expect(source).not.toContain("PrismaClient");
  });
});
