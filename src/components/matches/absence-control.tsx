"use client";

import { useTransition } from "react";
import type { PlannedAbsenceReason } from "@/generated/prisma/client";

type AbsenceControlProps = {
  matchId: string;
  playerId: string;
  currentReason?: string | null;
  isLocked: boolean;
};

const ABSENCE_REASON_LABELS: Record<string, string> = {
  AWAY: "Away",
  SICK: "Sick",
  NO_SHOW: "No-show",
  DECLINED: "Declined",
  INJURED: "Injured",
  OTHER: "Other",
};

const ABSENCE_REASONS: PlannedAbsenceReason[] = ["AWAY", "SICK", "NO_SHOW", "DECLINED", "INJURED", "OTHER"];

/**
 * Match-specific player absence control (production consistency pass item #3). Marks/clears an
 * assigned player's participation state for THIS match only — the round/team assignment
 * (Selection row) is never touched. Available before or around kick-off, not only after the
 * match. Once the report is locked, use the existing post-match correction mechanism instead.
 */
export function AbsenceControl({ matchId, playerId, currentReason, isLocked }: AbsenceControlProps) {
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    startTransition(async () => {
      if (!value) {
        const { clearMatchAbsenceAction } = await import("@/app/(app)/matches/absence-actions");
        await clearMatchAbsenceAction(matchId, playerId);
        return;
      }
      const { markMatchAbsenceAction } = await import("@/app/(app)/matches/absence-actions");
      await markMatchAbsenceAction(matchId, playerId, value as PlannedAbsenceReason);
    });
  }

  if (isLocked) {
    if (!currentReason) return null;
    return (
      <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--danger)]" title="Match-specific absence">
        {ABSENCE_REASON_LABELS[currentReason] ?? currentReason}
      </span>
    );
  }

  return (
    <select
      className="text-[9px] bg-transparent border border-zinc-700/50 rounded px-0.5 py-0 text-[var(--danger)] hover:border-red-500/50 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30 disabled:opacity-50 max-w-[80px]"
      value={currentReason ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      title={currentReason ? `Marked ${ABSENCE_REASON_LABELS[currentReason] ?? currentReason} for this match` : "Mark absent for this match"}
    >
      <option value="">Present</option>
      {ABSENCE_REASONS.map((r) => (
        <option key={r} value={r}>{ABSENCE_REASON_LABELS[r]}</option>
      ))}
    </select>
  );
}
