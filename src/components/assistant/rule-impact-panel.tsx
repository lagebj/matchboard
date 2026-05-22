"use client";

import type { RuleImpact } from "@/domain/assistant-manager/types";

function signalDot(category: string): string {
  switch (category) {
    case "BLOCKED": return "w-2 h-2 rounded-full bg-red-400 shrink-0";
    case "DECISION_REQUIRED": return "w-2 h-2 rounded-full bg-amber-400 shrink-0";
    case "PLANNING_NOTE": return "w-2 h-2 rounded-full bg-zinc-400 shrink-0";
    default: return "w-2 h-2 rounded-full bg-zinc-400 shrink-0";
  }
}

type RuleImpactPanelProps = {
  ruleImpacts: RuleImpact[];
};

export function RuleImpactPanel({ ruleImpacts }: RuleImpactPanelProps) {
  if (ruleImpacts.length === 0) return null;

  return (
    <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Rules involved</p>
      <div className="mt-2 flex flex-col gap-2">
        {ruleImpacts.map((rule) => (
          <div key={rule.ruleId} className="flex items-start gap-2">
            <div className="mt-1.5">{signalDot(rule.signalCategory)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-200">{rule.ruleName}</p>
              <p className="text-[11px] text-zinc-400">{rule.effect}</p>
              {rule.explanation && <p className="text-[10px] text-zinc-500 mt-0.5">{rule.explanation}</p>}
              {rule.affectedPlayerIds.length > 0 && (
                <p className="text-[10px] text-zinc-500 mt-0.5">Players: {rule.affectedPlayerIds.join(", ")}</p>
              )}
              {rule.affectedTeamIds.length > 0 && (
                <p className="text-[10px] text-zinc-500">Teams: {rule.affectedTeamIds.join(", ")}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}