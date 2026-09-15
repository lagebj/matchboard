import { describe, expect, it } from "vitest";
import {
  MATCHDAY_START_LIVE_WINDOW_MINUTES,
  MATCHDAY_VERIFY_WINDOW_MINUTES,
  formatMatchdayCountdown,
  resolveTodayMatchdayPhase,
} from "@/lib/touchline/presentation/today-matchday-phase";

const NOW_ISO = "2026-09-15T12:00:00.000Z";

function startsAtMinutesFromNow(minutes: number): string {
  return new Date(Date.parse(NOW_ISO) + minutes * 60_000).toISOString();
}

describe("resolveTodayMatchdayPhase", () => {
  it("resolves PREPARE more than 120 minutes before kickoff", () => {
    const result = resolveTodayMatchdayPhase({
      nowIso: NOW_ISO,
      startsAtIso: startsAtMinutesFromNow(5 * 60),
      lifecycleStatus: "planning_open",
      hasActiveLiveSession: false,
      canEnterLiveReporting: true,
    });
    expect(result.phase).toBe("PREPARE");
    expect(result.kickoffPassed).toBe(false);
  });

  it("resolves VERIFY at exactly 120 minutes", () => {
    const result = resolveTodayMatchdayPhase({
      nowIso: NOW_ISO,
      startsAtIso: startsAtMinutesFromNow(MATCHDAY_VERIFY_WINDOW_MINUTES),
      lifecycleStatus: "planning_open",
      hasActiveLiveSession: false,
      canEnterLiveReporting: true,
    });
    expect(result.phase).toBe("VERIFY");
  });

  it("resolves VERIFY at 119 minutes", () => {
    const result = resolveTodayMatchdayPhase({
      nowIso: NOW_ISO,
      startsAtIso: startsAtMinutesFromNow(119),
      lifecycleStatus: "planning_open",
      hasActiveLiveSession: false,
      canEnterLiveReporting: true,
    });
    expect(result.phase).toBe("VERIFY");
  });

  it("resolves IMMINENT at exactly 45 minutes", () => {
    const result = resolveTodayMatchdayPhase({
      nowIso: NOW_ISO,
      startsAtIso: startsAtMinutesFromNow(MATCHDAY_START_LIVE_WINDOW_MINUTES),
      lifecycleStatus: "planning_open",
      hasActiveLiveSession: false,
      canEnterLiveReporting: true,
    });
    expect(result.phase).toBe("IMMINENT");
  });

  it("resolves IMMINENT at 44 minutes", () => {
    const result = resolveTodayMatchdayPhase({
      nowIso: NOW_ISO,
      startsAtIso: startsAtMinutesFromNow(44),
      lifecycleStatus: "planning_open",
      hasActiveLiveSession: false,
      canEnterLiveReporting: true,
    });
    expect(result.phase).toBe("IMMINENT");
  });

  it("resolves LIVE whenever an active live session exists, regardless of kickoff proximity", () => {
    const result = resolveTodayMatchdayPhase({
      nowIso: NOW_ISO,
      startsAtIso: startsAtMinutesFromNow(-10),
      lifecycleStatus: "live",
      hasActiveLiveSession: true,
      canEnterLiveReporting: false,
    });
    expect(result.phase).toBe("LIVE");
  });

  it("resolves POST_MATCH for a canonical post-match lifecycle", () => {
    const result = resolveTodayMatchdayPhase({
      nowIso: NOW_ISO,
      startsAtIso: startsAtMinutesFromNow(-300),
      lifecycleStatus: "report_incomplete",
      hasActiveLiveSession: false,
      canEnterLiveReporting: false,
    });
    expect(result.phase).toBe("POST_MATCH");
  });

  it("keeps IMMINENT with kickoffPassed when kickoff has passed but live reporting is still valid", () => {
    const result = resolveTodayMatchdayPhase({
      nowIso: NOW_ISO,
      startsAtIso: startsAtMinutesFromNow(-5),
      lifecycleStatus: "planning_closed",
      hasActiveLiveSession: false,
      canEnterLiveReporting: true,
    });
    expect(result.phase).toBe("IMMINENT");
    expect(result.kickoffPassed).toBe(true);
  });

  it("resolves PREPARE with no countdown when kickoff is missing", () => {
    const result = resolveTodayMatchdayPhase({
      nowIso: NOW_ISO,
      startsAtIso: null,
      lifecycleStatus: "planning_open",
      hasActiveLiveSession: false,
      canEnterLiveReporting: true,
    });
    expect(result.phase).toBe("PREPARE");
    expect(result.minutesToKickoff).toBeNull();
  });

  it("does not invent a finished state when kickoff passed and live reporting is no longer valid", () => {
    const result = resolveTodayMatchdayPhase({
      nowIso: NOW_ISO,
      startsAtIso: startsAtMinutesFromNow(-30),
      lifecycleStatus: "planning_closed",
      hasActiveLiveSession: false,
      canEnterLiveReporting: false,
    });
    expect(result.phase).toBe("PREPARE");
    expect(result.kickoffPassed).toBe(true);
  });
});

describe("formatMatchdayCountdown", () => {
  it("formats hours and minutes", () => {
    expect(formatMatchdayCountdown(95)).toBe("1h 35m");
  });

  it("formats whole hours without a minutes suffix", () => {
    expect(formatMatchdayCountdown(120)).toBe("2h");
  });

  it("formats minutes only under one hour", () => {
    expect(formatMatchdayCountdown(28)).toBe("28m");
  });

  it("clamps negative values to zero", () => {
    expect(formatMatchdayCountdown(-5)).toBe("0m");
  });
});
