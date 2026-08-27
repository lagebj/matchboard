import { describe, it, expect } from "vitest";
import { deriveMatchPlanningStatus, deriveRoundPlanningStatus } from "../planning-boundary";

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