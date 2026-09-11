"use client";

import type { CrossTeamImpact } from "@/domain/assistant-manager/types";

function impactDot(level: string): string {
  switch (level) {
    case "HIGH": return "text-[var(--danger)]";
    case "MEDIUM": return "text-[var(--warning)]";
    case "LOW": return "text-[var(--text-muted)]";
    default: return "text-[var(--text-muted)]";
  }
}

type CrossTeamImpactPanelProps = {
  impacts: CrossTeamImpact[];
};

export function CrossTeamImpactPanel({ impacts }: CrossTeamImpactPanelProps) {
  if (impacts.length === 0) return null;

  return (
    <div className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Cross-team impact</p>
      <div className="mt-2 flex flex-col gap-3">
        {impacts.map((impact, i) => (
          <div key={i} className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--foreground)]">{impact.sourceTeamId}</span>
              <span className="text-[10px] text-[var(--text-muted)]">→</span>
              <span className="text-xs text-[var(--foreground)]">{impact.targetTeamId}</span>
              <span className="text-[10px] text-[var(--text-muted)]">(player {impact.playerId})</span>
              <span className={`text-[10px] font-semibold uppercase ${impactDot(impact.impactLevel)}`}>{impact.impactLevel}</span>
            </div>
            <p className="text-[11px] text-[var(--text-soft)] mt-1">{impact.summary}</p>
            <div className="mt-1 grid grid-cols-2 gap-x-3 text-[10px]">
              {impact.positiveEffects.length > 0 && (
                <div>
                  <p className="text-[var(--text-muted)]">Positive</p>
                  {impact.positiveEffects.map((e, j) => <p key={j} className="text-[var(--success)]">{e}</p>)}
                </div>
              )}
              {impact.negativeEffects.length > 0 && (
                <div>
                  <p className="text-[var(--text-muted)]">Negative</p>
                  {impact.negativeEffects.map((e, j) => <p key={j} className="text-[var(--danger)]">{e}</p>)}
                </div>
              )}
            </div>
            <div className="mt-1 flex gap-3 text-[10px] text-[var(--text-muted)]">
              <span>Fairness: {impact.fairnessImpact}</span>
              <span>Load: {impact.loadImpact}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}