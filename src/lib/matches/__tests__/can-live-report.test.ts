import { describe, it, expect } from "vitest";
import { canStartLiveReporting } from "@/lib/matches/can-live-report";

const base = {
  isCancelled: false,
  isLive: false,
};

describe("canStartLiveReporting (ADR-0133 H5, refined 2026-09-12)", () => {
  it("is offered while planning is still open, with no pre-kickoff lead-time gate", () => {
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "planning_open" })).toBe(true);
  });

  it("is offered once the plan is closed", () => {
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "planning_closed" })).toBe(true);
  });

  it("is always offered while a session is live", () => {
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "planning_open", isLive: true })).toBe(true);
  });

  it("is not offered for a cancelled match", () => {
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "planning_closed", isCancelled: true })).toBe(false);
  });

  it("is not offered once the report is completed", () => {
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "done", isLive: false })).toBe(false);
  });

  it("is not offered while a report is already in progress ('After match' is the path)", () => {
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "report_incomplete" })).toBe(false);
  });

  it("is not offered for a match whose kickoff day has fully passed with no report", () => {
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "played" })).toBe(false);
  });
});
