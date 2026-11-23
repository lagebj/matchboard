import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-d` index — Gate D W1 (D01, D02, D04 — Player Intelligence: Player Detail
 * Overview position evidence, Evidence position-dot consolidation, Matches minute coverage;
 * official register `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`). Dev-only, fixture-backed,
 * `CANDIDATE` only. D03/D06 (Assistant Coach cross-source hypothesis) and D07/D08/D09
 * (mutation/approval review, blocked by an unresolved ADR-0139 authority conflict) are deferred —
 * see `docs/ui-lab/gate-d-w1-candidates/WAVE_SCOPE.md`.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-d/d01-overview-position-evidence", id: "D01", title: "Player Detail Overview — position evidence" },
  { href: "/dev/ui-lab/gate-d/d02-evidence-dot-consolidation", id: "D02", title: "Player Detail Evidence — position-dot consolidation" },
  { href: "/dev/ui-lab/gate-d/d04-matches-coverage", id: "D04", title: "Player Detail Matches — minute coverage" },
];

export default function GateDIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; UI Lab
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">Gate D — Player Intelligence</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Wave 1 (D01, D02, D04 — what Matchboard currently knows about a player, without AI). See
        docs/ui-lab/gate-d-w1-candidates/ for the full review record, including the disclosed
        ADR-0139 mutation-authority conflict and the ADR-0154 position-vocabulary mismatch.
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
