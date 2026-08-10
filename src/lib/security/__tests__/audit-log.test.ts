import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  logAuthSuccess,
  logAuthFailure,
  logAccessDenied,
  logMutationEvent,
  logFinalization,
  logManualOverride,
  logDataExport,
  logReportComplete,
  logReportReopen,
  logMatchCancel,
  logMatchReopen,
  logMatchDelete,
  logPlayerRemove,
  logPlayerRestore,
  logEventSquadConfirm,
  logEventSquadUnconfirm,
} from "../audit-log";

describe("audit-log", () => {
  const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    consoleInfoSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterAll(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("logs successful auth event to info", () => {
    logAuthSuccess("coach@example.com");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:auth] login_success result=success actor=coach@example.com"),
    );
  });

  it("logs auth failure to warn", () => {
    logAuthFailure("unknown@example.com", "not_in_allowlist");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:auth] login_failure result=failure actor=unknown@example.com reason=not_in_allowlist"),
    );
  });

  it("logs access denied to warn", () => {
    logAccessDenied("coach@example.com", "season_export", "insufficient_role");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:access] access_denied result=denied actor=coach@example.com resource=season_export reason=insufficient_role"),
    );
  });

  it("logs finalization event", () => {
    logFinalization("coach@example.com", "round", "round_123", "success");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] finalization result=success actor=coach@example.com resource=round id=round_123"),
    );
  });

  it("logs manual override with reason", () => {
    logManualOverride("coach@example.com", "selection", "sel_456", "squad_too_small");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] manual_override result=success actor=coach@example.com resource=selection id=sel_456 reason=squad_too_small"),
    );
  });

  it("logs data export event", () => {
    logDataExport("coach@example.com", "csv", "coach", "success");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:data_integrity] data_export result=success actor=coach@example.com resource=season_export"),
    );
  });

  it("logs generic mutation event", () => {
    logMutationEvent("match_cancel", "coach@example.com", "match", "match_789", "success");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] match_cancel result=success actor=coach@example.com resource=match id=match_789"),
    );
  });

  it("logs failed mutation to warn", () => {
    logMutationEvent("finalization", "coach@example.com", "round", "round_123", "failure", "blocked_conditions");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("result=failure"),
    );
  });

  it("logs report complete event", () => {
    logReportComplete("coach@example.com", "report_123", "success");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] report_complete result=success actor=coach@example.com resource=post_match_report id=report_123"),
    );
  });

  it("logs report reopen event with failure", () => {
    logReportReopen("coach@example.com", "report_456", "failure", "already_locked");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] report_reopen result=failure actor=coach@example.com resource=post_match_report id=report_456 reason=already_locked"),
    );
  });

  it("logs match cancel event", () => {
    logMatchCancel("coach@example.com", "match_789", "success", "weather");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] match_cancel result=success actor=coach@example.com resource=match id=match_789 reason=weather"),
    );
  });

  it("logs match reopen event", () => {
    logMatchReopen("coach@example.com", "match_789", "success");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] match_reopen result=success actor=coach@example.com resource=match id=match_789"),
    );
  });

  it("logs match delete event", () => {
    logMatchDelete("coach@example.com", "match_001", "success");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] match_delete result=success actor=coach@example.com resource=match id=match_001"),
    );
  });

  it("logs player remove event", () => {
    logPlayerRemove("coach@example.com", "player_1", "success", "left_club");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] player_remove result=success actor=coach@example.com resource=player id=player_1 reason=left_club"),
    );
  });

  it("logs player restore event", () => {
    logPlayerRestore("coach@example.com", "player_1", "success");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] player_restore result=success actor=coach@example.com resource=player id=player_1"),
    );
  });

  it("logs event squad confirm event", () => {
    logEventSquadConfirm("coach@example.com", "event_1", "success");
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] event_squad_lock result=success actor=coach@example.com resource=event id=event_1"),
    );
  });

  it("logs event squad unconfirm event with failure", () => {
    logEventSquadUnconfirm("coach@example.com", "event_1", "failure");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[security:mutation] event_squad_unlock result=failure actor=coach@example.com resource=event id=event_1"),
    );
  });
});