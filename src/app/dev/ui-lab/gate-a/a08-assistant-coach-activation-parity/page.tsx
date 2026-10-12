import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-a/a08-assistant-coach-activation-parity` index — Gate A W4 candidate
 * (`25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` row 31: "OFF vs ON with strong pattern vs ON with no
 * insight... No reserved gap when off; conspicuous trustworthy synthesis when on; no filler").
 * All three scenarios render through the same `ActivationHarness` shell — only the Assistant
 * Coach slot differs — so parity is a structural property of this candidate, not a prose claim.
 * `CANDIDATE` only; never approved here.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-a/a08-assistant-coach-activation-parity/off", id: "off", title: "OFF — no reserved gap" },
  { href: "/dev/ui-lab/gate-a/a08-assistant-coach-activation-parity/on-strong-pattern", id: "on-strong-pattern", title: "ON — strong pattern, conspicuous synthesis" },
  { href: "/dev/ui-lab/gate-a/a08-assistant-coach-activation-parity/on-no-insight", id: "on-no-insight", title: "ON — no insight, honest, no filler" },
];

export default function A08IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate A candidates
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A08 — Assistant Coach activation parity</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        The same surrounding layout across three activation states — only the Assistant Coach slot
        changes. Dev-only, synthetic fixtures only; no mutation anywhere in this family.
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
