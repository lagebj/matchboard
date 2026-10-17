import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({ db: {} }));

const { markMatchAbsenceMock, clearMatchAbsenceMock } = vi.hoisted(() => ({
  markMatchAbsenceMock: vi.fn(),
  clearMatchAbsenceMock: vi.fn(),
}));

vi.mock("@/lib/reports/report-mutations", () => ({
  markMatchAbsence: markMatchAbsenceMock,
  clearMatchAbsence: clearMatchAbsenceMock,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { markMatchAbsenceAction, clearMatchAbsenceAction } from "../absence-actions";

describe("markMatchAbsenceAction / clearMatchAbsenceAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockRequirePlayerGroupAccess.mockResolvedValue(null);
    auth.mockRequireMatchGroupAccess.mockResolvedValue(null);
    markMatchAbsenceMock.mockResolvedValue({ success: true });
    clearMatchAbsenceMock.mockResolvedValue({ success: true });
  });

  it("returns a failure result, instead of throwing, when the player is no longer accessible (e.g. removed from the roster)", async () => {
    // Reproduces the real production incident: a player stays on a future match's finalized
    // squad plan after being removed from the roster. requirePlayerGroupAccess correctly throws
    // for this (see actor-context.test.ts "rejects when player not found in org"), but the
    // action let that throw escape uncaught instead of honouring its own declared
    // Promise<{ success, error }> contract.
    auth.mockRequirePlayerGroupAccess.mockRejectedValue(
      new Error("Player not found or access denied."),
    );

    const result = await markMatchAbsenceAction("match-1", "removed-player-1", "SICK");

    expect(result).toEqual({ success: false, error: "Player not found or access denied." });
    expect(markMatchAbsenceMock).not.toHaveBeenCalled();
  });

  it("marks a player absent when authorization succeeds", async () => {
    const result = await markMatchAbsenceAction("match-1", "player-1", "SICK");

    expect(result).toEqual({ success: true });
    expect(markMatchAbsenceMock).toHaveBeenCalledWith(
      "match-1",
      { playerId: "player-1", reason: "SICK", note: undefined },
      expect.anything(),
    );
  });

  it("clearMatchAbsenceAction returns a failure result, instead of throwing, when the player is no longer accessible", async () => {
    auth.mockRequirePlayerGroupAccess.mockRejectedValue(
      new Error("Player not found or access denied."),
    );

    const result = await clearMatchAbsenceAction("match-1", "removed-player-1");

    expect(result).toEqual({ success: false, error: "Player not found or access denied." });
    expect(clearMatchAbsenceMock).not.toHaveBeenCalled();
  });

  it("clears a player's absence when authorization succeeds", async () => {
    const result = await clearMatchAbsenceAction("match-1", "player-1");

    expect(result).toEqual({ success: true });
    expect(clearMatchAbsenceMock).toHaveBeenCalled();
  });
});
