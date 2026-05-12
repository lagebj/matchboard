import type { AssistantIssue } from "../types";

export type IssueGroup = "needs_action" | "watch" | "recently_resolved" | "upcoming";

export function groupIssues(issues: AssistantIssue[]): Record<IssueGroup, AssistantIssue[]> {
  const groups: Record<IssueGroup, AssistantIssue[]> = {
    needs_action: [],
    watch: [],
    recently_resolved: [],
    upcoming: [],
  };
  for (const issue of issues) {
    if (issue.status === "RESOLVED" || issue.status === "DISMISSED") {
      groups.recently_resolved.push(issue);
    } else if (issue.severity === "ACTION_REQUIRED" || issue.severity === "BLOCKED" || issue.severity === "CRITICAL") {
      groups.needs_action.push(issue);
    } else if (issue.severity === "WATCH" || issue.severity === "INFO") {
      if (issue.status === "STALE") {
        groups.upcoming.push(issue);
      } else {
        groups.watch.push(issue);
      }
    } else {
      groups.watch.push(issue);
    }
  }
  return groups;
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  BLOCKED: 1,
  ACTION_REQUIRED: 2,
  WATCH: 3,
  INFO: 4,
};

const STATUS_ORDER: Record<string, number> = {
  OPEN: 0,
  STALE: 1,
  RESOLVED: 2,
  DISMISSED: 3,
};

export function sortIssuesBySeverity(issues: AssistantIssue[]): AssistantIssue[] {
  return [...issues].sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
    if (sevDiff !== 0) return sevDiff;
    return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
  });
}

export function getSeverityBadgeClasses(severity: AssistantIssue["severity"]): string {
  switch (severity) {
    case "CRITICAL": return "border-red-700/50 bg-red-900/25 text-red-300";
    case "BLOCKED": return "border-red-700/40 bg-red-900/20 text-red-300";
    case "ACTION_REQUIRED": return "border-amber-700/40 bg-amber-900/20 text-amber-300";
    case "WATCH": return "border-blue-700/40 bg-blue-900/20 text-blue-300";
    case "INFO": return "border-zinc-600/40 bg-zinc-800/30 text-zinc-400";
    default: return "border-zinc-600/40 bg-zinc-800/30 text-zinc-400";
  }
}

export function getReadinessClasses(state: string): string {
  switch (state) {
    case "READY": return "border-emerald-700/40 bg-emerald-900/20 text-emerald-300";
    case "WATCH": return "border-blue-700/40 bg-blue-900/20 text-blue-300";
    case "AT_RISK": return "border-amber-700/40 bg-amber-900/20 text-amber-300";
    case "NOT_PLAYABLE": return "border-red-700/40 bg-red-900/20 text-red-300";
    default: return "border-zinc-600/40 bg-zinc-800/30 text-zinc-400";
  }
}

export function getStatusBadgeClasses(status: AssistantIssue["status"]): string {
  switch (status) {
    case "OPEN": return "border-zinc-600/40 bg-zinc-800/30 text-zinc-300";
    case "RESOLVED": return "border-emerald-700/40 bg-emerald-900/20 text-emerald-300";
    case "DISMISSED": return "border-zinc-700/40 bg-zinc-800/20 text-zinc-500";
    case "STALE": return "border-zinc-700/40 bg-zinc-800/20 text-zinc-500 line-through";
    default: return "border-zinc-600/40 bg-zinc-800/30 text-zinc-400";
  }
}