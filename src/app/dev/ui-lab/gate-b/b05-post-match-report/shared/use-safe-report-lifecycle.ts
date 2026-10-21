"use client";

import { useState, useCallback } from "react";
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
};

type Result = { success: boolean; error?: string };
const ok = (): Promise<Result> => Promise.resolve({ success: true });
const fail = (error: string): Promise<Result> => Promise.resolve({ success: false, error });

let localIdCounter = 0;
function nextLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}-local-${localIdCounter}`;
}

export function useSafeReportLifecycle(initial: SafeReportLocalState, completedBy: string) {
  const [state, setState] = useState<SafeReportLocalState>(initial);

  const reset = useCallback(() => setState(initial), [initial]);

  const actions: PostMatchReportActions = {
    updateResult: ({ ourScore, opponentScore }) => {
      setState((s) => ({ ...s, ourScore: ourScore ?? s.ourScore, opponentScore: opponentScore ?? s.opponentScore }));
      return ok();
    },
    addGoal: ({ playerId, minute }) => {
      if (state.status === "LOCKED") return fail("Report is locked.");
      const playerName = playerId ? state.players.find((p) => p.playerId === playerId)?.playerName ?? null : null;
      setState((s) => ({ ...s, goals: [...s.goals, { id: nextLocalId("goal"), playerId: playerId ?? null, playerName, minute: minute ?? null }] }));
      return ok();
    },
    removeGoal: (goalId) => {
      setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== goalId) }));
      return ok();
    },
    addAssist: ({ playerId }) => {
      const playerName = state.players.find((p) => p.playerId === playerId)?.playerName ?? null;
      setState((s) => ({ ...s, assists: [...s.assists, { id: nextLocalId("assist"), playerId, playerName }] }));
      return ok();
    },
    removeAssist: (assistId) => {
      setState((s) => ({ ...s, assists: s.assists.filter((a) => a.id !== assistId) }));
      return ok();
    },
    updateAttendance: (playerReportId, status) => {
      setState((s) => ({ ...s, players: s.players.map((p) => (p.id === playerReportId ? { ...p, attendanceStatus: status } : p)) }));
      return ok();
    },
    addPlayer: ({ playerId }) => {
      setState((s) => ({ ...s, players: [...s.players, { id: nextLocalId("player"), playerId, playerName: playerId, attendanceStatus: "PRESENT" }] }));
      return ok();
    },
    removePlayer: (playerReportId) => {
      setState((s) => ({ ...s, players: s.players.filter((p) => p.id !== playerReportId) }));
      return ok();
    },
    // The real completion gate, genuinely enforced: a period still needing timing review blocks
    // completion, exactly like `getTimingSubmissionBlockers()` does in production.
    complete: () => {
      const blockers = state.timingReview.filter((t) => t.needsReview);
      if (blockers.length > 0) {
        return fail(`Cannot complete report: ${blockers.map((b) => `${b.periodLabel} timing still needs review.`).join(" ")}`);
      }
      if (state.outOfRangeEventCount > 0) {
        return fail("Cannot complete report: some events fall outside their period's resolved duration.");
      }
      setState((s) => ({ ...s, status: "LOCKED", completedBy, completedAt: new Date().toISOString() }));
      return ok();
    },
    reopen: (target) => {
      setState((s) => ({ ...s, status: target ?? "DRAFT", completedBy: null, completedAt: null }));
      return ok();
    },
    confirmPeriodTiming: (period) => {
      setState((s) => ({ ...s, timingReview: s.timingReview.map((t) => (t.period === period ? { ...t, needsReview: false } : t)) }));
      return ok();
    },
    correctPeriodTiming: (period, minutes) => {
      setState((s) => ({
        ...s,
        timingReview: s.timingReview.map((t) => (t.period === period ? { ...t, needsReview: false, resolvedDurationMinutes: minutes } : t)),
      }));
      return ok();
    },
  };

  return { state, actions, reset };
}
