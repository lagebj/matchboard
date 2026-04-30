"use client";

import { X, ArrowRight, ArrowLeft, ShieldCheck, TrendingDown } from "lucide-react";
import { RoleBadge, type SelectionRole } from "@/components/ui/role-badge";

type ExplanationItem = {
  code: string;
  summary: string;
  details?: string;
  hardRule?: boolean;
};

type InspectorPlayer = {
  playerId: string;
  playerName: string;
  coreTeamName: string;
  playerPosition: string;
  selectionCategory: SelectionRole | "REDUCED_MATCH_LOAD_DROP" | "CORE_MATCH_DROP" | "UNAVAILABLE";
  selectionReason: string;
  explanations: ExplanationItem[];
  priorityScore: number | null;
  manualOverride: boolean;
};

type InspectorPanelProps = {
  player?: InspectorPlayer | null;
  matchContext?: {
    teamName: string;
    opponent: string;
    matchDate: Date;
  };
  onClose: () => void;
};

function DirectionIcon({ category }: { category: InspectorPlayer["selectionCategory"] }) {
  if (category === "SUPPORT" || category === "DEVELOPMENT" || category === "CONFIDENCE_REBUILD") {
    return <ArrowRight className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />;
  }
  if (category === "BACKFILL") {
    return <ArrowLeft className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />;
  }
  if (category === "CORE" || category === "MANUAL") {
    return <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />;
  }
  return <TrendingDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />;
}

export function InspectorPanel({ player, matchContext, onClose }: InspectorPanelProps) {
  const isOpen = player !== null && player !== undefined;

  return (
    <aside className={`fixed right-0 top-0 z-40 h-screen w-[var(--inspector-width)] flex-col border-l border-[var(--border-soft)] bg-[var(--surface-base)] transition-transform duration-200 ${isOpen ? "translate-x-0 flex" : "translate-x-full hidden"}`}>
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-100">Inspector</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-[var(--text-muted)] hover:text-zinc-100 hover:bg-[var(--surface-hover)] transition-colors"
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!player ? (
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="text-sm text-[var(--text-muted)]">Select a player to inspect</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-3">
          {matchContext && (
            <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
              <p className="text-xs font-medium text-zinc-300">{matchContext.teamName} vs {matchContext.opponent}</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {matchContext.matchDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </p>
            </div>
          )}

          <div>
            <p className="text-base font-semibold text-zinc-50">{player.playerName}</p>
            <p className="text-xs text-[var(--text-muted)]">{player.playerPosition} · {player.coreTeamName}</p>
          </div>

          <div className="flex items-center gap-2">
            <RoleBadge role={player.selectionCategory} />
            <DirectionIcon category={player.selectionCategory} />
          </div>

          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2">
            <p className="text-xs font-medium text-zinc-300 mb-1">Selection reason</p>
            <p className="text-sm text-zinc-100 leading-snug">{player.selectionReason}</p>
          </div>

          {player.manualOverride && (
            <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2">
              <p className="text-xs font-semibold text-amber-300">Manual override applied</p>
            </div>
          )}

          {player.priorityScore !== null && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">Priority score</span>
              <span className="text-sm font-mono tabular-nums text-zinc-200">{player.priorityScore.toFixed(1)}</span>
            </div>
          )}

          {player.explanations.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-zinc-300">Explanations</p>
              {player.explanations.map((exp, i) => (
                <div
                  key={`${exp.code}-${i}`}
                  className={`rounded-lg border px-3 py-2 ${
                    exp.hardRule
                      ? "border-red-700/40 bg-red-900/10"
                      : "border-[var(--border-soft)] bg-[var(--surface-muted)]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">{exp.code}</span>
                    {exp.hardRule && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Hard rule</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-200 leading-snug">{exp.summary}</p>
                  {exp.details && (
                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-snug">{exp.details}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}