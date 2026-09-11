"use client";

import type { RuleImpact } from "@/domain/assistant-manager/types";

function signalDot(category: string): string {
  switch (category) {
    case "BLOCKED": return "w-2 h-2 rounded-full bg-[var(--danger)] shrink-0";
    case "DECISION_REQUIRED": return "w-2 h-2 rounded-full bg-[var(--warning)] shrink-0";
    case "PLANNING_NOTE": return "w-2 h-2 rounded-full bg-[var(--text-muted)] shrink-0";
    default: return "w-2 h-2 rounded-full bg-[var(--text-muted)] shrink-0";
  }
}

type RuleImpactPanelProps = {
  ruleImpacts: RuleImpact[];
};

export function RuleImpactPanel({ ruleImpacts }: RuleImpactPanelProps) {
  if (ruleImpacts.length === 0) return null;

  return (
    <div className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Rules involved</p>
      <div className="mt-2 flex flex-col gap-2">
        {ruleImpacts.map((rule) => (
          <div key={rule.ruleId} className="flex items-start gap-2">
            {/* signalDot() returned a class string that was previously rendered as bare text
                content instead of a className — the dot never actually rendered. Fixed
                incidentally while migrating this file's colors to tokens. */}
            <div className={`mt-1.5 ${signalDot(rule.signalCategory)}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--foreground)]">{rule.ruleName}</p>
              <p className="text-[11px] text-[var(--text-muted)]">{rule.effect}</p>
              {rule.explanation && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{rule.explanation}</p>}
              {rule.affectedPlayerIds.length > 0 && (
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Players: {rule.affectedPlayerIds.join(", ")}</p>
              )}
              {rule.affectedTeamIds.length > 0 && (
                <p className="text-[10px] text-[var(--text-muted)]">Teams: {rule.affectedTeamIds.join(", ")}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}