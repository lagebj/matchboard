import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-a/a03-decision-anatomy` index — Gate A W3 candidate
 * (`20_UI_LAB_CANDIDATE_WAVES.md` W3, A03). Four scenarios proving the decision-anatomy grammar
 * (situation → permitted/unavailable action → consequence → inspectable reason) across an
 * actionable decision, a closed read-only review, a permission-denied view, and a Round-Board-
 * style integrity signal — all pointing at the SAME shared `match-w3-01` fixture as A07/A09.
 * `CANDIDATE` only; never approved here.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-a/a03-decision-anatomy/open-decision", id: "S1", title: "Actionable decision — planning open, RCM unfilled" },
  { href: "/dev/ui-lab/gate-a/a03-decision-anatomy/closed-plan-review", id: "S2", title: "Closed plan — read-only review, no fabricated exception" },
  { href: "/dev/ui-lab/gate-a/a03-decision-anatomy/permission-denied", id: "S3", title: "Permission denied — no leaked squad detail" },
  { href: "/dev/ui-lab/gate-a/a03-decision-anatomy/integrity-signal", id: "S4", title: "Round Board integrity signal — points back to the match, no second resolver" },
];

export default function A03DecisionAnatomyIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate A candidates
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A03 — Decision anatomy</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Who/what/why, permitted or unavailable action, meaningful consequence, and contextual
        review-only behavior — tied to one real match and round, not a generic dashboard. Dev-only,
        synthetic fixtures only; no mutation anywhere in this family.
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
