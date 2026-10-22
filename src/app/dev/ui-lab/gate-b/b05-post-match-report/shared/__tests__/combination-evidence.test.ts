import { describe, it, expect } from "vitest";
import { deriveCombinationsFromSegments } from "@/lib/evidence/combination-topology";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { b05CombinationEvidence, b05MinutesByParticipant } from "../report-data";
import {
  b05PositionalSegments,
  b05GoalAttributionEvents,
  toMatchSegments,
  computeMinutesByParticipant,
  validateSegmentSequence,
  type PositionalSegmentSource,
} from "../combination-source-data";
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
 *
 * R9-1 — adds a dedicated participation-consistency suite: the positional segments must agree
 * with `b05MinutesByParticipant` (report-data.ts), not merely be internally self-consistent
 * (that was the original R9-1 defect — the segment was its own source of truth, never checked
 * against the fixture's own pre-existing minute records).
 */
describe("B05 combination evidence provenance (B5/R6, R8-3, R9-1)", () => {
  const ref: FootballMatchRef = { kind: "LEAGUE_MATCH", matchId: B05_MATCH_ID, leagueSeasonId: "season-gate-b" };

  function derivedRows() {
    return deriveCombinationsFromSegments(toMatchSegments(b05PositionalSegments), ref, "org-gate-b", "season-gate-b", b05GoalAttributionEvents);
  }

  function derivedPartnership() {
    return derivedRows().find((r) => r.family === "PARTNERSHIP" && r.playerIds.includes("player-gb5-noah") && r.playerIds.includes("player-gb5-sindre"));
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

  it("R9-1: shared minutes equal 83 (Noah's own real departure time), not the old unsupported 80", () => {
    expect(derivedPartnership()!.minutesTogether).toBe(83);
  });

  it("goals for/against match the canonical live events (3 FOR, 2 AGAINST) — all five events happen before either substitution", () => {
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
    expect(derivedRows().every((r) => r.confidence !== "ESTABLISHED")).toBe(true);
  });

  it("positions are reported in the real function's own sorted order, never a hand-arranged literal", () => {
    // The real deriveCombinationsFromSegments sorts `positions` lexicographically — "LCM" before
    // "RCM" — not the display order a hand-written fixture might have chosen.
    expect(derivedPartnership()!.positions).toEqual(["LCM", "RCM"]);
  });

  it("no Guest Player participates in any positional segment (B05 has none — a real roster of canonical Players only)", () => {
    for (const segment of b05PositionalSegments) {
      for (const p of segment.participants) {
        expect(p.participantId.startsWith("player-gb5-")).toBe(true);
      }
    }
  });

  describe("R9-1 — participation consistency (segments vs. authoritative minutes)", () => {
    it("every positional segment has valid (positive, chronological, non-overlapping) boundaries", () => {
      expect(validateSegmentSequence(b05PositionalSegments)).toEqual([]);
    });

    it("no player occupies two positions, and no position is double-booked, within any one segment", () => {
      for (const segment of b05PositionalSegments) {
        const ids = segment.participants.map((p) => p.participantId);
        expect(new Set(ids).size).toBe(ids.length);
        const positions = segment.participants.map((p) => p.position);
        expect(new Set(positions).size).toBe(positions.length);
      }
    });

    it("segment-derived minute totals agree EXACTLY with b05MinutesByParticipant (report-data.ts) for every tracked player", () => {
      const derivedMinutes = computeMinutesByParticipant(b05PositionalSegments);
      for (const [participantId, authoritativeMinutes] of b05MinutesByParticipant) {
        expect(derivedMinutes.get(participantId)).toBe(authoritativeMinutes);
      }
    });

    it("no segment-derived total mentions a player absent from b05MinutesByParticipant, and vice versa", () => {
      const derivedMinutes = computeMinutesByParticipant(b05PositionalSegments);
      expect([...derivedMinutes.keys()].sort()).toEqual([...b05MinutesByParticipant.keys()].sort());
    });

    it("no player exceeds the established match duration (90 minutes — two real 45' halves per b05TimingReview)", () => {
      const derivedMinutes = computeMinutesByParticipant(b05PositionalSegments);
      for (const minutes of derivedMinutes.values()) {
        expect(minutes).toBeLessThanOrEqual(90);
      }
      const totalDurationMs = b05PositionalSegments[b05PositionalSegments.length - 1]!.endMs - b05PositionalSegments[0]!.startMs;
      expect(totalDurationMs / 60_000).toBe(90);
    });

    it("on-field counts never exceed the 7-a-side format's own 7-player ceiling", () => {
      for (const segment of b05PositionalSegments) {
        expect(segment.participants.length).toBeLessThanOrEqual(7);
      }
    });

    it("every known goal scorer and assist provider is present (on pitch) at their own event's timestamp", () => {
      const segments = toMatchSegments(b05PositionalSegments);
      for (const event of b05GoalAttributionEvents) {
        const segment = segments.find((s) => event.matchMs >= s.startMs && event.matchMs < s.endMs);
        expect(segment, `no segment covers matchMs ${event.matchMs}`).toBeDefined();
        if (event.scorerPlayerId) {
          expect(segment!.playersOnPitch.has(event.scorerPlayerId), `scorer ${event.scorerPlayerId} not on pitch at ${event.matchMs}`).toBe(true);
        }
        if (event.assistPlayerId) {
          expect(segment!.playersOnPitch.has(event.assistPlayerId), `assist provider ${event.assistPlayerId} not on pitch at ${event.matchMs}`).toBe(true);
        }
      }
    });

    it("draft and completed fixtures import the SAME positional segments and goal-attribution events (one coherent match history)", async () => {
      const draftFixtures = await import("../../draft/fixtures");
      const completedFixtures = await import("../../completed/fixtures");
      expect(draftFixtures.rawRecordsForHash.combinationPositionalSegments).toBe(b05PositionalSegments);
      expect(completedFixtures.rawRecordsForHash.combinationPositionalSegments).toBe(b05PositionalSegments);
      expect(draftFixtures.rawRecordsForHash.combinationGoalAttributionEvents).toBe(b05GoalAttributionEvents);
      expect(completedFixtures.rawRecordsForHash.combinationGoalAttributionEvents).toBe(b05GoalAttributionEvents);
    });

    it("NEGATIVE: a deliberately contradictory segment sequence fails validation (ensures this defect class cannot return unnoticed)", () => {
      const contradictory: PositionalSegmentSource[] = [
        {
          startMs: 0,
          endMs: 80 * 60_000,
          participants: b05PositionalSegments[0]!.participants, // claims everyone present for 80' uniformly
        },
      ];
      // Structural validation alone doesn't catch this (one well-formed segment) — the real
      // defect was a MINUTE-TOTAL mismatch, so assert that check specifically fails here, the
      // same way it would have caught the original R9-1 defect had it existed before this fix.
      const derivedMinutes = computeMinutesByParticipant(contradictory);
      const mismatches = [...b05MinutesByParticipant.entries()].filter(([id, minutes]) => derivedMinutes.get(id) !== minutes);
      expect(mismatches.length).toBeGreaterThan(0);
      expect(mismatches.map(([id]) => id)).toEqual(expect.arrayContaining(["player-gb5-kasper", "player-gb5-elias", "player-gb5-noah"]));

      // Also exercise a genuinely structurally-invalid sequence (overlapping segments).
      const overlapping: PositionalSegmentSource[] = [
        { startMs: 0, endMs: 70 * 60_000, participants: b05PositionalSegments[0]!.participants },
        { startMs: 60 * 60_000, endMs: 90 * 60_000, participants: b05PositionalSegments[1]!.participants },
      ];
      const issues = validateSegmentSequence(overlapping);
      expect(issues.some((i) => i.code === "OVERLAPPING_SEGMENTS")).toBe(true);
    });
  });
});
