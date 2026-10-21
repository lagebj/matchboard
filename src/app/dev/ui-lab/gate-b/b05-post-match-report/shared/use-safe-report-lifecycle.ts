"use client";

import { useState, useCallback, useRef } from "react";
import type { PostMatchReportActions, PostMatchReportTimingReviewRow } from "@/lib/reports/post-match-report-view-model";

/**
 * B2-R3/B2-R5 remediation — a deterministic, fixture-local lifecycle simulation that genuinely
 * enforces the real `completeReport()` gate (`getTimingSubmissionBlockers()`: any period with
 * `needsReview: true`, or any out-of-range event, blocks completion) entirely in React state,
 * never calling a production server action. Every mutation is a plain, synchronous state update
 * wrapped in a resolved Promise — no database, no network, no cross-tenant access.
 *
 * This exists because the real `PostMatchPage` (`src/components/assistant/post-match-page.tsx`)
 * imports its mutation functions directly from `@/app/(app)/matches/[matchId]/post-match/
 * actions` at module scope, with no prop-based override seam — a UI Lab candidate that rendered
 * it directly would have every "Add goal"/"Complete report"/etc. control wired to a real
 * database write against a synthetic match id. See BLOCKERS.md for the verified finding and the
 * production-seam gap this is tracked against separately.
 *
 * B5/R3 remediation — every mutation now routes through one central `validate()` dispatcher
 * before any state change. A rejected operation returns an explicit failure and leaves `state`
 * byte-for-byte unchanged: no local id is consumed, no derived data moves, no false success is
 * reported. `nextLocalId` lives IN `state` (not a module-level `let`), and `complete()` stamps a
 * caller-supplied, fixed `completedAt` rather than `Date.now()` — the same action sequence run
 * twice, from two fresh mounts, now produces byte-identical results every time.
 */

export type SafeReportLocalState = {
  status: "DRAFT" | "REPORTED" | "LOCKED";
  ourScore: number;
  opponentScore: number;
  goals: { id: string; playerId: string | null; playerName: string | null; minute: number | null }[];
  assists: { id: string; playerId: string; playerName: string | null }[];
  players: { id: string; playerId: string; playerName: string; attendanceStatus: string; meta?: string }[];
  timingReview: PostMatchReportTimingReviewRow[];
  outOfRangeEventCount: number;
  completedBy: string | null;
  completedAt: string | null;
  /** B5/R3: the deterministic local-id counter, scoped to this fixture instance's own state —
   * never a module-level global that could leak sequence position across mounts/tests/replays. */
  nextLocalId: number;
};

type Result = { success: boolean; error?: string };
const MAX_MATCH_MINUTE = 120;
const ATTENDANCE_STATUSES = new Set(["PRESENT", "NO_SHOW", "UNKNOWN"]);

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * One central validation dispatcher (B5/R3) — every mutation handler funnels through this
 * before `setState` is ever called, so lifecycle/input rules are enforced independently of
 * which UI control is visible. Returns the next state AND the result together: on failure,
 * `nextState === state` (the exact same reference), so a rejected call is structurally
 * incapable of mutating anything, incrementing the id counter, or touching derived data.
 */
function reduce(
  state: SafeReportLocalState,
  action: { type: string; payload?: unknown },
  completedBy: string,
  completedAt: string,
): { nextState: SafeReportLocalState; result: Result } {
  const reject = (error: string): { nextState: SafeReportLocalState; result: Result } => ({
    nextState: state,
    result: { success: false, error },
  });
  const accept = (nextState: SafeReportLocalState): { nextState: SafeReportLocalState; result: Result } => ({
    nextState,
    result: { success: true },
  });
  const requireEditable = (): string | null => (state.status === "LOCKED" ? "Report is locked." : null);
  const findPlayer = (playerId: string) => state.players.find((p) => p.playerId === playerId);
  const takeLocalId = (prefix: string): { id: string; nextCounter: number } => ({
    id: `${prefix}-local-${state.nextLocalId}`,
    nextCounter: state.nextLocalId + 1,
  });

  switch (action.type) {
    case "updateResult": {
      const lockedError = requireEditable();
      if (lockedError) return reject(lockedError);
      const { ourScore, opponentScore } = action.payload as { ourScore?: number; opponentScore?: number };
      if (ourScore !== undefined && !isNonNegativeInteger(ourScore)) return reject("Score must be a nonnegative whole number.");
      if (opponentScore !== undefined && !isNonNegativeInteger(opponentScore)) return reject("Score must be a nonnegative whole number.");
      return accept({ ...state, ourScore: ourScore ?? state.ourScore, opponentScore: opponentScore ?? state.opponentScore });
    }

    case "addGoal": {
      const lockedError = requireEditable();
      if (lockedError) return reject(lockedError);
      const { playerId, minute } = action.payload as { playerId?: string; minute?: number };
      if (playerId) {
        const player = findPlayer(playerId);
        if (!player) return reject("Selected scorer is not in this report's roster.");
        if (player.attendanceStatus !== "PRESENT") return reject("Selected scorer was not recorded as present.");
      }
      if (minute !== undefined && (!isNonNegativeInteger(minute) || minute > MAX_MATCH_MINUTE)) {
        return reject(`Minute must be between 0 and ${MAX_MATCH_MINUTE}.`);
      }
      const { id, nextCounter } = takeLocalId("goal");
      const playerName = playerId ? findPlayer(playerId)?.playerName ?? null : null;
      return accept({
        ...state,
        goals: [...state.goals, { id, playerId: playerId ?? null, playerName, minute: minute ?? null }],
        nextLocalId: nextCounter,
      });
    }

    case "removeGoal": {
      const lockedError = requireEditable();
      if (lockedError) return reject(lockedError);
      const goalId = action.payload as string;
      if (!state.goals.some((g) => g.id === goalId)) return reject("Goal not found.");
      return accept({ ...state, goals: state.goals.filter((g) => g.id !== goalId) });
    }

    case "addAssist": {
      const lockedError = requireEditable();
      if (lockedError) return reject(lockedError);
      const { playerId } = action.payload as { playerId: string };
      const player = findPlayer(playerId);
      if (!player) return reject("Selected provider is not in this report's roster.");
      if (player.attendanceStatus !== "PRESENT") return reject("Selected provider was not recorded as present.");
      const { id, nextCounter } = takeLocalId("assist");
      return accept({
        ...state,
        assists: [...state.assists, { id, playerId, playerName: player.playerName }],
        nextLocalId: nextCounter,
      });
    }

    case "removeAssist": {
      const lockedError = requireEditable();
      if (lockedError) return reject(lockedError);
      const assistId = action.payload as string;
      if (!state.assists.some((a) => a.id === assistId)) return reject("Assist not found.");
      return accept({ ...state, assists: state.assists.filter((a) => a.id !== assistId) });
    }

    case "updateAttendance": {
      const lockedError = requireEditable();
      if (lockedError) return reject(lockedError);
      const { playerReportId, status } = action.payload as { playerReportId: string; status: string };
      if (!state.players.some((p) => p.id === playerReportId)) return reject("Player not found in this report.");
      if (!ATTENDANCE_STATUSES.has(status)) return reject(`Unsupported attendance status: ${status}.`);
      return accept({
        ...state,
        players: state.players.map((p) => (p.id === playerReportId ? { ...p, attendanceStatus: status } : p)),
      });
    }

    case "addPlayer": {
      const lockedError = requireEditable();
      if (lockedError) return reject(lockedError);
      const { playerId } = action.payload as { playerId: string };
      if (!playerId) return reject("No player selected.");
      if (state.players.some((p) => p.playerId === playerId)) return reject("Player is already in this report.");
      const { id, nextCounter } = takeLocalId("player");
      return accept({
        ...state,
        players: [...state.players, { id, playerId, playerName: playerId, attendanceStatus: "PRESENT" }],
        nextLocalId: nextCounter,
      });
    }

    case "removePlayer": {
      const lockedError = requireEditable();
      if (lockedError) return reject(lockedError);
      const playerReportId = action.payload as string;
      if (!state.players.some((p) => p.id === playerReportId)) return reject("Player not found in this report.");
      return accept({ ...state, players: state.players.filter((p) => p.id !== playerReportId) });
    }

    case "complete": {
      if (state.status === "LOCKED") return reject("Report is already locked.");
      // The real completion gate, genuinely enforced: a period still needing timing review
      // blocks completion, exactly like `getTimingSubmissionBlockers()` does in production.
      // Deliberately does NOT also require goal-attribution reconciliation — the real
      // `completeReport()` has no such blocker either (see BLOCKERS.md / DATA_TRUTH_AND_FIXTURES.md).
      const blockers = state.timingReview.filter((t) => t.needsReview);
      if (blockers.length > 0) {
        return reject(`Cannot complete report: ${blockers.map((b) => `${b.periodLabel} timing still needs review.`).join(" ")}`);
      }
      if (state.outOfRangeEventCount > 0) {
        return reject("Cannot complete report: some events fall outside their period's resolved duration.");
      }
      return accept({ ...state, status: "LOCKED", completedBy, completedAt });
    }

    case "reopen": {
      if (state.status !== "LOCKED") return reject("Report is not locked.");
      const target = (action.payload as SafeReportLocalState["status"] | undefined) ?? "DRAFT";
      return accept({ ...state, status: target, completedBy: null, completedAt: null });
    }

    case "confirmPeriodTiming": {
      const lockedError = requireEditable();
      if (lockedError) return reject(lockedError);
      const period = action.payload as string;
      if (!state.timingReview.some((t) => t.period === period)) return reject("Period not found.");
      return accept({
        ...state,
        timingReview: state.timingReview.map((t) => (t.period === period ? { ...t, needsReview: false } : t)),
      });
    }

    case "correctPeriodTiming": {
      const lockedError = requireEditable();
      if (lockedError) return reject(lockedError);
      const { period, minutes } = action.payload as { period: string; minutes: number };
      if (!state.timingReview.some((t) => t.period === period)) return reject("Period not found.");
      if (!isNonNegativeInteger(minutes) || minutes <= 0 || minutes > MAX_MATCH_MINUTE) {
        return reject(`Duration must be between 1 and ${MAX_MATCH_MINUTE} minutes.`);
      }
      return accept({
        ...state,
        timingReview: state.timingReview.map((t) => (t.period === period ? { ...t, needsReview: false, resolvedDurationMinutes: minutes } : t)),
      });
    }

    default:
      return reject(`Unsupported action: ${action.type}`);
  }
}

export function useSafeReportLifecycle(initial: SafeReportLocalState, completedBy: string, completedAt: string) {
  const [state, setState] = useState<SafeReportLocalState>(initial);
  // React does not guarantee a setState updater function runs synchronously within the same
  // call frame (observed directly: under automatic batching, the "eager state" computation can
  // be deferred past the point where a caller reads it back). `stateRef` is a synchronous mirror
  // kept current on every render AND updated immediately inside `dispatch` itself, so validation
  // always reads the true latest state and the returned `Result` is never stale — correctness
  // here does not depend on any React scheduling internal.
  const stateRef = useRef(state);
  stateRef.current = state;

  const reset = useCallback(() => setState(initial), [initial]);

  const dispatch = useCallback(
    (type: string, payload?: unknown): Promise<Result> => {
      const outcome = reduce(stateRef.current, { type, payload }, completedBy, completedAt);
      stateRef.current = outcome.nextState;
      setState(outcome.nextState);
      return Promise.resolve(outcome.result);
    },
    [completedBy, completedAt],
  );

  const actions: PostMatchReportActions = {
    updateResult: (data) => dispatch("updateResult", data),
    addGoal: (data) => dispatch("addGoal", data),
    removeGoal: (goalId) => dispatch("removeGoal", goalId),
    addAssist: (data) => dispatch("addAssist", data),
    removeAssist: (assistId) => dispatch("removeAssist", assistId),
    updateAttendance: (playerReportId, status) => dispatch("updateAttendance", { playerReportId, status }),
    addPlayer: (data) => dispatch("addPlayer", data),
    removePlayer: (playerReportId) => dispatch("removePlayer", playerReportId),
    complete: () => dispatch("complete"),
    reopen: (target) => dispatch("reopen", target),
    confirmPeriodTiming: (period) => dispatch("confirmPeriodTiming", period),
    correctPeriodTiming: (period, minutes) => dispatch("correctPeriodTiming", { period, minutes }),
  };

  return { state, actions, reset };
}
