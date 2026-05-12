"use client";

import Link from "next/link";
import type { AssistantIssue } from "@/domain/assistant-manager/types";
import { getSeverityBadgeClasses, getStatusBadgeClasses } from "@/domain/assistant-manager/mock-data";

type AssistantInboxCardProps = {
  issue: AssistantIssue;
};

function severityLabel(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "Critical";
    case "BLOCKED": return "Blocked";
    case "ACTION_REQUIRED": return "Action";
    case "WATCH": return "Watch";
    case "INFO": return "Info";
    default: return severity;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "OPEN": return "Open";
    case "RESOLVED": return "Resolved";
    case "DISMISSED": return "Dismissed";
    case "STALE": return "Stale";
    default: return status;
  }
}

export function AssistantInboxCard({ issue }: AssistantInboxCardProps) {
  const teamCount = issue.affectedTeamIds.length;
  const playerCount = issue.affectedPlayerIds.length;
  const ruleCount = issue.ruleIds.length;

  return (
    <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${getSeverityBadgeClasses(issue.severity)}`}>
              {severityLabel(issue.severity)}
            </span>
            <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase ${getStatusBadgeClasses(issue.status)}`}>
              {statusLabel(issue.status)}
            </span>
            <span className="text-xs font-medium text-zinc-200 truncate">{issue.title}</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">{issue.summary}</p>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500">
            <span>Recommended: <span className="text-zinc-300">{issue.recommendedAction}</span></span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[10px]">
            {teamCount > 0 && <span className="text-zinc-500">{teamCount} team{teamCount !== 1 ? "s" : ""}</span>}
            {playerCount > 0 && <span className="text-zinc-500">{playerCount} player{playerCount !== 1 ? "s" : ""}</span>}
            {ruleCount > 0 && <span className="text-zinc-500">{ruleCount} rule{ruleCount !== 1 ? "s" : ""}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Link
            href={issue.primaryActionHref}
            className="h-6 rounded border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2 text-[10px] font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent)]/20 text-center leading-6"
          >
            {issue.primaryActionLabel}
          </Link>
          {issue.secondaryActionHref && (
            <Link
              href={issue.secondaryActionHref}
              className="h-6 rounded border border-zinc-700/50 bg-zinc-800/30 px-2 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 text-center leading-6"
            >
              {issue.secondaryActionLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}