"use client";

import Link from "next/link";
import type { AssistantCommandCentre } from "@/lib/assistant/types";
import { AssistantWorkItemCard } from "./assistant-work-item-card";

type SectionConfig = {
  key: string;
  label: string;
  categories: AssistantCommandCentre["items"][number]["category"][];
  emptyText: string;
};

const sections: SectionConfig[] = [
  {
    key: "setup",
    label: "Setup",
    categories: ["setup_missing", "availability_missing", "populate_needed"],
    emptyText: "",
  },
  {
    key: "action",
    label: "Needs Action",
    categories: ["blocked_round", "decision_required"],
    emptyText: "No blockers requiring coach review.",
  },
  {
    key: "finalize",
    label: "Ready to Finalize",
    categories: ["ready_to_finalize"],
    emptyText: "No rounds ready to finalize.",
  },
  {
    key: "report",
    label: "Post-Match Reports",
    categories: ["post_match_report"],
    emptyText: "No post-match reports missing.",
  },
];

export function AssistantCommandCentrePage({
  commandCentre,
}: {
  commandCentre: AssistantCommandCentre;
}) {
  const { items, planningPeriodName } = commandCentre;

  const actionableItems = items.filter(
    (i) => i.category !== "upcoming_round",
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Assistant
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            What needs attention before the next matches.
          </p>
        </div>
        {planningPeriodName && (
          <span className="rounded border border-zinc-600/40 bg-zinc-800/30 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            {planningPeriodName}
          </span>
        )}
      </div>

      {actionableItems.length === 0 ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-6 text-center">
            <p className="text-sm text-zinc-400">
              No coaching decisions require action right now.
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Upcoming rounds are under control.
            </p>
          </div>
          <div className="flex items-center gap-3 justify-center">
            <Link
              href="/fixtures"
              className="inline-flex h-9 items-center justify-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))]"
            >
              View Fixtures
            </Link>
          </div>
        </div>
      ) : (
        sections.map((section) => {
          const sectionItems = actionableItems.filter((i) =>
            section.categories.includes(i.category),
          );
          if (sectionItems.length === 0 && section.key !== "action") return null;
          return (
            <div key={section.key} className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {section.label}
              </p>
              {sectionItems.length === 0 ? (
                <p className="text-xs text-zinc-500 px-1">
                  {section.emptyText}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {sectionItems.map((item) => (
                    <AssistantWorkItemCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}