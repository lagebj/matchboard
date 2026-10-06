"use client";

import { useState } from "react";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { FairnessSummary } from "@/components/round/fairness-summary";
import { AdvisorPanelStale } from "@/components/ai/advisor-panel";
import type { RoundBoardAttentionItem, RoundBoardDevelopmentContext } from "@/lib/touchline/presentation/round-board-view-model";
import type { RoundBoardAdvisorViewModel } from "@/lib/ai/presentation/round-board-advisor";

type RailMode = "insights" | "balance" | "development";

type FairnessMetric = { label: string; value: string | number; detail?: string; trend?: "up" | "down" | "neutral" };
type MovementSummary = { supportSent: number; supportReceived: number; developmentSent: number; developmentReceived: number; squadRepairReceived: number; drops: number };

export type RoundBoardRailProps = {
  /** Already sorted (`sortAttentionForSelection()`) — this component renders order as given. */
  attention: RoundBoardAttentionItem[];
  onResolve?: (item: RoundBoardAttentionItem) => void;
  assistantCoach: RoundBoardAdvisorViewModel | null;
  fairnessMetrics: FairnessMetric[];
  movementSummary: MovementSummary;
  developmentContext: RoundBoardDevelopmentContext | null;
  className?: string;
};

const SUPPORT_BAND_LABELS: Record<string, string> = {
  LIMITED: "Limited",
  ESTABLISHED: "Established",
  STRONG: "Strong",
  STRONGEST: "Strongest",
};

/**
 * Round Board's contextual rail (ADR-0157 §6 "Round Board contextual rail", `06_ROUND_BOARD.md`).
 * Replaces the standalone, always-generic `RoundBoardAdvisorBlock`: Insights now shows the
 * deterministic attention list first, with any Assistant Coach synthesis appended afterward,
 * clearly labelled and never ranked above a deterministic blocker. Balance reuses the existing
 * `FairnessSummary` unchanged — factual counts, never a composite score. Development is context
 * only for the selected player; it renders no action.
 */
export function RoundBoardRail({ attention, onResolve, assistantCoach, fairnessMetrics, movementSummary, developmentContext, className }: RoundBoardRailProps) {
  const [mode, setMode] = useState<RailMode>("insights");

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div className="flex gap-1 border-b border-[var(--border-soft)]" role="tablist" aria-label="Round board rail">
        {(["insights", "balance", "development"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`px-3 py-2 text-[13px] font-medium capitalize border-b-2 -mb-px ${
              mode === m ? "border-[var(--accent-strong)] text-[var(--foreground)]" : "border-transparent text-[var(--text-muted)]"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "insights" && (
        <div className="flex flex-col gap-3">
          {attention.length > 0 ? (
            <TouchlineWidget>
              <WidgetHeader eyebrow="Needs attention" title={`${attention.length} decision${attention.length === 1 ? "" : "s"}`} />
              <ul className="mt-2 flex flex-col divide-y divide-[var(--border-soft)]">
                {attention.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-[600] text-[var(--foreground)]">{item.summary}</p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">{item.detail}</p>
                    </div>
                    {onResolve ? (
                      <button
                        type="button"
                        onClick={() => onResolve(item)}
                        className="shrink-0 rounded-full border border-[var(--border-soft)] px-3 py-1 text-[11px] font-medium text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        Resolve
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </TouchlineWidget>
          ) : (
            <TouchlineWidget>
              <p className="text-[13px] text-[var(--text-muted)]">No blockers or decisions right now.</p>
            </TouchlineWidget>
          )}

          {/* Assistant Coach synthesis — always after the deterministic list above, never
              reordering or outranking it (contract: "They cannot create a recommendation, alter
              plan-integrity severity, or authorize Apply."). */}
          {assistantCoach?.status === "fresh" && (
            <TouchlineWidget>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[var(--success-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--success)]">
                  Assistant Coach
                </span>
              </div>
              <div className="mt-3 divide-y divide-[var(--border-soft)]">
                {assistantCoach.insights.map((insight, index) => (
                  <div key={index} className="flex gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" />
                    <div>
                      <p className="text-sm font-semibold">{insight.title}</p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">{insight.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Advisory only · allocation remains controlled by Matchboard rules and coach decisions
              </p>
            </TouchlineWidget>
          )}
          {assistantCoach?.status === "stale" && <AdvisorPanelStale />}
        </div>
      )}

      {mode === "balance" && <FairnessSummary metrics={fairnessMetrics} movementSummary={movementSummary} />}

      {mode === "development" && (
        <TouchlineWidget>
          {developmentContext ? (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-[700] text-[var(--foreground)]">{developmentContext.displayName}</p>

              {developmentContext.activeFocusCategories.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Active development focus</p>
                  <p className="mt-1 text-[13px] text-[var(--text-default)]">{developmentContext.activeFocusCategories.join(", ")}</p>
                </div>
              )}

              {developmentContext.effectivePositions.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Effective position evidence</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {developmentContext.effectivePositions.map((p) => (
                      <li key={p.positionId} className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="text-[var(--text-default)]">{p.positionId}</span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {SUPPORT_BAND_LABELS[p.supportBand] ?? p.supportBand}
                          {p.minutes != null ? ` · ${p.minutes} min` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {developmentContext.activeFocusCategories.length === 0 && developmentContext.effectivePositions.length === 0 && (
                <p className="text-[13px] text-[var(--text-muted)]">No recorded development context for this player yet.</p>
              )}

              <p className="text-[11px] text-[var(--text-muted)]">Context only — does not change which moves are valid.</p>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--text-muted)]">Select a player to see development context.</p>
          )}
        </TouchlineWidget>
      )}
    </div>
  );
}
