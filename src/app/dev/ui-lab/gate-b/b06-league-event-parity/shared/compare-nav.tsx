import Link from "next/link";

type CompareNavKey = "league-before" | "league-after" | "event-before" | "event-after";

const STOPS: readonly { key: CompareNavKey; href: string; label: string }[] = [
  { key: "league-before", href: "/dev/ui-lab/gate-b/b06-league-event-parity/league/before", label: "League · Before" },
  { key: "league-after", href: "/dev/ui-lab/gate-b/b06-league-event-parity/league/after", label: "League · After" },
  { key: "event-before", href: "/dev/ui-lab/gate-b/b06-league-event-parity/event/before", label: "Event · Before" },
  { key: "event-after", href: "/dev/ui-lab/gate-b/b06-league-event-parity/event/after", label: "Event · After" },
];

/**
 * B06-local only (not production): one real, inspectable navigation strip across all four
 * lifecycle-equivalent stages this wave compares. This is the concrete realization of the
 * register's "context/back continuity" requirement (XR-S01 XR-V02) — a reviewer can jump between
 * the same workflow stage across origins, or between before/after within one origin, without
 * relying on a browser Back button as the navigation model.
 */
export function CompareNav({ active }: { active: CompareNavKey }) {
  return (
    <nav aria-label="Compare lifecycle stage" className="flex flex-wrap gap-1.5">
      {STOPS.map((stop) => {
        const isActive = stop.key === active;
        return (
          <Link
            key={stop.key}
            href={stop.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-md border border-[var(--accent)] bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-[650] text-[var(--accent)]"
                : "rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            }
          >
            {stop.label}
          </Link>
        );
      })}
    </nav>
  );
}
