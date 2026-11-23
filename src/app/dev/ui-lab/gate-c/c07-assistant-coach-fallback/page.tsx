import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-c/c07-assistant-coach-fallback` index — register C07 (Gate C W3). Dev-only,
 * fixture-backed, `CANDIDATE` only. Today has no real Assistant Coach data loader in production;
 * see `docs/ui-lab/gate-c-w3-candidates/BLOCKERS.md` for the disclosed production-integration
 * gap and `SOURCE_RECONCILIATION.md` for why this wave explicitly authorizes a fixture-driven
 * candidate despite Gate C W1's earlier deferral.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-c/c07-assistant-coach-fallback/off", id: "C07-OFF", title: "Capability unavailable" },
  { href: "/dev/ui-lab/gate-c/c07-assistant-coach-fallback/on", id: "C07-ON", title: "Relevant contextual hypothesis" },
  { href: "/dev/ui-lab/gate-c/c07-assistant-coach-fallback/empty", id: "C07-EMPTY", title: "No useful hypothesis" },
  { href: "/dev/ui-lab/gate-c/c07-assistant-coach-fallback/error", id: "C07-ERROR", title: "Capability failure" },
  { href: "/dev/ui-lab/gate-c/c07-assistant-coach-fallback/stale", id: "C07-STALE", title: "Outdated context" },
];

export default function C07IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-c" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate C
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">C07 — Assistant Coach contextual fallback</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Fixture-driven only — Today has no real Assistant Coach data loader in production. See
        docs/ui-lab/gate-c-w3-candidates/ for the full review record and the disclosed
        production-integration gap.
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
