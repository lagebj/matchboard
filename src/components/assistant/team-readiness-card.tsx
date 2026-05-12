"use client";

import Link from "next/link";
import type { TeamReadiness } from "@/domain/assistant-manager/types";
import { getReadinessClasses } from "@/domain/assistant-manager/mock-data";

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
    <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{readiness.teamName || readiness.teamId}</span>
          <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${getReadinessClasses(readiness.readinessState)}`}>
            {readinessLabel(readiness.readinessState)}
          </span>
        </div>
        <Link href={`/teams/${readiness.teamId}/review`} className="text-[10px] text-zinc-500 hover:text-zinc-300">
          Review
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <span className="text-zinc-500">Confirmed</span>
        <span className="text-zinc-200">{readiness.confirmedPlayers}/{readiness.targetSquadSize}</span>
        {readiness.unknownRsvp > 0 && (
          <>
            <span className="text-zinc-500">Unknown RSVP</span>
            <span className="text-amber-400">{readiness.unknownRsvp}</span>
          </>
        )}
        {readiness.unavailablePlayers > 0 && (
          <>
            <span className="text-zinc-500">Unavailable</span>
            <span className="text-red-400">{readiness.unavailablePlayers}</span>
          </>
        )}
        {readiness.blockedPlayers > 0 && (
          <>
            <span className="text-zinc-500">Blocked</span>
            <span className="text-red-400">{readiness.blockedPlayers}</span>
          </>
        )}
        {readiness.supportNeeded > 0 && (
          <>
            <span className="text-zinc-500">Support needed</span>
            <span className="text-amber-300">{readiness.supportNeeded}</span>
          </>
        )}
        {readiness.positionGaps.length > 0 && (
          <>
            <span className="text-zinc-500">Position gaps</span>
            <span className="text-zinc-300">{readiness.positionGaps.join(", ")}</span>
          </>
        )}
        <span className="text-zinc-500">Pressure</span>
        <span className={readiness.rotationPressure === "HIGH" ? "text-amber-300" : readiness.rotationPressure === "MEDIUM" ? "text-blue-300" : "text-zinc-300"}>
          {readiness.rotationPressure}
        </span>
      </div>
      {readiness.warnings.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5">
          {readiness.warnings.map((w, i) => (
            <p key={i} className="text-[10px] text-amber-400">{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}