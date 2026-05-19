"use client";

import { useTransition } from "react";
import { MATCHDAY_RESPONSIBILITY_DESCRIPTIONS, MATCHDAY_RESPONSIBILITIES, type MatchdayResponsibilityType } from "@/lib/coaching/types";

type MatchdayResponsibilitySelectorProps = {
  selectionId: string;
  currentResponsibility?: string | null;
  status: string;
};

const RESPONSIBILITY_ABBR: Record<string, string> = {
  STABILIZER: "ST",
  CONNECTOR: "CN",
  RECOVERY_LEADER: "RL",
  WIDTH_HOLDER: "WH",
  CHALLENGE_PLAYER: "CH",
  CONFIDENCE_REBUILD_PLAYER: "CR",
};

export function MatchdayResponsibilitySelector({
  selectionId,
  currentResponsibility,
  status,
}: MatchdayResponsibilitySelectorProps) {
  const [isPending, startTransition] = useTransition();

  const isFinalized = status === "FINALIZED";

  function handleChange(responsibility: string) {
    startTransition(async () => {
      const { setMatchdayResponsibilityAction } = await import(
        "@/app/(app)/matches/[matchId]/coaching-actions/responsibility-actions"
      );
      await setMatchdayResponsibilityAction(selectionId, responsibility || null);
    });
  }

  function handleClear() {
    startTransition(async () => {
      const { removeMatchdayResponsibilityAction } = await import(
        "@/app/(app)/matches/[matchId]/coaching-actions/responsibility-actions"
      );
      await removeMatchdayResponsibilityAction(selectionId);
    });
  }

  if (isFinalized) {
    if (!currentResponsibility) return null;
    return (
      <span
        className="text-[8px] text-blue-400 cursor-default"
        title={MATCHDAY_RESPONSIBILITY_DESCRIPTIONS[currentResponsibility as MatchdayResponsibilityType]}
      >
        {RESPONSIBILITY_ABBR[currentResponsibility] ?? currentResponsibility}
      </span>
    );
  }

  return (
    <select
      className="text-[9px] bg-transparent border border-zinc-700/50 rounded px-0.5 py-0 text-blue-400 hover:border-blue-500/50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 max-w-[60px]"
      value={currentResponsibility ?? ""}
      onChange={(e) => {
        if (e.target.value) {
          handleChange(e.target.value);
        } else {
          handleClear();
        }
      }}
      disabled={isPending}
      title={currentResponsibility ? MATCHDAY_RESPONSIBILITY_DESCRIPTIONS[currentResponsibility as MatchdayResponsibilityType] : "Assign matchday responsibility"}
    >
      <option value="">—</option>
      {MATCHDAY_RESPONSIBILITIES.map((r) => (
        <option key={r} value={r} title={MATCHDAY_RESPONSIBILITY_DESCRIPTIONS[r]}>
          {RESPONSIBILITY_ABBR[r] ?? r}
        </option>
      ))}
    </select>
  );
}