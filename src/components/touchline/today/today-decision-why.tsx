/**
 * Today primary-action "Why?" disclosure (ADR-0157 §6, `03_SHARED_DECISION_EVIDENCE_CONTRACT.md`
 * "Why? disclosure"). Always-visible, inline — matching the existing `TodayDecisionRow` WHY
 * zone's own already-inline convention, not a second interaction pattern. Required order:
 * problem, why this is valid, consequence, evidence caveats. Deterministic text only.
 */

import type { TodayDecisionWhyContent } from "@/lib/touchline/presentation/today-composition";

export function TodayDecisionWhy({ content }: { content: TodayDecisionWhyContent | null }) {
  if (!content) return null;
  if (content.why.length === 0 && !content.consequence && content.caveats.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-t border-[var(--border-soft)] pt-3 mt-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Why?</p>
      {content.why.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {content.why.map((reason) => (
            <li key={reason} className="text-xs text-[var(--text-soft)]">
              {reason}
            </li>
          ))}
        </ul>
      )}
      {content.consequence && <p className="text-xs text-[var(--text-soft)]">{content.consequence}</p>}
      {content.caveats.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {content.caveats.map((caveat) => (
            <li key={caveat} className="text-[11px] text-[var(--text-muted)]">
              {caveat}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
