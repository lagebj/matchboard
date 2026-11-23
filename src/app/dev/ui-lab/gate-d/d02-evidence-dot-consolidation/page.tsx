import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-d/d02-evidence-dot-consolidation` index — register D02 (Gate D W1).
 * Fixture-driven, `CANDIDATE` only.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/populated-evidence", id: "D02-POPULATED", title: "Populated evidence, all four groups" },
  { href: "/dev/ui-lab/gate-d/d02-evidence-dot-consolidation/sparse-evidence", id: "D02-SPARSE", title: "Sparse / partial evidence" },
];

export default function D02IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-d" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate D
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">D02 — Player Detail Evidence, position-dot consolidation</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Fixture-driven. See docs/ui-lab/gate-d-w1-candidates/ for the full review record.
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
