// Was raw Tailwind zinc/red/amber/emerald/blue literals with no dark-styling boundary at all —
// they always resolved to their (dark-tuned) values regardless of the viewer's theme, since these
// were never token-based. Token-aligned so these badges render correctly once any surface calling
// them is inside a theme-aware Touchline island (ADR-0134).
export function getSeverityBadgeClasses(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "border-[var(--danger)]/50 bg-[var(--danger-subtle)] text-[var(--danger)]";
    case "BLOCKED": return "border-[var(--danger)]/40 bg-[var(--danger-subtle)] text-[var(--danger)]";
    case "ACTION_REQUIRED": return "border-[var(--warning)]/40 bg-[var(--warning-subtle)] text-[var(--warning)]";
    case "WATCH": return "border-[var(--info)]/40 bg-[var(--info-subtle)] text-[var(--info)]";
    case "INFO": return "border-[var(--border-soft)] bg-[var(--surface-muted)]/40 text-[var(--text-muted)]";
    default: return "border-[var(--border-soft)] bg-[var(--surface-muted)]/40 text-[var(--text-muted)]";
  }
}

export function getReadinessClasses(state: string): string {
  switch (state) {
    case "READY": return "border-[var(--success)]/40 bg-[var(--success-subtle)] text-[var(--success)]";
    case "WATCH": return "border-[var(--info)]/40 bg-[var(--info-subtle)] text-[var(--info)]";
    case "AT_RISK": return "border-[var(--warning)]/40 bg-[var(--warning-subtle)] text-[var(--warning)]";
    case "NOT_PLAYABLE": return "border-[var(--danger)]/40 bg-[var(--danger-subtle)] text-[var(--danger)]";
    default: return "border-[var(--border-soft)] bg-[var(--surface-muted)]/40 text-[var(--text-muted)]";
  }
}