export function getSeverityBadgeClasses(severity: string): string {
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