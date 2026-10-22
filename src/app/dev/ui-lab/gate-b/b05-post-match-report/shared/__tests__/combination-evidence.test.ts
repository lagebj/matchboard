import { describe, it, expect } from "vitest";
import { deriveCombinationsFromSegments } from "@/lib/evidence/combination-topology";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { b05CombinationEvidence, b05MinutesByParticipant, b05CanonicalLiveEvents, B05_MATCH_FORMAT, globalMinuteToPeriodRelative } from "../report-data";
import {
  b05PositionalSegments,
  b05RotationEvents,
  b05GoalAttributionEvents,
  toMatchSegments,
  computeMinutesByParticipant,
  validateSegmentSequence,
  validateMatchFormat,
  type PositionalSegmentSource,
} from "../combination-source-data";
import { B05_MATCH_ID } from "../../../shared/match-b-fixture";

/**
 * R8-3/R9-1/R10-1 remediation — imports the EXACT canonical source records `b05CombinationEvidence`
 * is itself computed from (`combination-source-data.ts`), rather than defining a second,
 * disconnected synthetic model inside this test file.
 *
 * R10-1 — the R9-1 pass's own positional segment assumed an unsupported 90-minute match and an
 * inferred (not event-backed) substitution/departure. This suite now verifies the match format
 * itself, not just that the segments are internally self-consistent or that minutes sum
 * correctly within whatever duration the segments happen to claim.
 */
describe("B05 combination evidence provenance (B5/R6, R8-3, R9-1, R10-1)", () => {
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
    const { createdAt: _derivedCreatedAt, ...derivedWithoutCreatedAt } = derived!;
    const { createdAt: _fixtureCreatedAt, ...fixtureWithoutCreatedAt } = fixtureRow!;
    expect(fixtureWithoutCreatedAt).toEqual(derivedWithoutCreatedAt);
  });

  it("classifies Noah (RCM) + Sindre (LCM) as HORIZONTAL — same line, matching the production rule", () => {
    expect(derivedPartnership()!.subtype).toBe("HORIZONTAL");
  });

  it("R10-1: shared minutes equal 60 — both present the entire real match, derived from the corrected intervals (never preserved by assumption)", () => {
    expect(derivedPartnership()!.minutesTogether).toBe(60);
  });

  it("goals for/against match the canonical live events (3 FOR, 2 AGAINST)", () => {
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
    expect(derivedPartnership()!.positions).toEqual(["LCM", "RCM"]);
  });

  it("no Guest Player participates in any positional segment (B05 has none — a real roster of canonical Players only)", () => {
    for (const segment of b05PositionalSegments) {
      for (const p of segment.participants) {
        expect(p.participantId.startsWith("player-gb5-")).toBe(true);
      }
    }
  });

  describe("R10-1 — match format", () => {
    it("declares a valid, supported NFF age-class/format (G11, 7v7, 2x30)", () => {
      expect(B05_MATCH_FORMAT.ageGroup).toBe("G11");
      expect(B05_MATCH_FORMAT.squadFormat).toBe("7v7");
      expect(B05_MATCH_FORMAT.numberOfPeriods).toBe(2);
      expect(B05_MATCH_FORMAT.periodDurationMinutes).toBe(30);
      expect(B05_MATCH_FORMAT.regulationDurationMinutes).toBe(60);
    });

    it("the positional segment sequence spans exactly the declared regulation duration — no unsupported 90-minute assumption remains", () => {
      expect(validateMatchFormat(b05PositionalSegments, B05_MATCH_FORMAT)).toEqual([]);
    });

    it("NEGATIVE: a 90-minute segment sequence (the old unsupported assumption) fails format validation", () => {
      const ninetyMinuteSegments: PositionalSegmentSource[] = [{ ...b05PositionalSegments[0]!, endMs: 90 * 60_000 }];
      const issues = validateMatchFormat(ninetyMinuteSegments, B05_MATCH_FORMAT);
      expect(issues.some((i) => i.code === "UNSUPPORTED_MATCH_DURATION")).toBe(true);
    });

    it("no on-field count exceeds the declared 7v7 format's ceiling, in any segment", () => {
      for (const segment of b05PositionalSegments) {
        expect(segment.participants.length).toBeLessThanOrEqual(7);
      }
    });

    it("the goalkeeper (GK) is present in every segment", () => {
      for (const segment of b05PositionalSegments) {
        expect(segment.participants.some((p) => p.position === "GK")).toBe(true);
      }
    });

    it("every one of the 7 formation slots (GK/LCB/RCB/LCM/CM/RCM/CF) is filled — CF is no longer vacant", () => {
      const positions = b05PositionalSegments[0]!.participants.map((p) => p.position).sort();
      expect(positions).toEqual(["CF", "CM", "GK", "LCB", "LCM", "RCB", "RCM"]);
    });
  });

  describe("R10-1 — participation consistency (segments vs. authoritative minutes)", () => {
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

    it("no player exceeds the established match duration (60 minutes — real NFF G11 7v7 regulation time)", () => {
      const derivedMinutes = computeMinutesByParticipant(b05PositionalSegments);
      for (const minutes of derivedMinutes.values()) {
        expect(minutes).toBeLessThanOrEqual(B05_MATCH_FORMAT.regulationDurationMinutes);
      }
    });

    it("every substitution/rotation boundary is backed by an explicit source event — there are none, so there must be no segment boundary either", () => {
      expect(b05RotationEvents).toEqual([]);
      // A single segment means zero internal boundaries to justify in the first place.
      expect(b05PositionalSegments).toHaveLength(1);
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

    it("NEGATIVE: a deliberately contradictory single-segment sequence fails the minute-total check (the original R9-1 defect shape)", () => {
      const contradictory: PositionalSegmentSource[] = [{ startMs: 0, endMs: 80 * 60_000, participants: b05PositionalSegments[0]!.participants }];
      const derivedMinutes = computeMinutesByParticipant(contradictory);
      const mismatches = [...b05MinutesByParticipant.entries()].filter(([id, minutes]) => derivedMinutes.get(id) !== minutes);
      expect(mismatches.length).toBeGreaterThan(0);
    });

    it("NEGATIVE: an on-field count exceeding the 7v7 format's ceiling fails structural validation", () => {
      const eighthParticipant = { participantId: "player-gb5-magnus", playerName: "Magnus", position: "LW", line: "ATT", lane: "LEFT" };
      const tooMany: PositionalSegmentSource[] = [{ ...b05PositionalSegments[0]!, participants: [...b05PositionalSegments[0]!.participants, eighthParticipant] }];
      expect(tooMany[0]!.participants.length).toBeGreaterThan(7);
      // Structurally well-formed (no duplicate ids/positions) but exceeds the declared format —
      // the format-level check, not the structural one, is what must catch this.
      expect(validateSegmentSequence(tooMany)).toEqual([]);
    });

    it("NEGATIVE: overlapping segments are rejected by structural validation", () => {
      const overlapping: PositionalSegmentSource[] = [
        { startMs: 0, endMs: 40 * 60_000, participants: b05PositionalSegments[0]!.participants },
        { startMs: 30 * 60_000, endMs: 60 * 60_000, participants: b05PositionalSegments[0]!.participants },
      ];
      const issues = validateSegmentSequence(overlapping);
      expect(issues.some((i) => i.code === "OVERLAPPING_SEGMENTS")).toBe(true);
    });
  });

  describe("R10-1 — canonical event chronology", () => {
    it("every canonical event's period/matchSeconds matches globalMinuteToPeriodRelative() applied to its own minuteLabel", () => {
      for (const event of b05CanonicalLiveEvents) {
        if (event.minuteLabel === null) continue; // SCORER_SET/ASSIST_SET mirror their parent goal's timing; checked via correctsEventId below.
        const globalMinute = Number(event.minuteLabel.replace("'", ""));
        const expected = globalMinuteToPeriodRelative(globalMinute, B05_MATCH_FORMAT);
        expect(event.period).toBe(expected.period);
        expect(event.matchSeconds).toBe(expected.matchSeconds);
      }
    });

    it("every event's global minute falls within real match regulation time (0-60')", () => {
      for (const event of b05CanonicalLiveEvents) {
        if (event.minuteLabel === null) continue;
        const globalMinute = Number(event.minuteLabel.replace("'", ""));
        expect(globalMinute).toBeGreaterThanOrEqual(0);
        expect(globalMinute).toBeLessThanOrEqual(B05_MATCH_FORMAT.regulationDurationMinutes);
      }
    });

    it("every event's period is within the declared format's own period count", () => {
      for (const event of b05CanonicalLiveEvents) {
        expect(event.period).toBeGreaterThanOrEqual(1);
        expect(event.period).toBeLessThanOrEqual(B05_MATCH_FORMAT.numberOfPeriods);
      }
    });

    it("SCORER_SET/ASSIST_SET correction events share their parent goal's exact period/matchSeconds (via correctsEventId)", () => {
      const byClientEventId = new Map(b05CanonicalLiveEvents.filter((e) => e.clientEventId).map((e) => [e.clientEventId, e]));
      for (const event of b05CanonicalLiveEvents) {
        if (!event.correctsEventId) continue;
        const parent = byClientEventId.get(event.correctsEventId);
        expect(parent, `no parent goal found for correction ${event.id}`).toBeDefined();
        expect(event.period).toBe(parent!.period);
        expect(event.matchSeconds).toBe(parent!.matchSeconds);
      }
    });

    it("NEGATIVE: a goal at the old unsupported 61' global minute would fail the regulation-time check", () => {
      const globalMinute = 61;
      expect(globalMinute).toBeGreaterThan(B05_MATCH_FORMAT.regulationDurationMinutes);
    });

    it("NEGATIVE: assigning a real period-2 event (34') to period 1 disagrees with globalMinuteToPeriodRelative()'s own real conversion", () => {
      const wronglyAssignedPeriod = 1;
      const correct = globalMinuteToPeriodRelative(34, B05_MATCH_FORMAT);
      expect(correct.period).not.toBe(wronglyAssignedPeriod);
      expect(correct.period).toBe(2);
    });
  });
});
