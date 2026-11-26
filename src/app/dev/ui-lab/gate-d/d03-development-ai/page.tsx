import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-d/d03-development-ai` index — register D03 (Gate D Wave 2). Fixture-driven,
 * `CANDIDATE` only. See `docs/ui-lab/gate-d-w2-candidates/` for the full review record, including
 * the disclosed production gap: Player Detail's Development tab renders no distinguishing OFF/
 * EMPTY/ERROR/STALE state around the Assistant Coach hypothesis section today — an empty
 * hypotheses array and a disabled capability are both literal silence in production.
 */
const SCENARIOS = [
  {
    href: "/dev/ui-lab/gate-d/d03-development-ai/grounded-longitudinal-hypothesis",
    id: "D03-GROUNDED",
    title: "Grounded longitudinal hypothesis with existing coach focus",
  },
  {
    href: "/dev/ui-lab/gate-d/d03-development-ai/sparse-no-hypothesis",
    id: "D03-SPARSE",
    title: "Sparse evidence — no defensible hypothesis",
  },
  {
    href: "/dev/ui-lab/gate-d/d03-development-ai/coach-decision-flow",
    id: "D03-DECISION-FLOW",
    title: "Coach decision flow — confirm, dismiss, failure",
  },
];

export default function D03IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-d" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate D
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">D03 — Player Detail Development, AI hypothesis</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Fixture-driven. Reuses the real <code>AssistantCoachHypothesisPanel</code> and Development-tab composition. See
        docs/ui-lab/gate-d-w2-candidates/ for the full review record.
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
