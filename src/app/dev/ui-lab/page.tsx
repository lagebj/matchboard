import Link from "next/link";
import { TouchlineWordmark, AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab` index — the original seven golden reference screens
 * (bundle `13_UI_LAB_AND_GOLDEN_GATE.md §3`), the Touchline Finish & Visual
 * Convergence follow-up's seven extended routes
 * (`10_REFERENCE_CONFORMANCE.md §4`), and the appearance control.
 */
const SCREENS: { href: string; title: string; viewport: string; golden: string }[] = [
  { href: "/dev/ui-lab/league?viewport=desktop", title: "League", viewport: "1440×900", golden: "league-desktop" },
  { href: "/dev/ui-lab/league?viewport=compact&frame=phone", title: "League", viewport: "390×844", golden: "league-mobile" },
  { href: "/dev/ui-lab/today?viewport=compact&frame=phone", title: "Today", viewport: "390×844", golden: "today-mobile" },
  { href: "/dev/ui-lab/event-day?viewport=compact&frame=phone", title: "Event day", viewport: "390×844", golden: "event-day-mobile" },
  { href: "/dev/ui-lab/round-board?viewport=desktop", title: "Round Board", viewport: "1440×900", golden: "round-board-desktop" },
  { href: "/dev/ui-lab/follow-live?viewport=compact&frame=phone", title: "Follow Live", viewport: "390×844", golden: "follow-live-mobile" },
  { href: "/dev/ui-lab/insights?viewport=compact&frame=phone", title: "Insights", viewport: "390×844", golden: "insights-mobile" },
];

/** Touchline Finish & Visual Convergence follow-up — extended UI Lab gate (F4). */
const FINISH_SCREENS: { href: string; title: string; viewport: string; golden: string }[] = [
  { href: "/dev/ui-lab/shell-light?viewport=desktop&theme=light", title: "Shell (light)", viewport: "1440×900", golden: "shell-light-desktop" },
  { href: "/dev/ui-lab/shell-mobile?viewport=compact&frame=phone", title: "Shell", viewport: "390×844", golden: "shell-mobile" },
  { href: "/dev/ui-lab/event-squad?viewport=compact&frame=phone", title: "Event squad", viewport: "390×844", golden: "event-squad-mobile" },
  { href: "/dev/ui-lab/lineup?viewport=compact&frame=phone", title: "Lineup", viewport: "390×844", golden: "lineup-mobile" },
  { href: "/dev/ui-lab/live-reporting?viewport=compact&frame=phone", title: "Live reporting", viewport: "390×844", golden: "live-reporting-mobile" },
  { href: "/dev/ui-lab/player-detail?viewport=compact&frame=phone", title: "Player detail", viewport: "390×844", golden: "player-detail-mobile" },
  { href: "/dev/ui-lab/tactics?viewport=desktop", title: "Tactics", viewport: "1440×900", golden: "synthesised (06)" },
];

export default function UiLabIndexPage() {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <TouchlineWordmark />
      <h1 className="mt-4 text-[28px] font-[650] text-[var(--foreground)]">UI Lab</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Visual Identity &amp; Frontend Reset 1.0, plus the Touchline Finish &amp; Visual
        Convergence follow-up&apos;s widget/pitch/control-glass extensions. Development only; a
        hard human-approval gate before broad production migration (ADR-0134).
      </p>

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Appearance
        </p>
        <AppearanceControl />
      </div>

      <p className="mt-8 mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Original Touchline goldens
      </p>
      <ul className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
        {SCREENS.map((s) => (
          <li key={s.golden}>
            <Link
              href={s.href}
              className="flex items-center justify-between gap-4 py-3.5 no-underline transition-colors hover:bg-[var(--tl-c-surface-hover)]"
            >
              <span className="text-[15px] font-[600] text-[var(--foreground)]">{s.title}</span>
              <span className="text-[12px] tabular-nums text-[var(--text-muted)]">{s.viewport}</span>
              <span className="text-[12px] text-[var(--text-disabled)]">{s.golden}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Touchline Finish &amp; Visual Convergence follow-up (F4 gate)
      </p>
      <ul className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
        {FINISH_SCREENS.map((s) => (
          <li key={s.golden}>
            <Link
              href={s.href}
              className="flex items-center justify-between gap-4 py-3.5 no-underline transition-colors hover:bg-[var(--tl-c-surface-hover)]"
            >
              <span className="text-[15px] font-[600] text-[var(--foreground)]">{s.title}</span>
              <span className="text-[12px] tabular-nums text-[var(--text-muted)]">{s.viewport}</span>
              <span className="text-[12px] text-[var(--text-disabled)]">{s.golden}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Touchline Design Atlas &amp; Composition Convergence (Phase 3 gate)
      </p>
      <ul className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
        <li>
          <Link
            href="/dev/ui-lab/atlas"
            className="flex items-center justify-between gap-4 py-3.5 no-underline transition-colors hover:bg-[var(--tl-c-surface-hover)]"
          >
            <span className="text-[15px] font-[600] text-[var(--foreground)]">Atlas — full route composition set</span>
            <span className="text-[12px] text-[var(--text-disabled)]">31 routes</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
