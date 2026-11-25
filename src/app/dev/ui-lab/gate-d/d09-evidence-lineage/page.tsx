import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * Gate D W1 extension — D09 index. Per the owner's decision #6 ("proceed independently... audit
 * and reuse the existing qualitative-evidence supersession machinery"), this exposes real,
 * already-shipped lineage data through a new display surface — see
 * `shared/evidence-lineage-display.tsx` for the disclosure.
 */
const STATES = [
  { href: "/dev/ui-lab/gate-d/d09-evidence-lineage/superseded-lineage", id: "LINEAGE", title: "Original, superseded, and active versions (interactive Edit/Retract)" },
  { href: "/dev/ui-lab/gate-d/d09-evidence-lineage/ambiguous-reference-rejected", id: "AMBIGUOUS", title: "Ambiguous reference — rejected, zero observations" },
];

export default function D09IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-d" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate D
      </Link>
      <h1 className="mt-2 text-[20px] font-[650] text-[var(--foreground)]">D09 — Evidence lineage</h1>
      <div className="mt-6">
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
              <span className="text-[11px] text-[var(--text-muted)]">{s.id}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
