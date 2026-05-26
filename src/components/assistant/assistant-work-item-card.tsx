import Link from "next/link";
import type { AssistantWorkItem } from "@/lib/assistant/types";

const CATEGORY_STYLES: Record<
  AssistantWorkItem["category"],
  { badge: string; border: string }
> = {
  setup_missing: {
    badge: "border-red-700/40 bg-red-900/20 text-red-300",
    border: "border-red-700/30",
  },
  availability_missing: {
    badge: "border-red-700/40 bg-red-900/20 text-red-300",
    border: "border-red-700/30",
  },
  populate_needed: {
    badge: "border-amber-700/40 bg-amber-900/20 text-amber-300",
    border: "border-amber-700/30",
  },
  blocked_round: {
    badge: "border-red-700/40 bg-red-900/20 text-red-300",
    border: "border-red-700/30",
  },
  decision_required: {
    badge: "border-amber-700/40 bg-amber-900/20 text-amber-300",
    border: "border-amber-700/30",
  },
  ready_to_finalize: {
    badge: "border-emerald-700/40 bg-emerald-900/20 text-emerald-300",
    border: "border-emerald-700/30",
  },
  post_match_report: {
    badge: "border-blue-700/40 bg-blue-900/20 text-blue-300",
    border: "border-blue-700/30",
  },
  upcoming_round: {
    badge: "border-zinc-600/40 bg-zinc-800/30 text-zinc-400",
    border: "border-zinc-600/30",
  },
};

const CATEGORY_LABELS: Record<AssistantWorkItem["category"], string> = {
  setup_missing: "Setup",
  availability_missing: "Availability",
  populate_needed: "Generate",
  blocked_round: "Blocked",
  decision_required: "Decision",
  ready_to_finalize: "Ready",
  post_match_report: "Report",
  upcoming_round: "Upcoming",
};

export function AssistantWorkItemCard({ item }: { item: AssistantWorkItem }) {
  const styles = CATEGORY_STYLES[item.category];
  const label = CATEGORY_LABELS[item.category];

  return (
    <div
      className={`rounded-2xl border ${styles.border} bg-[rgba(255,255,255,0.025)] px-4 py-3 flex flex-col gap-2`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles.badge}`}
            >
              {label}
            </span>
          </div>
          <p className="text-sm font-medium text-zinc-200 leading-snug">
            {item.title}
          </p>
        </div>
        {item.blockedCount != null && item.blockedCount > 0 && (
          <span className="rounded border border-red-700/40 bg-red-900/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
            {item.blockedCount}
          </span>
        )}
        {item.decisionRequiredCount != null &&
          item.decisionRequiredCount > 0 && (
            <span className="rounded border border-amber-700/40 bg-amber-900/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
              {item.decisionRequiredCount}
            </span>
          )}
      </div>
      {item.summary && (
        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
          {item.summary}
        </p>
      )}
      <div className="flex items-center gap-2 mt-0.5">
        <Link
          href={item.primaryActionHref}
          className="inline-flex h-7 items-center justify-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-3 text-xs font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))] transition-colors"
        >
          {item.primaryActionLabel}
        </Link>
      </div>
    </div>
  );
}