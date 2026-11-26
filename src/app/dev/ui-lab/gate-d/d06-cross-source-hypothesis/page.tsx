import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-d/d06-cross-source-hypothesis` index — register D06 (Gate D Wave 2).
 * Fixture-driven, `CANDIDATE` only. See `docs/ui-lab/gate-d-w2-candidates/` for the full review
 * record, including the disclosed production gap: evidence is cited as a text label only today,
 * with no navigable source-detail capability — the source inspector here is a directional
 * presentation, not a production component.
 */
const SCENARIOS = [
  {
    href: "/dev/ui-lab/gate-d/d06-cross-source-hypothesis/coherent-synthesis",
    id: "D06-COHERENT",
    title: "Coherent trend + observation + position-history synthesis",
  },
  {
    href: "/dev/ui-lab/gate-d/d06-cross-source-hypothesis/genuine-contradiction",
    id: "D06-CONTRADICTION",
    title: "Genuine cross-source contradiction",
  },
  {
    href: "/dev/ui-lab/gate-d/d06-cross-source-hypothesis/sparse-cross-source",
    id: "D06-SPARSE",
    title: "Sparse or incomplete cross-source evidence",
  },
  {
    href: "/dev/ui-lab/gate-d/d06-cross-source-hypothesis/source-inspection-confirmation",
    id: "D06-SOURCE-INSPECTION",
    title: "Source inspection + explicit coach confirmation",
  },
];

export default function D06IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-d" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate D
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">D06 — Player Intelligence, cross-source hypothesis</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Fixture-driven. See docs/ui-lab/gate-d-w2-candidates/ for the full review record.
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
