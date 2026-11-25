import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-d/d01-overview-position-evidence` index — register D01 (Gate D W1). Fixture-
 * driven, `CANDIDATE` only. See `docs/ui-lab/gate-d-w1-candidates/` for the full review record,
 * including the disclosed mismatch between this scenario's official acceptance question and the
 * current ADR-0154 position-vocabulary architecture.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-d/d01-overview-position-evidence/agreeing-positions", id: "D01-AGREEING", title: "Declared and evidence-derived positions agree" },
  { href: "/dev/ui-lab/gate-d/d01-overview-position-evidence/diverging-positions", id: "D01-DIVERGING", title: "Declared and evidence-derived positions diverge" },
];

export default function D01IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-d" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate D
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">D01 — Player Detail Overview, position evidence</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Fixture-driven. See docs/ui-lab/gate-d-w1-candidates/ for the full review record and the
        disclosed vocabulary-assumption mismatch.
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
