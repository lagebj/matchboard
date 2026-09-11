"use client";

import Link from "next/link";
import type { TeamReadiness } from "@/domain/assistant-manager/types";
import { getReadinessClasses } from "@/domain/assistant-manager/utils/issue-grouping";

function readinessLabel(state: string): string {
  switch (state) {
    case "READY": return "Ready";
    case "WATCH": return "Watch";
    case "AT_RISK": return "At risk";
    case "NOT_PLAYABLE": return "Not playable";
    default: return state;
  }
}

type TeamReadinessCardProps = {
  readiness: TeamReadiness;
};

export function TeamReadinessCard({ readiness }: TeamReadinessCardProps) {
  return (
    <div className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">{readiness.teamName || readiness.teamId}</span>
          <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${getReadinessClasses(readiness.readinessState)}`}>
            {readinessLabel(readiness.readinessState)}
          </span>
        </div>
        <Link href={`/teams/${readiness.teamId}/review`} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-soft)]">
          Review
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <span className="text-[var(--text-muted)]">Confirmed</span>
        <span className="text-[var(--foreground)]">{readiness.confirmedPlayers}/{readiness.targetSquadSize}</span>
        {readiness.unknownRsvp > 0 && (
          <>
            <span className="text-[var(--text-muted)]">Unknown RSVP</span>
            <span className="text-[var(--warning)]">{readiness.unknownRsvp}</span>
          </>
        )}
        {readiness.unavailablePlayers > 0 && (
          <>
            <span className="text-[var(--text-muted)]">Unavailable</span>
            <span className="text-[var(--danger)]">{readiness.unavailablePlayers}</span>
          </>
        )}
        {readiness.blockedPlayers > 0 && (
          <>
            <span className="text-[var(--text-muted)]">Blocked</span>
            <span className="text-[var(--danger)]">{readiness.blockedPlayers}</span>
          </>
        )}
        {readiness.supportNeeded > 0 && (
          <>
            <span className="text-[var(--text-muted)]">Support needed</span>
            <span className="text-[var(--warning)]">{readiness.supportNeeded}</span>
          </>
        )}
        {readiness.positionGaps.length > 0 && (
          <>
            <span className="text-[var(--text-muted)]">Position gaps</span>
            <span className="text-[var(--text-soft)]">{readiness.positionGaps.join(", ")}</span>
          </>
        )}
        <span className="text-[var(--text-muted)]">Pressure</span>
        <span className={readiness.rotationPressure === "HIGH" ? "text-[var(--warning)]" : readiness.rotationPressure === "MEDIUM" ? "text-[var(--info)]" : "text-[var(--text-soft)]"}>
          {readiness.rotationPressure}
        </span>
      </div>
      {readiness.signals.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5">
          {readiness.signals.map((s, i) => (
            <p key={i} className="text-[10px] text-[var(--warning)]">{s}</p>
          ))}
        </div>
      )}
    </div>
  );
}