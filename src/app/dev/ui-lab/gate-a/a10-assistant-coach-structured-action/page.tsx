import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-a/a10-assistant-coach-structured-action` index — Gate A W4 candidate
 * (`25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` row 37: "Review lineup alternative, stale proposal,
 * disabled/failure... validate-before-preview, no automatic write, apply blocked when stale").
 * No production structured-lineup-proposal capability exists yet to baseline against — see
 * `docs/ui-lab/gate-a-w4-candidates/CURRENT_STATE_AUDIT.md` item 5. `CANDIDATE` only.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-a/a10-assistant-coach-structured-action/review-alternative-success", id: "review-alternative-success", title: "Review lineup alternative — evidence, diff, Apply" },
  { href: "/dev/ui-lab/gate-a/a10-assistant-coach-structured-action/stale-proposal-blocked", id: "stale-proposal-blocked", title: "Stale proposal — no Apply affordance" },
  { href: "/dev/ui-lab/gate-a/a10-assistant-coach-structured-action/disabled-or-failed", id: "disabled-or-failed", title: "Disabled/failed — honest, manual editing unaffected" },
];

export default function A10IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate A candidates
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A10 — Assistant Coach structured action</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Review lineup alternative, stale proposal, and disabled/failure — one context-local
        inspector/sheet per case, reusing the same W3 unfilled-RCM-slot anchor. Dev-only, synthetic
        fixtures only; no real server call anywhere in this family.
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
