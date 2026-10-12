import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-a/a05-assistant-coach-semantic-grammar` index — Gate A W4 candidate
 * (`25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` row 6: "Disabled; enabled with pattern; enabled without
 * pattern; unavailable"). Four activation states of the SAME Assistant Coach hypothesis grammar,
 * next to the real `MatchInsights` component, proving deterministic facts survive every state.
 * `CANDIDATE` only; never approved here. See `docs/ui-lab/gate-a-w4-candidates/`.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-a/a05-assistant-coach-semantic-grammar/disabled", id: "disabled", title: "Disabled — no section at all, no reserved gap" },
  { href: "/dev/ui-lab/gate-a/a05-assistant-coach-semantic-grammar/enabled-with-pattern", id: "enabled-with-pattern", title: "Enabled, valuable evidence-based hypothesis" },
  { href: "/dev/ui-lab/gate-a/a05-assistant-coach-semantic-grammar/enabled-without-pattern", id: "enabled-without-pattern", title: "Enabled, no useful insight — honest quiet state" },
  { href: "/dev/ui-lab/gate-a/a05-assistant-coach-semantic-grammar/unavailable", id: "unavailable", title: "Unavailable — restrained failure, facts intact" },
];

export default function A05IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate A candidates
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A05 — Assistant Coach semantic grammar</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Disabled, enabled-with-pattern, enabled-without-pattern, and unavailable — the same
        hypothesis card grammar across all four, next to the real deterministic Match Insights.
        Dev-only, synthetic fixtures only; no mutation anywhere in this family.
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
