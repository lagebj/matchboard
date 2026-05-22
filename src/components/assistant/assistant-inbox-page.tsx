"use client";

import { useState, useEffect, useTransition } from "react";
import type { AssistantIssue } from "@/domain/assistant-manager/types";
import { fetchAssistantIssues } from "@/domain/assistant-manager/actions";
import { AssistantInboxCard } from "./assistant-inbox-card";
import { sortIssuesBySeverity, groupIssues } from "@/domain/assistant-manager/utils/issue-grouping";
import type { IssueGroup } from "@/domain/assistant-manager/utils/issue-grouping";

const sectionConfig: Array<{ key: IssueGroup; label: string }> = [
  { key: "needs_action", label: "Needs Action" },
  { key: "watch", label: "Watch" },
  { key: "recently_resolved", label: "Recently Resolved" },
  { key: "upcoming", label: "Upcoming" },
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
  const totalOpen = groups.needs_action.length + groups.watch.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Assistant</p>
          <p className="text-xs text-zinc-500 mt-0.5">What needs coach attention now.</p>
        </div>
        {totalOpen > 0 && (
          <span className="rounded border border-amber-700/40 bg-amber-900/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            {totalOpen} open
          </span>
        )}
      </div>

      {isPending && issues.length === 0 ? (
        <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-6 text-sm text-zinc-500">
          Loading issues...
        </div>
      ) : issues.length === 0 ? (
        <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-6 text-sm text-zinc-400">
          No open coaching issues. Upcoming rounds are currently under control.
        </div>
      ) : (
        sectionConfig.map((section) => {
          const sectionIssues = sortIssuesBySeverity(groups[section.key]);
          if (sectionIssues.length === 0) return null;
          return (
            <div key={section.key} className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{section.label}</p>
              <div className="flex flex-col gap-1.5">
                {sectionIssues.map((issue) => (
                  <AssistantInboxCard key={issue.id} issue={issue} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}