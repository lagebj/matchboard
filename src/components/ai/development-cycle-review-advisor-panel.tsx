"use client";

import { Surface } from "@/components/ui/surface";
import type { DevelopmentCycleReviewAdvisorViewModel } from "@/lib/ai/presentation/development-cycle-review-advisor";

/**
 * "Learning cycle" Advisor block (bundle 08_UI_STATES_AND_COPY.md "Learning cycle"): folded
 * into the existing Team Review surface directly after the "Weekly team review" block — no new
 * top-level navigation item (bundle §13 "Presentation"). Player states inside the insights are
 * the model's own prose (Improving / Unresolved / Insufficient evidence) with no traffic-light
 * colouring (bundle: "Do not use traffic-light player colors").
 */
export function DevelopmentCycleReviewAdvisorPanel({
  viewModel,
}: {
  viewModel: DevelopmentCycleReviewAdvisorViewModel;
}) {
  return (
    <Surface padding="md">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-[var(--success-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--success)]">
          AI Advisor
        </span>
        <span className="text-sm font-semibold">{viewModel.windowLabel}</span>
      </div>
      {viewModel.summary ? (
        <p className="mt-3 text-sm text-[var(--text-soft)]">{viewModel.summary}</p>
      ) : null}
      <div className="mt-4 divide-y divide-[var(--border-soft)]">
        {viewModel.insights.map((insight, index) => (
          <div key={index} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" />
            <div>
              <p className="text-sm font-semibold">{insight.title}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{insight.body}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Advisory interpretation based on the recorded evidence of this five-week window.
      </p>
    </Surface>
  );
}