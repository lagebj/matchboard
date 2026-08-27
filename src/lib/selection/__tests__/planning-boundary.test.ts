import { describe, it, expect } from "vitest";
import { deriveMatchPlanningStatus, deriveRoundPlanningStatus, deriveMatchLifecycleStatus } from "../planning-boundary";

describe("deriveMatchPlanningStatus", () => {
  const now = new Date("2026-09-01T12:00:00Z");
  const futureDate = new Date("2026-09-01T15:00:00Z");
  const pastDate = new Date("2026-09-01T09:00:00Z");

  it("returns cancelled for cancelled matches", () => {
    const result = deriveMatchPlanningStatus({
      roundStatus: "DRAFT",
      matchStatus: "CANCELLED",
      planningClosedAt: null,
      startsAt: futureDate.toISOString(),
      liveSessionStartedAt: null,
      now,
    });
    expect(result).toBe("cancelled");
  });

  it("returns finalized for finalized rounds", () => {
    const result = deriveMatchPlanningStatus({
      roundStatus: "FINALIZED",
      matchStatus: "SCHEDULED",
      planningClosedAt: null,
      startsAt: futureDate.toISOString(),
      liveSessionStartedAt: null,
      now,
    });
    expect(result).toBe("finalized");
  });

  it("returns live when a live session has started", () => {
    const result = deriveMatchPlanningStatus({
      roundStatus: "DRAFT",
      matchStatus: "SCHEDULED",
      planningClosedAt: null,
      startsAt: futureDate.toISOString(),
      liveSessionStartedAt: new Date("2026-09-01T11:50:00Z"),
      now,
    });
    expect(result).toBe("live");
  });

  it("returns planning_closed when planningClosedAt is set", () => {
    const result = deriveMatchPlanningStatus({
      roundStatus: "DRAFT",
      matchStatus: "SCHEDULED",
      planningClosedAt: new Date("2026-09-01T11:00:00Z"),
      startsAt: futureDate.toISOString(),
      liveSessionStartedAt: null,
      now,
    });
    expect(result).toBe("planning_closed");
  });

  it("returns planning_closed when kickoff has passed", () => {
    const result = deriveMatchPlanningStatus({
      roundStatus: "DRAFT",
      matchStatus: "SCHEDULED",
      planningClosedAt: null,
      startsAt: pastDate.toISOString(),
      liveSessionStartedAt: null,
      now,
    });
    expect(result).toBe("planning_closed");
  });

  it("returns planning_open when kickoff is in the future and no live session", () => {
    const result = deriveMatchPlanningStatus({
      roundStatus: "DRAFT",
      matchStatus: "SCHEDULED",
      planningClosedAt: null,
      startsAt: futureDate.toISOString(),
      liveSessionStartedAt: null,
      now,
    });
    expect(result).toBe("planning_open");
  });

  it("returns planning_open when startsAt is null (no date set)", () => {
    const result = deriveMatchPlanningStatus({
      roundStatus: "DRAFT",
      matchStatus: "SCHEDULED",
      planningClosedAt: null,
      startsAt: null,
      liveSessionStartedAt: null,
      now,
    });
    expect(result).toBe("planning_open");
  });

  it("returns planning_closed when kickoff equals now (boundary: <= means closed)", () => {
    const kickoff = new Date("2026-09-01T12:00:00Z");
    const result = deriveMatchPlanningStatus({
      roundStatus: "DRAFT",
      matchStatus: "SCHEDULED",
      planningClosedAt: null,
      startsAt: kickoff.toISOString(),
      liveSessionStartedAt: null,
      now,
    });
    expect(result).toBe("planning_closed");
  });

  it("live session takes precedence over future kickoff", () => {
    const result = deriveMatchPlanningStatus({
      roundStatus: "DRAFT",
      matchStatus: "SCHEDULED",
      planningClosedAt: null,
      startsAt: futureDate.toISOString(),
      liveSessionStartedAt: new Date("2026-09-01T11:55:00Z"),
      now,
    });
    expect(result).toBe("live");
  });

  it("planningClosedAt takes precedence over future kickoff but not live", () => {
    const result = deriveMatchPlanningStatus({
      roundStatus: "DRAFT",
      matchStatus: "SCHEDULED",
      planningClosedAt: new Date("2026-09-01T11:00:00Z"),
      startsAt: futureDate.toISOString(),
      liveSessionStartedAt: null,
      now,
    });
    expect(result).toBe("planning_closed");
  });
});

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
});

describe("deriveRoundPlanningStatus", () => {
  const now = new Date("2026-09-01T12:00:00Z");
  const futureDate = new Date("2026-09-01T15:00:00Z");
  const pastDate = new Date("2026-09-01T09:00:00Z");

  it("returns finalized for finalized rounds", () => {
    const result = deriveRoundPlanningStatus({
      roundStatus: "FINALIZED",
      matches: [],
      now,
    });
    expect(result).toBe("finalized");
  });

  it("returns planning_open when all matches have future kickoffs and no closures", () => {
    const result = deriveRoundPlanningStatus({
      roundStatus: "DRAFT",
      matches: [
        { matchStatus: "SCHEDULED", planningClosedAt: null, startsAt: futureDate.toISOString(), liveSessionStartedAt: null },
        { matchStatus: "SCHEDULED", planningClosedAt: null, startsAt: futureDate.toISOString(), liveSessionStartedAt: null },
      ],
      now,
    });
    expect(result).toBe("planning_open");
  });

  it("returns planning_closed when all matches have passed kickoffs", () => {
    const result = deriveRoundPlanningStatus({
      roundStatus: "DRAFT",
      matches: [
        { matchStatus: "SCHEDULED", planningClosedAt: null, startsAt: pastDate.toISOString(), liveSessionStartedAt: null },
        { matchStatus: "SCHEDULED", planningClosedAt: null, startsAt: pastDate.toISOString(), liveSessionStartedAt: null },
      ],
      now,
    });
    expect(result).toBe("planning_closed");
  });

  it("returns partially_closed when some matches have passed kickoffs", () => {
    const result = deriveRoundPlanningStatus({
      roundStatus: "DRAFT",
      matches: [
        { matchStatus: "SCHEDULED", planningClosedAt: null, startsAt: pastDate.toISOString(), liveSessionStartedAt: null },
        { matchStatus: "SCHEDULED", planningClosedAt: null, startsAt: futureDate.toISOString(), liveSessionStartedAt: null },
      ],
      now,
    });
    expect(result).toBe("partially_closed");
  });

  it("returns planning_open when no active matches exist (all cancelled)", () => {
    const result = deriveRoundPlanningStatus({
      roundStatus: "DRAFT",
      matches: [
        { matchStatus: "CANCELLED", planningClosedAt: null, startsAt: pastDate.toISOString(), liveSessionStartedAt: null },
      ],
      now,
    });
    expect(result).toBe("planning_open");
  });

  it("ignores cancelled matches when checking closed status", () => {
    const result = deriveRoundPlanningStatus({
      roundStatus: "DRAFT",
      matches: [
        { matchStatus: "CANCELLED", planningClosedAt: null, startsAt: pastDate.toISOString(), liveSessionStartedAt: null },
        { matchStatus: "SCHEDULED", planningClosedAt: null, startsAt: futureDate.toISOString(), liveSessionStartedAt: null },
      ],
      now,
    });
    expect(result).toBe("planning_open");
  });

  it("returns partially_closed when one match has live session and one is open", () => {
    const result = deriveRoundPlanningStatus({
      roundStatus: "DRAFT",
      matches: [
        { matchStatus: "SCHEDULED", planningClosedAt: null, startsAt: futureDate.toISOString(), liveSessionStartedAt: new Date() },
        { matchStatus: "SCHEDULED", planningClosedAt: null, startsAt: futureDate.toISOString(), liveSessionStartedAt: null },
      ],
      now,
    });
    expect(result).toBe("partially_closed");
  });
});