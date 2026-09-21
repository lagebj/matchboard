import { Surface } from "@/components/ui/surface";

export type AdvisorPanelInsight = { title: string; body: string };

/**
 * Shared "AI Advisor" contextual panel primitive (08_UI_UX_SPEC.md "Contextual Advisor
 * presentation"): no global assistant chrome, no floating button, no sparkle treatment — a
 * quiet, visually-subordinate panel using the exact label `AI Advisor` and the exact explanatory
 * line `Advisory interpretation based on recorded Matchboard data.`. Reused by every contextual
 * surface (planned match, completed match, round board, weekly insights) so none of them
 * reinvent this presentation independently.
 */
export function AdvisorPanel({
  insights,
  footnote,
}: {
  insights: AdvisorPanelInsight[];
  /** e.g. "Based on current plan · AI does not change the line-up or rotations". */
  footnote: string;
}) {
  return (
    <Surface padding="md">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-[var(--success-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--success)]">
          AI Advisor
        </span>
        <span className="text-xs text-[var(--text-muted)]">Advisory interpretation based on recorded Matchboard data.</span>
      </div>
      <div className="mt-4 divide-y divide-[var(--border-soft)]">
        {insights.map((insight, index) => (
          <div key={index} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--success)]" />
            <div>
              <p className="text-sm font-semibold">{insight.title}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{insight.body}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">{footnote}</p>
    </Surface>
  );
}

/** Shown instead of `AdvisorPanel` when the persisted review's source fingerprint no longer
 * matches the plan's current state (08_UI_UX_SPEC.md: "If plan fingerprint changes, never show
 * stale content as current"). */
export function AdvisorPanelStale() {
  return (
    <Surface padding="md">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">
          AI Advisor
        </span>
      </div>
      <p className="mt-3 text-sm text-[var(--text-muted)]">Plan changed · Advisor update pending</p>
    </Surface>
  );
}
