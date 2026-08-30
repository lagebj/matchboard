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
    expect(deriveMatchLifecycleStatus({ ...base, roundStatus: "DRAFT", reportStatus: "LOCKED", hasPassed: true })).toBe("done");
  });

  it("returns report_incomplete for a DRAFT or REPORTED report", () => {
    expect(deriveMatchLifecycleStatus({ ...base, reportStatus: "DRAFT", hasPassed: true })).toBe("report_incomplete");
    expect(deriveMatchLifecycleStatus({ ...base, reportStatus: "REPORTED", hasPassed: true })).toBe("report_incomplete");
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
});
