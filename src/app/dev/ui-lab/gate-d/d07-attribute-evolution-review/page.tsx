import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * Gate D W1 extension — D07 index. ADR-0160's decided materiality policy, demonstrated as
 * `AUTOMATIC` (reproduces the real `AssessmentHistoryPanel`'s rendering — see
 * `shared/assessment-history-display.tsx`) and `MATERIAL` (a new directional review surface —
 * see `shared/material-approval-review.tsx`). A manual-edit/lock + attribute-level-rebase state
 * (ADR-0160 §5) is explicitly deferred — see `docs/ui-lab/gate-d-w1-candidates/BLOCKERS.md`.
 */
const STATES = [
  { href: "/dev/ui-lab/gate-d/d07-attribute-evolution-review/automatic-non-material", id: "AUTOMATIC", title: "Non-material — applies automatically" },
  { href: "/dev/ui-lab/gate-d/d07-attribute-evolution-review/pending-material-approval", id: "MATERIAL", title: "Material — coach approval required" },
];

export default function D07IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-d" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate D
      </Link>
      <h1 className="mt-2 text-[20px] font-[650] text-[var(--foreground)]">D07 — Attribute evolution review</h1>
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
