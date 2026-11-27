import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

const STATES = [
  { href: "/dev/ui-lab/gate-e/e01-league-temporal-orientation/mid-season-current-round", title: "Mid-season, current round" },
  { href: "/dev/ui-lab/gate-e/e01-league-temporal-orientation/season-closed-no-current-round", title: "Season closed, no current round" },
];

/**
 * `/dev/ui-lab/gate-e/e01-league-temporal-orientation` index — Gate E register row E01 ("League
 * / Fixtures and results"). See `docs/ui-lab/gate-e-w1-candidates/SCENARIO_REGISTER.md`.
 */
export default function E01IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-e" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate E
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">E01 — League temporal orientation</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Current planning round identifiable among historical/upcoming rounds; period navigation
        and context restoration (XR-T01, XR-S02). Reuses the real, unmodified
        <code> buildLeagueOperatingViewModel()</code> and <code>LeagueSurface</code>.
      </p>

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Appearance</p>
        <AppearanceControl />
      </div>

      <ul className="mt-8 flex flex-col gap-1.5">
        {STATES.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2.5 text-[13px] text-[var(--foreground)] hover:border-[var(--accent)]"
            >
              <span>{s.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
