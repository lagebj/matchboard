import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-c` index — Gate C W1 (C01-C03, Today), W2 (C04-C06, Round Board), and W3
 * (C07, Assistant Coach fallback; C08, same-day quick add) candidates (official register
 * `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`). Dev-only, fixture-backed, `CANDIDATE` only — no
 * production route, component, or data loader is changed except the bounded, acceptance-
 * contract-required corrections disclosed per wave. See `docs/ui-lab/gate-c-w1-candidates/`,
 * `docs/ui-lab/gate-c-w2-candidates/`, and `docs/ui-lab/gate-c-w3-candidates/` for the full
 * review records.
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
  { href: "/dev/ui-lab/gate-c/c04-planning-open", id: "C04", title: "Round Board — Planning open, unresolved decision" },
  { href: "/dev/ui-lab/gate-c/c05-planning-closed", id: "C05", title: "Round Board — Planning closed, historical warnings" },
  { href: "/dev/ui-lab/gate-c/c06-dense-allocation", id: "C06", title: "Round Board — Dense allocation, position precision" },
  { href: "/dev/ui-lab/gate-c/c07-assistant-coach-fallback", id: "C07", title: "Today — Assistant Coach contextual fallback" },
  { href: "/dev/ui-lab/gate-c/c08-same-day-quick-add", id: "C08", title: "Round Board + Today — Same-day quick add" },
];

export default function GateCIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; UI Lab
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">Gate C — Operational Decision Surfaces</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        C01-C03 (W1 — Today: quiet day, decision day, matchday pre-live). C04-C06 (W2 — Round
        Board: planning open, planning closed, dense allocation). C07 (W3 — Today, Assistant Coach
        fixture-driven fallback) and C08 (W3 — Round Board + Today, same-day quick add) — see
        docs/ui-lab/gate-c-w3-candidates/ for the full review record.
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
