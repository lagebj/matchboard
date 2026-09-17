import { describe, it, expect } from "vitest";
import { deriveMatchLifecycleStatus } from "../planning-boundary";

describe("deriveMatchLifecycleStatus", () => {
  const now = new Date("2026-09-01T12:00:00Z");
  const futureDate = new Date("2026-09-01T15:00:00Z");
  const pastDate = new Date("2026-08-20T09:00:00Z");

  const base = {
    matchStatus: "SCHEDULED",
    reportStatus: "NONE" as const,
    hasPassed: false,
    isLive: false,
    roundStatus: "DRAFT",
    planningClosedAt: null,
    startsAt: futureDate.toISOString(),
    now,
  };

  it("returns cancelled for a cancelled match regardless of anything else", () => {
    expect(deriveMatchLifecycleStatus({ ...base, matchStatus: "CANCELLED", reportStatus: "LOCKED", hasPassed: true })).toBe("cancelled");
  });

  it("returns done once the report is LOCKED, even if the round was never finalized", () => {
    expect(deriveMatchLifecycleStatus({ ...base, roundStatus: "DRAFT", reportStatus: "LOCKED", hasPassed: true, startsAt: pastDate.toISOString() })).toBe("done");
  });

  it("returns report_incomplete for a DRAFT or REPORTED report", () => {
    expect(deriveMatchLifecycleStatus({ ...base, reportStatus: "DRAFT", hasPassed: true, startsAt: pastDate.toISOString() })).toBe("report_incomplete");
    expect(deriveMatchLifecycleStatus({ ...base, reportStatus: "REPORTED", hasPassed: true, startsAt: pastDate.toISOString() })).toBe("report_incomplete");
  });

  it("returns live when a live session is active, ahead of played/planning states", () => {
    expect(deriveMatchLifecycleStatus({ ...base, isLive: true, hasPassed: false })).toBe("live");
  });

  it("returns played when the match has passed with no report started yet", () => {
    expect(deriveMatchLifecycleStatus({ ...base, hasPassed: true, startsAt: pastDate.toISOString() })).toBe("played");
  });

  it("does not report 'done' for a finalized round whose match has not been played yet (the key bug this fixes)", () => {
    const result = deriveMatchLifecycleStatus({ ...base, roundStatus: "FINALIZED", hasPassed: false, reportStatus: "NONE" });
    expect(result).toBe("planning_closed");
    expect(result).not.toBe("done");
  });

  it("returns planning_closed when planning has been explicitly closed pre-match", () => {
    expect(deriveMatchLifecycleStatus({ ...base, planningClosedAt: new Date("2026-09-01T11:00:00Z") })).toBe("planning_closed");
  });

  it("returns planning_closed once scheduled kickoff has passed, even with no live session yet", () => {
    expect(deriveMatchLifecycleStatus({ ...base, startsAt: pastDate.toISOString(), hasPassed: false })).toBe("planning_closed");
  });

  it("returns planning_open before kickoff with nothing else in play", () => {
    expect(deriveMatchLifecycleStatus(base)).toBe("planning_open");
  });

  it("a legacy FINALIZED round with no planningClosedAt (pre-ADR-0109 historical data) still reports planning_closed for an unplayed match", () => {
    // Old data: MatchRound.status was set to FINALIZED by the removed manual finalize action,
    // which predates the planningClosedAt column and never set it. The fallback must still work.
    expect(deriveMatchLifecycleStatus({ ...base, roundStatus: "FINALIZED", planningClosedAt: null, hasPassed: false })).toBe("planning_closed");
  });

  // Production incident, 2026-09-17: a future match (kickoff still hours away) displayed
  // "Full time" because `markMatchAbsence()` (src/lib/reports/report-mutations.ts) had seeded an
  // empty DRAFT `PostMatchReport` the evening before, purely to attach a pre-kickoff absence
  // note for one player. A report's mere existence was treated as proof the match had been
  // played -- it is not; only an actual `startsAt <= now` kickoff, or `isLive`, means that.
  // `base.startsAt` is `futureDate` here (still ahead of `now`) -- exactly the reported scenario.
  it("does not report report_incomplete for a DRAFT/REPORTED report seeded before kickoff (the exact bug this fixes)", () => {
    const draft = deriveMatchLifecycleStatus({ ...base, reportStatus: "DRAFT", hasPassed: false, isLive: false });
    const reported = deriveMatchLifecycleStatus({ ...base, reportStatus: "REPORTED", hasPassed: false, isLive: false });
    expect(draft).not.toBe("report_incomplete");
    expect(reported).not.toBe("report_incomplete");
    // Falls through to the same real signals a report-less match would use.
    expect(draft).toBe("planning_open");
    expect(reported).toBe("planning_open");
  });

  it("does not report done for a LOCKED report before kickoff either (same guard, symmetric case)", () => {
    const result = deriveMatchLifecycleStatus({ ...base, reportStatus: "LOCKED", hasPassed: false, isLive: false });
    expect(result).not.toBe("done");
    expect(result).toBe("planning_open");
  });

  it("still reports report_incomplete/done once the match has actually kicked off or gone live, even with a report seeded before kickoff", () => {
    // Once kickoff has actually occurred (`startsAt <= now`) or the match is live, report status
    // becomes authoritative again -- this guard only withholds it before kickoff.
    expect(deriveMatchLifecycleStatus({ ...base, reportStatus: "DRAFT", hasPassed: false, isLive: true })).toBe("report_incomplete");
    expect(deriveMatchLifecycleStatus({ ...base, reportStatus: "LOCKED", hasPassed: true, startsAt: pastDate.toISOString() })).toBe("done");
  });

  it("treats a same-day-but-already-kicked-off match's LOCKED report as done even while hasPassed (the coarser display-day boundary) is still false", () => {
    // The command-centre regression this guards against: a match that kicked off and was fully
    // reported earlier the same calendar day has `hasPassed: false` all day by design (Europe/
    // Oslo display-day semantics, `hasLeagueMatchPassed()`) -- but its kickoff instant is real and
    // in the past, so the report must still win.
    const kickoffEarlierToday = new Date(now.getTime() - 60 * 60 * 1000); // 1h before `now`
    const result = deriveMatchLifecycleStatus({
      ...base,
      reportStatus: "LOCKED",
      hasPassed: false,
      startsAt: kickoffEarlierToday.toISOString(),
    });
    expect(result).toBe("done");
  });
});
