import { describe, it, expect } from "vitest";
import { resolveLiveReportingPrimaryAction } from "../live-reporting-primary-action";
import { LEAGUE_PERIOD_CONFIG, buildPeriodConfigFromFormat, type PeriodConfig } from "../period-config";
import { getEventPeriodConfig } from "../period-config";

/**
 * ADR-0152 §2/§3, TEST-PLAN §1: the canonical resolver matrix. Every Live Reporting/Today/Match
 * Details surface must agree with these cases — components must never re-derive this state.
 */

describe("resolveLiveReportingPrimaryAction (ADR-0152)", () => {
  it("no session -> START_LIVE_REPORTING", () => {
    expect(
      resolveLiveReportingPrimaryAction({ sessionStatus: "NONE", periodConfig: LEAGUE_PERIOD_CONFIG }),
    ).toEqual({ kind: "START_LIVE_REPORTING" });
  });

  it("first period running -> END_PERIOD", () => {
    expect(
      resolveLiveReportingPrimaryAction({
        sessionStatus: "ACTIVE",
        clock: { period: "FIRST_HALF", running: true },
        periodConfig: LEAGUE_PERIOD_CONFIG,
      }),
    ).toEqual({ kind: "END_PERIOD", period: "FIRST_HALF", label: "End first half" });
  });

  it("paused period -> RESUME_PERIOD", () => {
    expect(
      resolveLiveReportingPrimaryAction({
        sessionStatus: "ACTIVE",
        clock: { period: "SECOND_HALF", running: false },
        periodConfig: LEAGUE_PERIOD_CONFIG,
      }),
    ).toEqual({ kind: "RESUME_PERIOD", period: "SECOND_HALF", label: "Resume second half" });
  });

  it("between periods (half time) -> START_PERIOD (second half)", () => {
    expect(
      resolveLiveReportingPrimaryAction({
        sessionStatus: "ACTIVE",
        clock: { period: "HALF_TIME", running: false },
        periodConfig: LEAGUE_PERIOD_CONFIG,
      }),
    ).toEqual({ kind: "START_PERIOD", period: "SECOND_HALF", label: "Start second half" });
  });

  it("before kickoff -> START_PERIOD (first half)", () => {
    expect(
      resolveLiveReportingPrimaryAction({
        sessionStatus: "ACTIVE",
        clock: { period: "BEFORE", running: false },
        periodConfig: LEAGUE_PERIOD_CONFIG,
      }),
    ).toEqual({ kind: "START_PERIOD", period: "FIRST_HALF", label: "Start first half" });
  });

  it("final configured period ended -> FINISH_LIVE_REPORTING, no competing action", () => {
    expect(
      resolveLiveReportingPrimaryAction({
        sessionStatus: "ACTIVE",
        clock: { period: "FULL_TIME", running: false },
        periodConfig: LEAGUE_PERIOD_CONFIG,
      }),
    ).toEqual({ kind: "FINISH_LIVE_REPORTING" });
  });

  it("ended session + draft report exists -> OPEN_POST_MATCH_REPORT", () => {
    expect(
      resolveLiveReportingPrimaryAction({ sessionStatus: "ENDED", reportExists: true, periodConfig: LEAGUE_PERIOD_CONFIG }),
    ).toEqual({ kind: "OPEN_POST_MATCH_REPORT" });
  });

  it("ended session without a report yet -> WAIT_FOR_RECONCILIATION", () => {
    expect(
      resolveLiveReportingPrimaryAction({ sessionStatus: "ENDED", reportExists: false, periodConfig: LEAGUE_PERIOD_CONFIG }),
    ).toEqual({ kind: "WAIT_FOR_RECONCILIATION" });
  });

  it("client sees >=270 minutes before cron catches up -> WAIT_FOR_RECONCILIATION, never a second timeout state", () => {
    expect(
      resolveLiveReportingPrimaryAction({
        sessionStatus: "ACTIVE",
        clock: { period: "SECOND_HALF", running: true },
        periodConfig: LEAGUE_PERIOD_CONFIG,
        reconciliationPending: true,
      }),
    ).toEqual({ kind: "WAIT_FOR_RECONCILIATION" });
  });

  it("Event equivalent (Event's own period config) produces the same shape", () => {
    const eventConfig = getEventPeriodConfig(60, 2, 15);
    expect(
      resolveLiveReportingPrimaryAction({
        sessionStatus: "ACTIVE",
        clock: { period: "FIRST_HALF", running: true },
        periodConfig: eventConfig,
      }),
    ).toEqual({ kind: "END_PERIOD", period: "FIRST_HALF", label: "End first half" });
  });

  it("custom number of periods (single-period format) -> FINISH_LIVE_REPORTING once that one period ends", () => {
    const singlePeriod: PeriodConfig[] = buildPeriodConfigFromFormat({
      numberOfPeriods: 1,
      periodDurationMinutes: 40,
      breakDurationMinutes: 0,
    });
    expect(
      resolveLiveReportingPrimaryAction({
        sessionStatus: "ACTIVE",
        clock: { period: "FULL_TIME", running: false },
        periodConfig: singlePeriod,
      }),
    ).toEqual({ kind: "FINISH_LIVE_REPORTING" });
  });

  it("missing format snapshot (legacy fallback period config) still resolves correctly", () => {
    expect(
      resolveLiveReportingPrimaryAction({
        sessionStatus: "ACTIVE",
        clock: { period: "BEFORE", running: false },
        periodConfig: LEAGUE_PERIOD_CONFIG,
      }),
    ).toEqual({ kind: "START_PERIOD", period: "FIRST_HALF", label: "Start first half" });
  });

  it("ACTIVE session with no clock value defensively treats it as before kickoff", () => {
    expect(
      resolveLiveReportingPrimaryAction({ sessionStatus: "ACTIVE", clock: null, periodConfig: LEAGUE_PERIOD_CONFIG }),
    ).toEqual({ kind: "START_PERIOD", period: "FIRST_HALF", label: "Start first half" });
  });
});
