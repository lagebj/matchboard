import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSafeReportLifecycle, type SafeReportLocalState } from "../use-safe-report-lifecycle";

const COMPLETED_BY = "Marte Johansen";
const COMPLETED_AT = "2026-10-11T12:05:00.000Z";
const ELIGIBLE_PLAYERS = [
  { id: "player-noah", name: "Noah" },
  { id: "player-magnus", name: "Magnus" },
  { id: "player-elias", name: "Elias" },
];

function baseState(overrides: Partial<SafeReportLocalState> = {}): SafeReportLocalState {
  return {
    status: "REPORTED",
    ourScore: 3,
    opponentScore: 2,
    goals: [{ id: "goal-1", playerId: "player-noah", playerName: "Noah", minute: 12 }],
    assists: [],
    players: [
      { id: "actual-noah", playerId: "player-noah", playerName: "Noah", attendanceStatus: "PRESENT" },
      { id: "actual-magnus", playerId: "player-magnus", playerName: "Magnus", attendanceStatus: "NO_SHOW" },
    ],
    timingReview: [{ period: "SECOND_HALF", periodLabel: "Second half", resolvedDurationMinutes: 42, needsReview: true }],
    outOfRangeEventCount: 0,
    completedBy: null,
    completedAt: null,
    nextLocalId: 0,
    ...overrides,
  };
}

/**
 * B5/R3 — exercises the action interface directly (not rendered buttons), covering every
 * rejection path, determinism of local ids/timestamps, and that a rejected call leaves state
 * byte-for-byte unchanged.
 */
describe("useSafeReportLifecycle (B5/R3)", () => {
  it("complete() rejects while a period still needs timing review, and state is unchanged", async () => {
    const { result } = renderHook(() => useSafeReportLifecycle(baseState(), COMPLETED_BY, COMPLETED_AT));
    const before = result.current.state;
    let outcome;
    await act(async () => {
      outcome = await result.current.actions.complete();
    });
    expect(outcome).toEqual({ success: false, error: expect.stringContaining("timing still needs review") });
    expect(result.current.state).toEqual(before);
    expect(result.current.state.status).toBe("REPORTED");
  });

  it("complete() succeeds once timing is resolved, stamping the caller-supplied deterministic timestamp (never Date.now())", async () => {
    const { result } = renderHook(() =>
      useSafeReportLifecycle(baseState({ timingReview: [{ period: "SECOND_HALF", periodLabel: "Second half", resolvedDurationMinutes: 45, needsReview: false }] }), COMPLETED_BY, COMPLETED_AT),
    );
    await act(async () => {
      await result.current.actions.complete();
    });
    expect(result.current.state.status).toBe("LOCKED");
    expect(result.current.state.completedAt).toBe(COMPLETED_AT);
    expect(result.current.state.completedBy).toBe(COMPLETED_BY);
  });

  it("complete() does NOT require goal-attribution reconciliation — matches the real completeReport() contract, not an invented stricter rule", async () => {
    const { result } = renderHook(() =>
      useSafeReportLifecycle(
        baseState({ goals: [], timingReview: [{ period: "SECOND_HALF", periodLabel: "Second half", resolvedDurationMinutes: 45, needsReview: false }] }),
        COMPLETED_BY,
        COMPLETED_AT,
      ),
    );
    await act(async () => {
      const outcome = await result.current.actions.complete();
      expect(outcome.success).toBe(true);
    });
    expect(result.current.state.status).toBe("LOCKED");
  });

  it("rejects every editing action once LOCKED, and never changes state (B5/R3 — not just addGoal)", async () => {
    const locked = baseState({ status: "LOCKED", completedBy: COMPLETED_BY, completedAt: COMPLETED_AT, timingReview: [] });
    const { result } = renderHook(() => useSafeReportLifecycle(locked, COMPLETED_BY, COMPLETED_AT));
    const before = result.current.state;

    const attempts: Array<() => Promise<{ success: boolean; error?: string }>> = [
      () => result.current.actions.updateResult({ ourScore: 9 }),
      () => result.current.actions.addGoal({ playerId: "player-noah" }),
      () => result.current.actions.removeGoal("goal-1"),
      () => result.current.actions.addAssist({ playerId: "player-noah" }),
      () => result.current.actions.removeAssist("assist-1"),
      () => result.current.actions.updateAttendance("actual-noah", "NO_SHOW"),
      () => result.current.actions.addPlayer({ playerId: "player-new" }),
      () => result.current.actions.removePlayer("actual-noah"),
      () => result.current.actions.confirmPeriodTiming!("SECOND_HALF"),
      () => result.current.actions.correctPeriodTiming!("SECOND_HALF", 45),
    ];

    for (const attempt of attempts) {
      await act(async () => {
        const outcome = await attempt();
        expect(outcome.success).toBe(false);
        expect(outcome.error).toBeTruthy();
      });
      expect(result.current.state).toEqual(before);
    }
  });

  it("reopen() is only permitted from LOCKED, and complete() is only permitted from DRAFT/REPORTED", async () => {
    const draft = baseState({ status: "DRAFT" });
    const { result } = renderHook(() => useSafeReportLifecycle(draft, COMPLETED_BY, COMPLETED_AT));
    await act(async () => {
      const outcome = await result.current.actions.reopen("DRAFT");
      expect(outcome).toEqual({ success: false, error: "Report is not locked." });
    });

    await act(async () => {
      await result.current.actions.confirmPeriodTiming!("SECOND_HALF");
    });
    await act(async () => {
      await result.current.actions.complete();
    });
    expect(result.current.state.status).toBe("LOCKED");

    await act(async () => {
      const outcome = await result.current.actions.complete();
      expect(outcome).toEqual({ success: false, error: "Report is already locked." });
    });
  });

  it("rejects an invalid goal minute and an ineligible (not present) scorer, leaving goals unchanged", async () => {
    const { result } = renderHook(() => useSafeReportLifecycle(baseState(), COMPLETED_BY, COMPLETED_AT));
    const before = result.current.state.goals;

    await act(async () => {
      const outcome = await result.current.actions.addGoal({ playerId: "player-noah", minute: 999 });
      expect(outcome.success).toBe(false);
    });
    expect(result.current.state.goals).toEqual(before);

    await act(async () => {
      const outcome = await result.current.actions.addGoal({ playerId: "player-magnus" }); // NO_SHOW, not eligible
      expect(outcome.success).toBe(false);
    });
    expect(result.current.state.goals).toEqual(before);

    await act(async () => {
      const outcome = await result.current.actions.addGoal({ playerId: "player-does-not-exist" });
      expect(outcome.success).toBe(false);
    });
    expect(result.current.state.goals).toEqual(before);
  });

  it("rejects removing a nonexistent goal/assist/player, and rejects a duplicate addPlayer", async () => {
    const { result } = renderHook(() => useSafeReportLifecycle(baseState(), COMPLETED_BY, COMPLETED_AT, ELIGIBLE_PLAYERS));

    await act(async () => {
      expect((await result.current.actions.removeGoal("no-such-goal")).success).toBe(false);
      expect((await result.current.actions.removeAssist("no-such-assist")).success).toBe(false);
      expect((await result.current.actions.removePlayer("no-such-player")).success).toBe(false);
      const outcome = await result.current.actions.addPlayer({ playerId: "player-noah" }); // eligible, but already present
      expect(outcome).toEqual({ success: false, error: "Player is already in this report." });
    });
  });

  describe("R8-2 — addPlayer eligibility", () => {
    it("rejects a player id that is not in the eligible-player source, and leaves state unchanged", async () => {
      const { result } = renderHook(() => useSafeReportLifecycle(baseState(), COMPLETED_BY, COMPLETED_AT, ELIGIBLE_PLAYERS));
      const before = result.current.state;

      await act(async () => {
        const outcome = await result.current.actions.addPlayer({ playerId: "player-does-not-exist" });
        expect(outcome).toEqual({ success: false, error: "Selected player is not eligible for this report." });
      });
      expect(result.current.state).toEqual(before);
    });

    it("an arbitrary string that merely looks like an id is never treated as a valid Player when no eligible source is supplied", async () => {
      const { result } = renderHook(() => useSafeReportLifecycle(baseState(), COMPLETED_BY, COMPLETED_AT)); // no eligiblePlayers arg -> defaults to []
      await act(async () => {
        const outcome = await result.current.actions.addPlayer({ playerId: "player-elias" });
        expect(outcome.success).toBe(false);
      });
    });

    it("accepts an eligible player id and resolves the real name from the eligible source, never the raw id", async () => {
      const { result } = renderHook(() => useSafeReportLifecycle(baseState(), COMPLETED_BY, COMPLETED_AT, ELIGIBLE_PLAYERS));

      await act(async () => {
        const outcome = await result.current.actions.addPlayer({ playerId: "player-elias" });
        expect(outcome.success).toBe(true);
      });
      const added = result.current.state.players.find((p) => p.playerId === "player-elias");
      expect(added).toBeDefined();
      expect(added!.playerName).toBe("Elias");
      expect(added!.playerName).not.toBe("player-elias");
      expect(added!.attendanceStatus).toBe("PRESENT");
    });

    it("locked report rejects adding even an eligible player, and consumes no local id", async () => {
      const locked = baseState({ status: "LOCKED", completedBy: COMPLETED_BY, completedAt: COMPLETED_AT, timingReview: [] });
      const { result } = renderHook(() => useSafeReportLifecycle(locked, COMPLETED_BY, COMPLETED_AT, ELIGIBLE_PLAYERS));

      await act(async () => {
        const outcome = await result.current.actions.addPlayer({ playerId: "player-elias" });
        expect(outcome.success).toBe(false);
      });
      expect(result.current.state.nextLocalId).toBe(0);
      expect(result.current.state.players.some((p) => p.playerId === "player-elias")).toBe(false);
    });

    it("a rejected (ineligible) addPlayer consumes no local id — the next successful call still gets the expected sequential id", async () => {
      const { result } = renderHook(() => useSafeReportLifecycle(baseState(), COMPLETED_BY, COMPLETED_AT, ELIGIBLE_PLAYERS));

      await act(async () => {
        const rejected = await result.current.actions.addPlayer({ playerId: "player-does-not-exist" });
        expect(rejected.success).toBe(false);
      });
      await act(async () => {
        await result.current.actions.addPlayer({ playerId: "player-elias" });
      });
      const added = result.current.state.players.find((p) => p.playerId === "player-elias");
      expect(added!.id).toBe("player-local-0");
    });
  });

  describe("R8-2 — reopen target validation", () => {
    it('reopen("LOCKED") is rejected — never produces a LOCKED report with cleared completion metadata', async () => {
      const locked = baseState({ status: "LOCKED", completedBy: COMPLETED_BY, completedAt: COMPLETED_AT, timingReview: [] });
      const { result } = renderHook(() => useSafeReportLifecycle(locked, COMPLETED_BY, COMPLETED_AT));

      await act(async () => {
        // @ts-expect-error — deliberately bypassing the public "DRAFT" | "REPORTED" type to
        // exercise the reducer's own runtime guard, which is the actual protection (R8-2:
        // "TypeScript alone is not sufficient").
        const outcome = await result.current.actions.reopen("LOCKED");
        expect(outcome).toEqual({ success: false, error: '"LOCKED" is not a valid reopening target.' });
      });
      // State must be completely unchanged — never {status: "LOCKED", completedBy: null, completedAt: null}.
      expect(result.current.state.status).toBe("LOCKED");
      expect(result.current.state.completedBy).toBe(COMPLETED_BY);
      expect(result.current.state.completedAt).toBe(COMPLETED_AT);
    });

    it("reopen is rejected from DRAFT and REPORTED (not locked), leaving completion metadata unchanged", async () => {
      for (const status of ["DRAFT", "REPORTED"] as const) {
        const { result } = renderHook(() => useSafeReportLifecycle(baseState({ status }), COMPLETED_BY, COMPLETED_AT));
        await act(async () => {
          const outcome = await result.current.actions.reopen("DRAFT");
          expect(outcome).toEqual({ success: false, error: "Report is not locked." });
        });
        expect(result.current.state.status).toBe(status);
        expect(result.current.state.completedBy).toBeNull();
        expect(result.current.state.completedAt).toBeNull();
      }
    });

    it("legitimate reopening from LOCKED to DRAFT succeeds and clears completion metadata, preserving report records", async () => {
      const locked = baseState({ status: "LOCKED", completedBy: COMPLETED_BY, completedAt: COMPLETED_AT, timingReview: [] });
      const { result } = renderHook(() => useSafeReportLifecycle(locked, COMPLETED_BY, COMPLETED_AT));

      await act(async () => {
        const outcome = await result.current.actions.reopen("DRAFT");
        expect(outcome.success).toBe(true);
      });
      expect(result.current.state.status).toBe("DRAFT");
      expect(result.current.state.completedBy).toBeNull();
      expect(result.current.state.completedAt).toBeNull();
      // Report records (goals, players) are untouched by reopening.
      expect(result.current.state.goals).toEqual(locked.goals);
      expect(result.current.state.players).toEqual(locked.players);
    });

    it("legitimate reopening from LOCKED to REPORTED succeeds", async () => {
      const locked = baseState({ status: "LOCKED", completedBy: COMPLETED_BY, completedAt: COMPLETED_AT, timingReview: [] });
      const { result } = renderHook(() => useSafeReportLifecycle(locked, COMPLETED_BY, COMPLETED_AT));

      await act(async () => {
        const outcome = await result.current.actions.reopen("REPORTED");
        expect(outcome.success).toBe(true);
      });
      expect(result.current.state.status).toBe("REPORTED");
      expect(result.current.state.completedBy).toBeNull();
      expect(result.current.state.completedAt).toBeNull();
    });

    it("no sequence of actions can ever produce LOCKED with missing completion metadata", async () => {
      const { result } = renderHook(() =>
        useSafeReportLifecycle(
          baseState({ timingReview: [{ period: "SECOND_HALF", periodLabel: "Second half", resolvedDurationMinutes: 45, needsReview: false }] }),
          COMPLETED_BY,
          COMPLETED_AT,
          ELIGIBLE_PLAYERS,
        ),
      );
      await act(async () => {
        await result.current.actions.complete();
      });
      expect(result.current.state.status).toBe("LOCKED");
      expect(result.current.state.completedBy).not.toBeNull();
      expect(result.current.state.completedAt).not.toBeNull();

      await act(async () => {
        // @ts-expect-error — same deliberate runtime-guard exercise as above.
        await result.current.actions.reopen("LOCKED");
      });
      // Still LOCKED with intact metadata — the invalid call was rejected outright.
      expect(result.current.state.status).toBe("LOCKED");
      expect(result.current.state.completedBy).not.toBeNull();
      expect(result.current.state.completedAt).not.toBeNull();
    });
  });

  it("assigns deterministic, sequential local ids for successful additions — never a module-level global", async () => {
    const { result } = renderHook(() => useSafeReportLifecycle(baseState({ goals: [] }), COMPLETED_BY, COMPLETED_AT));

    await act(async () => {
      await result.current.actions.addGoal({ playerId: "player-noah", minute: 10 });
    });
    const firstId = result.current.state.goals[0]!.id;

    await act(async () => {
      await result.current.actions.addGoal({ playerId: "player-noah", minute: 20 });
    });
    const secondId = result.current.state.goals[1]!.id;

    expect(firstId).not.toBe(secondId);
    expect(firstId).toBe("goal-local-0");
    expect(secondId).toBe("goal-local-1");
  });

  it("a rejected addGoal does not consume a local id — the next successful call still gets the expected sequential id", async () => {
    const { result } = renderHook(() => useSafeReportLifecycle(baseState({ goals: [] }), COMPLETED_BY, COMPLETED_AT));

    await act(async () => {
      const rejected = await result.current.actions.addGoal({ playerId: "player-magnus" }); // NO_SHOW, rejected
      expect(rejected.success).toBe(false);
    });
    await act(async () => {
      await result.current.actions.addGoal({ playerId: "player-noah", minute: 12 });
    });
    expect(result.current.state.goals[0]!.id).toBe("goal-local-0");
  });

  it("replaying the identical action sequence from two fresh instances produces byte-identical state", async () => {
    async function runSequence() {
      const { result } = renderHook(() => useSafeReportLifecycle(baseState({ goals: [] }), COMPLETED_BY, COMPLETED_AT));
      await act(async () => {
        await result.current.actions.confirmPeriodTiming!("SECOND_HALF");
        await result.current.actions.addGoal({ playerId: "player-noah", minute: 34 });
        await result.current.actions.complete();
      });
      return result.current.state;
    }

    const first = await runSequence();
    const second = await runSequence();
    expect(first).toEqual(second);
  });
});
