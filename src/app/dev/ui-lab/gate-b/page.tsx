import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-b` index — Gate B W1 candidates (B01-B04 Match Details, official register
 * `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`). Dev-only, fixture-backed, `CANDIDATE` only — no
 * production route, component, or data loader is changed by this wave. See
 * `docs/ui-lab/gate-b-w1-candidates/` for the full review record.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-b/b01-planned-ready", id: "B01", title: "Before match, planned ready" },
  { href: "/dev/ui-lab/gate-b/b02-planned-incomplete", id: "B02", title: "Before match, planned incomplete" },
  { href: "/dev/ui-lab/gate-b/b03-completed-sparse", id: "B03", title: "Completed match, sparse events (6-4, one recorded event)" },
  { href: "/dev/ui-lab/gate-b/b04-completed-rich", id: "B04", title: "Completed match, richer evidence" },
];

export default function GateBIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; UI Lab
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">Gate B W1 — Match Details</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        B01-B04 only. B05 (Post-Match Report), B06 (League/Event parity), B07 (Assistant Coach
        longitudinal) and B08 (information ownership/transitions) are deferred to later waves, not
        deleted from scope. Dev-only, synthetic fixtures only.
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
