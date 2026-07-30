import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  logSecurityEvent,
  logAuthSuccess,
  logAuthFailure,
  logAccessDenied,
  logMutationEvent,
  logFinalization,
  logManualOverride,
  logDataExport,
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
});