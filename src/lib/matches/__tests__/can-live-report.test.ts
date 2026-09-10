import { describe, it, expect } from "vitest";
import { canStartLiveReporting, LIVE_REPORTING_LEAD_MS } from "@/lib/matches/can-live-report";

const base = {
  isCancelled: false,
  isLive: false,
  allSelectionsFinalized: false,
  startsAt: new Date("2026-09-09T15:30:00.000Z"),
  now: new Date("2026-09-09T15:31:00.000Z"), // just after kickoff
};

describe("canStartLiveReporting (ADR-0133 H5)", () => {
  it("is offered once every selection is finalized (previous behaviour, kept)", () => {
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "planning_open", allSelectionsFinalized: true })).toBe(true);
  });

  it("is offered when the plan is closed even if selections are not all finalized", () => {
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "planning_closed" })).toBe(true);
  });

  it("is offered in the hour before kickoff while planning is still open (the incident case)", () => {
    const now = new Date(base.startsAt.getTime() - LIVE_REPORTING_LEAD_MS + 60_000);
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "planning_open", now })).toBe(true);
  });

  it("is not offered more than an hour before kickoff with planning still open", () => {
    const now = new Date(base.startsAt.getTime() - LIVE_REPORTING_LEAD_MS - 60_000);
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "planning_open", now })).toBe(false);
  });

  it("is always offered while a session is live", () => {
    expect(canStartLiveReporting({ ...base, lifecycleStatus: "planning_open", isLive: true, now: new Date("2020-01-01") })).toBe(true);
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
