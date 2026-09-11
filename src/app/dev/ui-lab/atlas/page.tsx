import Link from "next/link";
import { TouchlineWordmark, AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/atlas` index — Touchline Design Atlas & Composition Convergence
 * (`13_IMPLEMENTATION_PHASES_AND_GATES.md`, Phase 3: "route-complete UI Lab").
 *
 * Every route in `data/route-composition-matrix.json` (bar the two non-route reference rows,
 * `/insights/*` — represented by the one Insights hub route below — and "brand assets", which
 * belongs to the later Phase 11 brand/PWA work, not this phase's route composition).
 *
 * This is a Hard-Gate-A checkpoint artifact: development-only, no production route touched.
 * See docs/domain/touchline-atlas-provenance.md for full data-provenance detail per route.
 */
const ROUTES: { href: string; title: string; note: string }[] = [
  { href: "/dev/ui-lab/atlas/routes/today", title: "Today", note: "05§A" },
  { href: "/dev/ui-lab/atlas/routes/league", title: "League", note: "05§B" },
  { href: "/dev/ui-lab/atlas/routes/history", title: "History", note: "05§C" },
  { href: "/dev/ui-lab/atlas/routes/round-board", title: "Round Board", note: "08§A" },
  { href: "/dev/ui-lab/atlas/routes/match-detail", title: "Match detail", note: "06§D" },
  { href: "/dev/ui-lab/atlas/routes/lineup", title: "Lineup", note: "08§B" },
  { href: "/dev/ui-lab/atlas/routes/tactics", title: "Tactics", note: "08§C" },
  { href: "/dev/ui-lab/atlas/routes/rotations", title: "Rotations", note: "08§D" },
  { href: "/dev/ui-lab/atlas/routes/live-reporting", title: "Live reporting", note: "06§F" },
  { href: "/dev/ui-lab/atlas/routes/follow-live", title: "Follow live", note: "06§G" },
  { href: "/dev/ui-lab/atlas/routes/post-match", title: "Post-match", note: "06§H" },
  { href: "/dev/ui-lab/atlas/routes/events", title: "Events", note: "06§A" },
  { href: "/dev/ui-lab/atlas/routes/event-detail", title: "Event detail", note: "06§B" },
  { href: "/dev/ui-lab/atlas/routes/event-squad", title: "Event squad", note: "06§C" },
  { href: "/dev/ui-lab/atlas/routes/players", title: "Players", note: "07§A" },
  { href: "/dev/ui-lab/atlas/routes/player-detail", title: "Player detail", note: "07§B" },
  { href: "/dev/ui-lab/atlas/routes/insights", title: "Insights", note: "07§C" },
  { href: "/dev/ui-lab/atlas/routes/opponents", title: "Opponents", note: "09§A" },
  { href: "/dev/ui-lab/atlas/routes/opponent-detail", title: "Opponent detail", note: "09§B" },
  { href: "/dev/ui-lab/atlas/routes/teams", title: "Teams", note: "09§C" },
  { href: "/dev/ui-lab/atlas/routes/team-detail", title: "Team detail", note: "09§D" },
  { href: "/dev/ui-lab/atlas/routes/season", title: "Season", note: "09§E" },
  { href: "/dev/ui-lab/atlas/routes/formations", title: "Formations", note: "10§A" },
  { href: "/dev/ui-lab/atlas/routes/groups", title: "Groups", note: "10§B" },
  { href: "/dev/ui-lab/atlas/routes/rules", title: "Rules", note: "10§C" },
  { href: "/dev/ui-lab/atlas/routes/settings", title: "Settings", note: "10§D" },
  { href: "/dev/ui-lab/atlas/routes/more", title: "More", note: "10§E" },
  { href: "/dev/ui-lab/atlas/routes/reviews", title: "Peer reviews", note: "10§F" },
  { href: "/dev/ui-lab/atlas/routes/invitation", title: "Invitation", note: "10§H" },
  { href: "/dev/ui-lab/atlas/routes/system-states", title: "System states", note: "10§I" },
  { href: "/dev/ui-lab/atlas/components", title: "Widget/viz component gallery", note: "Phase 2 gate" },
];

export default function AtlasIndexPage() {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <TouchlineWordmark />
      <h1 className="mt-4 text-[28px] font-[650] text-[var(--foreground)]">Touchline Design Atlas</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Phase 3 gate: route-complete UI Lab. Development only — no production route has been
        touched. Awaiting Hard Gate A human visual approval before any production migration.
      </p>

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Appearance</p>
        <AppearanceControl />
      </div>

      <p className="mt-8 mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Routes ({ROUTES.length})
      </p>
      <ul className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
        {ROUTES.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="flex items-center justify-between gap-4 py-3 no-underline transition-colors hover:bg-[var(--tl-c-surface-hover)]"
            >
              <span className="text-[14px] font-[600] text-[var(--foreground)]">{r.title}</span>
              <span className="text-[12px] text-[var(--text-disabled)]">{r.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
