import { Surface } from "@/components/ui/surface";
import type { RoundBoardAdvisorViewModel } from "@/lib/ai/presentation/round-board-advisor";

/**
 * Round Board's compact "AI Advisor" block (08_UI_UX_SPEC.md "Round Board" /
 * `goldens/04-round-board-advisor.html`): badge + "Round review" capability label header (no
 * subtitle sentence, matching the completed-match panel's header style rather than the
 * planned-match panel's), plain insights, and the round-specific advisory footer — deliberately
 * distinct copy from the shared `AdvisorPanel` footnote so it's explicit that AI is not a second
 * allocation engine (08_UI_UX_SPEC.md: "Deterministic allocation exceptions remain primary.").
 * Rendered only in the decision/exception area, after the deterministic attention list and
 * allocation lanes — never as an always-present AI lane.
 */
export function RoundBoardAdvisorBlock({ viewModel }: { viewModel: Extract<RoundBoardAdvisorViewModel, { status: "fresh" }> }) {
  return (
    <Surface padding="md">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-[var(--success-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--success)]">
          AI Advisor
        </span>
        <span className="text-sm font-semibold">Round review</span>
      </div>
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
        Advisory only · allocation remains controlled by Matchboard rules and coach decisions
      </p>
    </Surface>
  );
}
