import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-a/a09-today-quick-action` index — Gate A W3 candidate
 * (`20_UI_LAB_CANDIDATE_WAVES.md` W3, A09). Six scenarios, one per mandatory case
 * (`02_SCENARIOS_AND_FIXTURES.md`'s A09 table), each completing entirely on this surface — no
 * navigation to Match Details. `CANDIDATE` only; never approved here.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-a/a09-today-quick-action/add-eligible-player-success", id: "S1", title: "Permitted candidate — preview, confirm, saved (simulated)" },
  { href: "/dev/ui-lab/gate-a/a09-today-quick-action/add-player-denied", id: "S2", title: "Actor/group denied — blocked at entry" },
  { href: "/dev/ui-lab/gate-a/a09-today-quick-action/add-player-rsvp-blocked", id: "S3", title: "RSVP deadline passed, no response — blocked planned-selection candidate" },
  { href: "/dev/ui-lab/gate-a/a09-today-quick-action/add-player-planning-closed", id: "S4", title: "Planning closed after preview — count unchanged" },
  { href: "/dev/ui-lab/gate-a/a09-today-quick-action/add-player-conflict", id: "S5", title: "Stale revision — already a participant, recheck match" },
  { href: "/dev/ui-lab/gate-a/a09-today-quick-action/match-day-addition", id: "S6", title: "Match-day addition — separate operational roster, own eligibility" },
];

export default function A09TodayQuickActionIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-a" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate A candidates
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A09 — Today quick action</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        A same-day eligible-player quick action, completed entirely from Today — preview, confirm,
        permission, RSVP, conflict, planning-closed, and the separate match-day addition path.
        Dev-only, synthetic fixtures only. Fixture-only simulated save — no server called.
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
