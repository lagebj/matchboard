import Link from "next/link";

export type B08StageKey = "before" | "live" | "after" | "report-draft" | "report-completed";

const STOPS: readonly { key: B08StageKey; href: string; label: string }[] = [
  { key: "before", href: "/dev/ui-lab/gate-b/b08-information-ownership/before", label: "Before" },
  { key: "live", href: "/dev/ui-lab/gate-b/b08-information-ownership/live", label: "Live" },
  { key: "after", href: "/dev/ui-lab/gate-b/b08-information-ownership/after", label: "After" },
  { key: "report-draft", href: "/dev/ui-lab/gate-b/b08-information-ownership/report-draft", label: "Report · Draft" },
  { key: "report-completed", href: "/dev/ui-lab/gate-b/b08-information-ownership/report-completed", label: "Report · Completed" },
];

/**
 * B08 scenario navigator — dev-only chrome, deliberately NOT styled as a Touchline widget (dashed
 * border + uppercase "DEV" badge) so it can never be mistaken for a coach-facing production
 * control. Jumps between this one match's five real lifecycle routes; it does not itself perform
 * any fixture-local action.
 */
export function B08TransitionNav({ current }: { current: B08StageKey }) {
  return (
    <nav
      aria-label="B08 scenario navigator"
      className="flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-[var(--border-soft)] bg-[var(--surface-muted)]/20 p-2"
    >
      <span className="rounded bg-[var(--text-muted)]/20 px-1.5 py-0.5 text-[10px] font-[700] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        Dev
      </span>
      <span className="text-[11px] text-[var(--text-muted)]">B08 scenario navigator —</span>
      {STOPS.map((stop) => {
        const isActive = stop.key === current;
        return (
          <Link
            key={stop.key}
            href={stop.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-md border border-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 text-[11px] font-[650] text-[var(--accent)]"
                : "rounded-md border border-[var(--border-soft)] bg-transparent px-2 py-0.5 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            }
          >
            {stop.label}
          </Link>
        );
      })}
    </nav>
  );
}
