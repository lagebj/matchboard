import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-a/a07-match-details-edit-lineup` index — Gate A W3 candidate
 * (`20_UI_LAB_CANDIDATE_WAVES.md` W3, A07). Every scenario stays inside the SAME Match Details
 * workspace — the desktop contextual inspector or mobile focused sheet opens, previews, and
 * resolves a lineup-slot assignment without ever navigating away (XR-I01). `S1`/`S2` share one
 * page: `S1` (open/draft/preview) has no distinct end-state of its own — it's the prefix of `S2`'s
 * save flow, so giving it a second page would just be a duplicate wrapper. `CANDIDATE` only.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-a/a07-match-details-edit-lineup/assign-reserve-success", id: "S1/S2", title: "Open, select, preview, confirm — Saved (simulated)" },
  { href: "/dev/ui-lab/gate-a/a07-match-details-edit-lineup/assign-reserve-denied", id: "S3", title: "Server permission denied — draft retained, no mutation" },
  { href: "/dev/ui-lab/gate-a/a07-match-details-edit-lineup/server-conflict", id: "S4", title: "Server stale/conflict — predeclared revision mismatch" },
  { href: "/dev/ui-lab/gate-a/a07-match-details-edit-lineup/planning-closed-after-opening", id: "S5", title: "Planning closed after opening — no fake force-save" },
  { href: "/dev/ui-lab/gate-a/a07-match-details-edit-lineup/dirty-draft-close", id: "S6", title: "Dirty draft close — discard/continue guard" },
];

export default function A07MatchDetailsEditLineupIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate A candidates
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A07 — Match Details edit lineup</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Same match, same tab, same tactical pitch, throughout every state — desktop contextual
        inspector / mobile focused sheet, never a separate editor route. Dev-only, synthetic
        fixtures only; every save is a labeled fixture simulation, never a real mutation.
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
