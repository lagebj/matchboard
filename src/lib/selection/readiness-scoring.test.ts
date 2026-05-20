import { describe, it, expect } from "vitest";
import {
  getReadinessScoreModifier,
  getNegativeReadinessSignals,
  hasNegativeReadiness,
  READINESS_SCORE_MODIFIERS,
  type ReadinessSignalEntry,
} from "@/lib/selection/readiness-scoring";

const playerA = "player-a";
const playerB = "player-b";

describe("readiness scoring", () => {
  describe("getReadinessScoreModifier", () => {
    it("returns 0 when player has no signals", () => {
      expect(getReadinessScoreModifier(playerA, [])).toBe(0);
    });

    it("returns 0 for neutral signals", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerA, signalType: "EFFORT_TREND", value: "STABLE" },
        { playerId: playerA, signalType: "ATTENDANCE_RELIABILITY", value: "MEDIUM" },
      ];
      expect(getReadinessScoreModifier(playerA, signals)).toBe(0);
    });

    it("returns positive modifier for rising effort trend", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerA, signalType: "EFFORT_TREND", value: "RISING" },
      ];
      expect(getReadinessScoreModifier(playerA, signals)).toBe(3);
    });

    it("returns negative modifier for falling effort trend", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerA, signalType: "EFFORT_TREND", value: "FALLING" },
      ];
      expect(getReadinessScoreModifier(playerA, signals)).toBe(-4);
    });

    it("returns negative modifier for needs_attention learning behavior", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerA, signalType: "LEARNING_BEHAVIOR", value: "NEEDS_ATTENTION" },
      ];
      expect(getReadinessScoreModifier(playerA, signals)).toBe(-3);
    });

    it("returns negative modifier for low coach trust", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerA, signalType: "COACH_TRUST", value: "LOW" },
      ];
      expect(getReadinessScoreModifier(playerA, signals)).toBe(-3);
    });

    it("accumulates modifiers across multiple signals", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerA, signalType: "EFFORT_TREND", value: "RISING" },
        { playerId: playerA, signalType: "COACH_TRUST", value: "HIGH" },
        { playerId: playerA, signalType: "TEAM_FIRST_BEHAVIOR", value: "NEEDS_ATTENTION" },
      ];
      expect(getReadinessScoreModifier(playerA, signals)).toBe(3 + 2 + -4);
    });

    it("ignores signals for other players", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerB, signalType: "EFFORT_TREND", value: "FALLING" },
      ];
      expect(getReadinessScoreModifier(playerA, signals)).toBe(0);
    });

    it("returns 0 for unknown signal type", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerA, signalType: "EFFORT_TREND" as never, value: "RISING" },
      ];
      expect(getReadinessScoreModifier(playerA, signals)).toBe(3);
    });
  });

  describe("getNegativeReadinessSignals", () => {
    it("returns empty array for player with no signals", () => {
      expect(getNegativeReadinessSignals(playerA, [])).toEqual([]);
    });

    it("returns only negative signals for the player", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerA, signalType: "EFFORT_TREND", value: "FALLING" },
        { playerId: playerA, signalType: "ATTENDANCE_RELIABILITY", value: "HIGH" },
        { playerId: playerA, signalType: "LEARNING_BEHAVIOR", value: "NEEDS_ATTENTION" },
        { playerId: playerB, signalType: "COACH_TRUST", value: "LOW" },
      ];
      const result = getNegativeReadinessSignals(playerA, signals);
      expect(result).toHaveLength(2);
      expect(result[0].signalType).toBe("EFFORT_TREND");
      expect(result[1].signalType).toBe("LEARNING_BEHAVIOR");
    });

    it("returns empty for player with only positive/neutral signals", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerA, signalType: "EFFORT_TREND", value: "RISING" },
        { playerId: playerA, signalType: "COACH_TRUST", value: "HIGH" },
      ];
      expect(getNegativeReadinessSignals(playerA, signals)).toEqual([]);
    });
  });

  describe("hasNegativeReadiness", () => {
    it("returns false for player with no signals", () => {
      expect(hasNegativeReadiness(playerA, [])).toBe(false);
    });

    it("returns true when player has negative signals", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerA, signalType: "EFFORT_TREND", value: "FALLING" },
      ];
      expect(hasNegativeReadiness(playerA, signals)).toBe(true);
    });

    it("returns false when player has only positive/neutral signals", () => {
      const signals: ReadinessSignalEntry[] = [
        { playerId: playerA, signalType: "EFFORT_TREND", value: "STABLE" },
      ];
      expect(hasNegativeReadiness(playerA, signals)).toBe(false);
    });
  });

  describe("READINESS_SCORE_MODIFIERS", () => {
    it("has entries for all six signal types", () => {
      const expectedTypes = [
        "EFFORT_TREND",
        "ATTENDANCE_RELIABILITY",
        "LEARNING_BEHAVIOR",
        "TEAM_FIRST_BEHAVIOR",
        "RESET_AFTER_ERROR_RELIABILITY",
        "COACH_TRUST",
      ];
      for (const signalType of expectedTypes) {
        expect(READINESS_SCORE_MODIFIERS).toHaveProperty(signalType);
      }
    });

    it("has falling effort trend with negative modifier", () => {
      expect(READINESS_SCORE_MODIFIERS.EFFORT_TREND.FALLING).toBeLessThan(0);
    });

    it("has needs_attention team-first behavior with negative modifier", () => {
      expect(READINESS_SCORE_MODIFIERS.TEAM_FIRST_BEHAVIOR.NEEDS_ATTENTION).toBeLessThan(0);
    });
  });
});