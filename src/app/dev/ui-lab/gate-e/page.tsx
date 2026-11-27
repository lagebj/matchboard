import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-e` index — Gate E (complete-product convergence; official register
 * `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`, rows E01–E08). Dev-only, fixture-backed, `CANDIDATE`
 * only.
 *
 * Wave 1: E01 (League — temporal orientation, period navigation, context restoration). E02–E08
 * are deferred; see `docs/ui-lab/gate-e-w1-candidates/WAVE_SCOPE.md`.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-e/e01-league-temporal-orientation", id: "E01", title: "League — temporal orientation" },
];

export default function GateEIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; UI Lab
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">Gate E — Complete-product convergence</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Wave 1: E01 (League). See docs/ui-lab/gate-e-w1-candidates/ for the full review record and
        the deferred E02–E08 scope.
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
