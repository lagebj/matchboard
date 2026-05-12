"use client";

import type { CrossTeamImpact } from "@/domain/assistant-manager/types";

function impactDot(level: string): string {
  switch (level) {
    case "HIGH": return "text-red-400";
    case "MEDIUM": return "text-amber-400";
    case "LOW": return "text-zinc-400";
    default: return "text-zinc-400";
  }
}

type CrossTeamImpactPanelProps = {
  impacts: CrossTeamImpact[];
};

export function CrossTeamImpactPanel({ impacts }: CrossTeamImpactPanelProps) {
  if (impacts.length === 0) return null;

  return (
    <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Cross-team impact</p>
      <div className="mt-2 flex flex-col gap-3">
        {impacts.map((impact, i) => (
          <div key={i} className="rounded-md border border-zinc-700/30 bg-zinc-800/15 p-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-200">{impact.sourceTeamId}</span>
              <span className="text-[10px] text-zinc-500">→</span>
              <span className="text-xs text-zinc-200">{impact.targetTeamId}</span>
              <span className="text-[10px] text-zinc-500">(player {impact.playerId})</span>
              <span className={`text-[10px] font-semibold uppercase ${impactDot(impact.impactLevel)}`}>{impact.impactLevel}</span>
            </div>
            <p className="text-[11px] text-zinc-300 mt-1">{impact.summary}</p>
            <div className="mt-1 grid grid-cols-2 gap-x-3 text-[10px]">
              {impact.positiveEffects.length > 0 && (
                <div>
                  <p className="text-zinc-500">Positive</p>
                  {impact.positiveEffects.map((e, j) => <p key={j} className="text-emerald-400">{e}</p>)}
                </div>
              )}
              {impact.negativeEffects.length > 0 && (
                <div>
                  <p className="text-zinc-500">Negative</p>
                  {impact.negativeEffects.map((e, j) => <p key={j} className="text-red-400">{e}</p>)}
                </div>
              )}
            </div>
            <div className="mt-1 flex gap-3 text-[10px] text-zinc-500">
              <span>Fairness: {impact.fairnessImpact}</span>
              <span>Load: {impact.loadImpact}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}