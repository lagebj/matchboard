import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

const STATES = [
  { href: "/dev/ui-lab/gate-e/e02-event-day/upcoming", title: "Upcoming event day", id: "GATE-E-W2-E02-UPCOMING" },
  { href: "/dev/ui-lab/gate-e/e02-event-day/mixed-progression", title: "Mixed event-day progression", id: "GATE-E-W2-E02-MIXED" },
  { href: "/dev/ui-lab/gate-e/e02-event-day/completed", title: "Completed event day", id: "GATE-E-W2-E02-COMPLETED" },
];

/**
 * `/dev/ui-lab/gate-e/e02-event-day` index — Gate E register row E02 ("Events / Event day").
 * See `docs/ui-lab/gate-e-w2-candidates/SCENARIO_REGISTER.md`.
 */
export default function E02IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-e" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate E
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">E02 — Event day</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        Multi-match event-day progression across squads and states with persistent event and match
        identity (XR-T01, XR-S01, XR-V02). Renders canonical event-match records through the real
        <code> buildMatchPresentation()</code>, <code>TouchlineTimeline</code> and <code>ScorebookMatchRow</code>.
      </p>

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Appearance</p>
        <AppearanceControl />
      </div>

      <ul className="mt-8 flex flex-col gap-1.5">
        {STATES.map((s) => (
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
