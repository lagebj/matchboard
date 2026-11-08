import { describe, it, expect } from "vitest";
import {
  B08_MATCH_ID,
  B08_REPORT_ID,
  B08_OPPONENT_NAME,
  B08_KICKOFF_AT,
  B08_BEFORE_NOW,
  B08_LIVE_NOW,
  B08_AFTER_REFERENCE_AT,
  B08_DRAFT_REFERENCE_AT,
  B08_COMPLETED_AT,
  B08_MATCH_FORMAT,
  globalMinuteToPeriodRelative,
  b08Squad,
  B08_LINEUP_STARTER_SLOTS,
  b08BeforeIdentity,
  b08LiveIdentity,
  b08AfterIdentity,
} from "../fixture";
import { MATCH_B_TEAM_NAME } from "../../../shared/match-b-fixture";

describe("B08 shared fixture identity", () => {
  it("declares a valid, supported NFF age-class/format (G11, 7v7, 2x30) — same authoritative format as B05", () => {
    expect(B08_MATCH_FORMAT.ageGroup).toBe("G11");
    expect(B08_MATCH_FORMAT.squadFormat).toBe("7v7");
    expect(B08_MATCH_FORMAT.numberOfPeriods).toBe(2);
    expect(B08_MATCH_FORMAT.periodDurationMinutes).toBe(30);
    expect(B08_MATCH_FORMAT.regulationDurationMinutes).toBe(60);
  });

  it("the five lifecycle observation instants are strictly chronological and never Date.now()-derived", () => {
    const instants = [B08_BEFORE_NOW, B08_KICKOFF_AT, B08_LIVE_NOW, B08_AFTER_REFERENCE_AT, B08_DRAFT_REFERENCE_AT, B08_COMPLETED_AT];
    for (let i = 1; i < instants.length; i++) {
      expect(instants[i]!.getTime()).toBeGreaterThan(instants[i - 1]!.getTime());
    }
  });

  it("B08_LIVE_NOW falls strictly inside the second half, before the match's own final goal (48')", () => {
    const kickoffPlusMs = B08_LIVE_NOW.getTime() - B08_KICKOFF_AT.getTime();
    const liveGlobalMinute = kickoffPlusMs / 60_000 - B08_MATCH_FORMAT.breakDurationMinutes;
    expect(liveGlobalMinute).toBeGreaterThan(B08_MATCH_FORMAT.periodDurationMinutes);
    expect(liveGlobalMinute).toBeLessThan(48);
  });

  it("the squad fills every one of the 7 real formation slots exactly once, plus one reserve", () => {
    const starters = b08Squad.filter((m) => m.role === "starter");
    expect(starters).toHaveLength(7);
    expect(starters.map((m) => m.tacticalPosition).sort()).toEqual([...B08_LINEUP_STARTER_SLOTS].sort());
    expect(b08Squad.filter((m) => m.role === "reserve")).toHaveLength(1);
  });

  it("no squad member is assigned a duplicate tactical position", () => {
    const positions = b08Squad.filter((m) => m.tacticalPosition !== null).map((m) => m.tacticalPosition);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("every canonical period-relative conversion round-trips through the real production contract", () => {
    // B08 W5 remediation (independent review, P1-3): `matchSeconds` is real MILLISECONDS despite
    // its legacy name — literal expected values below are production-contract values, not a
    // self-consistency check against this same function (a conversion function can be
    // consistently wrong against itself). Confirmed directly against
    // `src/components/live-match/live-match-client.tsx`'s own
    // `formatElapsedMs(event.matchSeconds)` renderer and doc comment.
    expect(globalMinuteToPeriodRelative(10, B08_MATCH_FORMAT)).toEqual({ period: 1, matchSeconds: 10 * 60 * 1000 });
    expect(globalMinuteToPeriodRelative(22, B08_MATCH_FORMAT)).toEqual({ period: 1, matchSeconds: 22 * 60 * 1000 });
    expect(globalMinuteToPeriodRelative(48, B08_MATCH_FORMAT)).toEqual({ period: 2, matchSeconds: 18 * 60 * 1000 });
  });

  it("matches formatElapsedMs's real minute:second rendering at each canonical goal instant", () => {
    // formatElapsedMs(elapsedMs) = floor(elapsedMs/1000) seconds -> "m:ss" (match-clock.ts).
    // A correct ms-denominated matchSeconds must format back to the real human-facing minute.
    const formatElapsedMs = (elapsedMs: number) => {
      const totalSeconds = Math.floor(elapsedMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };
    expect(formatElapsedMs(globalMinuteToPeriodRelative(10, B08_MATCH_FORMAT).matchSeconds)).toBe("10:00");
    expect(formatElapsedMs(globalMinuteToPeriodRelative(22, B08_MATCH_FORMAT).matchSeconds)).toBe("22:00");
    expect(formatElapsedMs(globalMinuteToPeriodRelative(48, B08_MATCH_FORMAT).matchSeconds)).toBe("18:00");
  });

  it("one stable match/report identity across all three MatchPresentation snapshots", () => {
    for (const presentation of [b08BeforeIdentity, b08LiveIdentity, b08AfterIdentity("draft"), b08AfterIdentity("completed")]) {
      expect(presentation.id).toBe(B08_MATCH_ID);
      expect(presentation.homeTeam).toBe(MATCH_B_TEAM_NAME);
      expect(presentation.awayTeam).toBe(B08_OPPONENT_NAME);
    }
    expect(B08_REPORT_ID).toBe("report-gate-b-08");
  });

  it("BEFORE has no score yet; LIVE carries the real in-progress 1-1; AFTER/REPORT carry the real final 2-1", () => {
    expect(b08BeforeIdentity.score).toBeNull();
    expect(b08LiveIdentity.score).toEqual({ home: 1, away: 1 });
    expect(b08AfterIdentity("draft").score).toEqual({ home: 2, away: 1 });
    expect(b08AfterIdentity("completed").score).toEqual({ home: 2, away: 1 });
  });

  it("finalization does not change the match result between draft and completed", () => {
    expect(b08AfterIdentity("draft").score).toEqual(b08AfterIdentity("completed").score);
    expect(b08AfterIdentity("draft").outcomeLabel).toEqual(b08AfterIdentity("completed").outcomeLabel);
  });
});
