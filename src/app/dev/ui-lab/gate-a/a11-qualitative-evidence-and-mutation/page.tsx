import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-a/a11-qualitative-evidence-and-mutation` index — Gate A W4 candidate
 * (`25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` row 38: "Coach text; parsed evidence; guarded review...
 * AI parsing not AI inference; source lineage, independence, guarded profile change"). Per
 * `CONTRACT_RECONCILIATION.md`, this is the real register's A11 — the handoff bundle's own
 * "working allocation" duplicated A10's apply mechanics under this ID, which the register does
 * not support; that conflict was resolved in the register's favour. `CANDIDATE` only.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-a/a11-qualitative-evidence-and-mutation/coach-text-and-parsed-evidence", id: "coach-text-and-parsed-evidence", title: "Coach text → parsed evidence, source lineage preserved" },
  { href: "/dev/ui-lab/gate-a/a11-qualitative-evidence-and-mutation/profile-change-review-guarded", id: "profile-change-review-guarded", title: "Guarded profile change review — accepted" },
  { href: "/dev/ui-lab/gate-a/a11-qualitative-evidence-and-mutation/profile-change-review-rejected", id: "profile-change-review-rejected", title: "Guarded profile change review — rejected" },
];

export default function A11IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate A candidates
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A11 — Qualitative evidence + mutation</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Coach free text parsed into structured evidence, and a guarded before/after profile-change
        review with explicit accept/reject/defer. No real extraction call, no real provider or
        database write anywhere in this family.
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
