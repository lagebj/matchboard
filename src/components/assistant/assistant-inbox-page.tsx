"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import type { AssistantIssue } from "@/domain/assistant-manager/types";
import { fetchAssistantIssues } from "@/domain/assistant-manager/actions";
import { AssistantInboxCard } from "./assistant-inbox-card";
import { sortIssuesBySeverity, groupIssues } from "@/domain/assistant-manager/utils/issue-grouping";
import type { IssueGroup } from "@/domain/assistant-manager/utils/issue-grouping";

const sectionConfig: Array<{ key: IssueGroup; label: string; emptyText: string }> = [
  { key: "needs_action", label: "Needs Action", emptyText: "No blockers requiring coach review." },
  { key: "ready_to_finalize", label: "Ready to Finalize", emptyText: "No rounds ready to finalize." },
  { key: "upcoming", label: "Upcoming", emptyText: "No upcoming rounds." },
  { key: "recently_resolved", label: "Recently Resolved", emptyText: "" },
];

export function AssistantInboxPage() {
  const [issues, setIssues] = useState<AssistantIssue[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await fetchAssistantIssues();
      setIssues(data);
    });
  }, [startTransition]);

  const groups = groupIssues(issues);
  const totalActionable = groups.needs_action.length + groups.ready_to_finalize.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Assistant</p>
          <p className="text-xs text-zinc-500 mt-0.5">What needs attention before the next matches.</p>
        </div>
        {totalActionable > 0 && (
          <span className="rounded border border-amber-700/40 bg-amber-900/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            {totalActionable} need{totalActionable !== 1 ? "s" : ""} attention
          </span>
        )}
      </div>

      {isPending && issues.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-6 text-sm text-zinc-500">
          Loading issues...
        </div>
      ) : issues.length === 0 ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-6 text-center">
            <p className="text-sm text-zinc-400">No coaching decisions require action right now.</p>
            <p className="text-xs text-zinc-500 mt-1">Upcoming rounds are under control.</p>
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
        sectionConfig.map((section) => {
          const sectionIssues = sortIssuesBySeverity(groups[section.key]);
          if (sectionIssues.length === 0 && section.key !== "needs_action") return null;
          return (
            <div key={section.key} className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{section.label}</p>
              {sectionIssues.length === 0 ? (
                <p className="text-xs text-zinc-500 px-1">{section.emptyText}</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {sectionIssues.map((issue) => (
                    <AssistantInboxCard key={issue.id} issue={issue} />
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