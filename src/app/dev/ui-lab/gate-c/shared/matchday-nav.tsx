import Link from "next/link";

type MatchdayNavKey =
  | "league-prepare"
  | "league-verify"
  | "league-imminent"
  | "event-prepare"
  | "event-verify"
  | "event-imminent";

const STOPS: readonly { key: MatchdayNavKey; href: string; label: string }[] = [
  { key: "league-prepare", href: "/dev/ui-lab/gate-c/c03-matchday-prelive/league/prepare", label: "League · Prepare" },
  { key: "league-verify", href: "/dev/ui-lab/gate-c/c03-matchday-prelive/league/verify", label: "League · Verify" },
  { key: "league-imminent", href: "/dev/ui-lab/gate-c/c03-matchday-prelive/league/imminent", label: "League · Imminent" },
  { key: "event-prepare", href: "/dev/ui-lab/gate-c/c03-matchday-prelive/event/prepare", label: "Event · Prepare" },
  { key: "event-verify", href: "/dev/ui-lab/gate-c/c03-matchday-prelive/event/verify", label: "Event · Verify" },
  { key: "event-imminent", href: "/dev/ui-lab/gate-c/c03-matchday-prelive/event/imminent", label: "Event · Imminent" },
];

/**
 * C03-local only (not production): one real navigation strip across all six phase/source
 * combinations this wave compares, mirroring Gate B's own `CompareNav` convention
 * (`gate-b/b06-league-event-parity/shared/compare-nav.tsx`).
 */
export function MatchdayNav({ active }: { active: MatchdayNavKey }) {
  return (
    <nav aria-label="Compare matchday phase" className="flex flex-wrap gap-1.5">
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
