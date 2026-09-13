import Link from "next/link";
import { TouchlineWordmark, AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/atlas-followup` index — the Atlas Follow-up implementation bundle's dedicated UI
 * Lab (`01_GOLDEN_REFERENCE_INDEX_AND_CONFORMANCE_METHOD.md §2 Step B`). Development-only, no
 * production route touched. Grows as each phase's fixtures land; routes not yet built are shown
 * disabled rather than linked to a 404.
 */
const ROUTES: { href: string; title: string; note: string; ready: boolean }[] = [
  { href: "/dev/ui-lab/atlas-followup/team-kit-colour", title: "Team Kit Colour", note: "Phase F1", ready: true },
  { href: "/dev/ui-lab/atlas-followup/planning-pitch", title: "Planning pitch (desktop + mobile)", note: "Phase F2 — Hard Gate A", ready: true },
  { href: "/dev/ui-lab/atlas-followup/position-map", title: "Player Detail position map", note: "Phase F2 — Hard Gate A", ready: true },
  { href: "/dev/ui-lab/atlas-followup/player-detail", title: "Player Detail (Overview/Matches/Development/Evidence)", note: "Phase F4 — Gate B", ready: true },
  { href: "/dev/ui-lab/atlas-followup/players-overview", title: "Player Overview", note: "Phase F5 — Gate C", ready: true },
  { href: "/dev/ui-lab/atlas-followup/round-board", title: "Round Board", note: "Phase F6 — Gate D", ready: true },
];

export default function AtlasFollowupIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[720px] px-6 py-10">
      <TouchlineWordmark />
      <h1 className="mt-4 text-[28px] font-[650] text-[var(--foreground)]">Atlas Follow-up</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Round Board, Players, shirt identity, canonical pitch, and the evolving position model.
        Development only — no production route touched. Golden-sensitive surfaces require a
        human visual-approval gate before production migration.
      </p>

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Appearance</p>
        <AppearanceControl />
      </div>

      <ul className="mt-8 flex flex-col gap-1.5">
        {ROUTES.map((route) => (
          <li key={route.href}>
            {route.ready ? (
              <Link
                href={route.href}
                className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2.5 text-[13px] text-[var(--foreground)] hover:border-[var(--accent)]"
              >
                <span>{route.title}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{route.note}</span>
              </Link>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-[var(--border-soft)]/60 px-3 py-2.5 text-[13px] text-[var(--text-muted)]">
                <span>{route.title}</span>
                <span className="text-[11px]">{route.note} — not built yet</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
