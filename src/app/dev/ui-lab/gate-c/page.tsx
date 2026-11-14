import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-c` index — Gate C W1 candidates (official register
 * `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`, rows C01-C03). Dev-only, fixture-backed, `CANDIDATE`
 * only — no production route, component, or data loader is changed by this wave. See
 * `docs/ui-lab/gate-c-w1-candidates/` for the full review record, including why no official Gate
 * C wave-ordering document exists and C07/C04-C06/C08 are explicitly deferred out of this wave.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-c/c01-quiet-day", id: "C01", title: "Today — Quiet day" },
  { href: "/dev/ui-lab/gate-c/c02-decision-day", id: "C02", title: "Today — Decision day" },
  { href: "/dev/ui-lab/gate-c/c03-matchday-prelive/league/prepare", id: "C03-LEAGUE-PREPARE", title: "Today — Matchday, League, Prepare" },
  { href: "/dev/ui-lab/gate-c/c03-matchday-prelive/league/verify", id: "C03-LEAGUE-VERIFY", title: "Today — Matchday, League, Verify" },
  { href: "/dev/ui-lab/gate-c/c03-matchday-prelive/league/imminent", id: "C03-LEAGUE-IMMINENT", title: "Today — Matchday, League, Imminent" },
  { href: "/dev/ui-lab/gate-c/c03-matchday-prelive/event/prepare", id: "C03-EVENT-PREPARE", title: "Today — Matchday, Event, Prepare" },
  { href: "/dev/ui-lab/gate-c/c03-matchday-prelive/event/verify", id: "C03-EVENT-VERIFY", title: "Today — Matchday, Event, Verify" },
  { href: "/dev/ui-lab/gate-c/c03-matchday-prelive/event/imminent", id: "C03-EVENT-IMMINENT", title: "Today — Matchday, Event, Imminent" },
];

export default function GateCIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; UI Lab
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">Gate C — Today Operational Decision Surface</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        C01-C03 (W1 — quiet day, decision day, matchday pre-live). C07 (Assistant Coach fallback)
        and C04-C06/C08 (Round Board) are not part of this wave — see
        docs/ui-lab/gate-c-w1-candidates/BLOCKERS.md.
      </p>

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Appearance</p>
        <AppearanceControl />
      </div>

      <ul className="mt-8 flex flex-col gap-1.5">
        {SCENARIOS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2.5 text-[13px] text-[var(--foreground)] hover:border-[var(--accent)]"
            >
              <span>{s.title}</span>
              <span className="text-[11px] text-[var(--text-muted)]">{s.id}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
