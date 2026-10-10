import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-a/a04-evidence-grammar` index — Gate A W2 candidate (`20_UI_LAB_CANDIDATE_
 * WAVES.md` W2, A04). Six separate subroutes, one per mandatory scenario
 * (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md`), each focused on one football question and one object —
 * deliberately not a single always-on six-chart wall. `CANDIDATE` only; never approved here.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-a/a04-evidence-grammar/partial-minutes", id: "S1", title: "Opportunity vs actual minutes (5/5, not recorded)" },
  { href: "/dev/ui-lab/gate-a/a04-evidence-grammar/role-exposure-sparse", id: "S2", title: "Sparse role exposure (2 of 6, no trend)" },
  { href: "/dev/ui-lab/gate-a/a04-evidence-grammar/role-exposure-supported", id: "S3", title: "Supported role exposure comparison (prior 3 vs latest 3)" },
  { href: "/dev/ui-lab/gate-a/a04-evidence-grammar/sparse-score-events", id: "S4", title: "Final score vs recorded event log (6–4, one goal event)" },
  { href: "/dev/ui-lab/gate-a/a04-evidence-grammar/central-profile-projection", id: "S5", title: "Central profile projection (LCM 20m + RCM 10m → CM 30m)" },
  { href: "/dev/ui-lab/gate-a/a04-evidence-grammar/declared-only-versus-evidenced", id: "S6", title: "Declared position vs actual evidence" },
];

export default function A04EvidenceGrammarIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate A candidates
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A04 — Evidence grammar</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        What is known, what is measured, what remains unrecorded, and which coaching decision the
        evidence may validly support — across unknown, partial, sparse, and supported
        measurements. Dev-only, synthetic fixtures only.
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
