import Link from "next/link";
import { TouchlineWordmark, AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-a` index — Matchboard Experience Convergence, Gate A W0/W1 UI Lab-only
 * candidate (handoff `01_START_PROMPT_FOR_AGENT.md`). Development-only, no production route
 * touched. Every case here is `CANDIDATE`, never an approved golden — see
 * `docs/ui-lab/gate-a-w1-candidates/A01_A02_A06_A12_REVIEW.md` for the per-case review record.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-a/a01-sports-first", id: "A01", title: "Global composition — sports-first hierarchy" },
  { href: "/dev/ui-lab/gate-a/a02-match-lifecycle", id: "A02", title: "Match identity across planned / live / completed" },
  { href: "/dev/ui-lab/gate-a/a06-position-pitches", id: "A06", title: "Tactical 5×6 pitch vs flat profile 3×6 analysis map" },
  { href: "/dev/ui-lab/gate-a/a12-profile-editor", id: "A12", title: "14-role profile picker vs 24-code exact match evidence" },
];

export default function GateAIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[720px] px-6 py-10">
      <TouchlineWordmark />
      <h1 className="mt-4 text-[28px] font-[650] text-[var(--foreground)]">Gate A W0/W1 candidates</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Dev-only design candidates, not approved goldens. Real production Touchline components and
        deterministic fixtures only — no production route, domain, or persistence change.
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
