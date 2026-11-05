import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-b` index — Gate B candidates (official register
 * `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv`). Dev-only, fixture-backed, `CANDIDATE` only — no
 * production route, component, or data loader is changed by this programme. See
 * `docs/ui-lab/gate-b-w1-candidates/` (B01-B04) and `docs/ui-lab/gate-b-w2-candidates/` (B05)
 * for the full review records.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-b/b01-planned-ready", id: "B01", title: "Before match, planned ready" },
  { href: "/dev/ui-lab/gate-b/b02-planned-incomplete", id: "B02", title: "Before match, planned incomplete" },
  { href: "/dev/ui-lab/gate-b/b03-completed-sparse", id: "B03", title: "Completed match, sparse events (6-4, one recorded event)" },
  { href: "/dev/ui-lab/gate-b/b04-completed-rich", id: "B04", title: "Completed match, richer evidence" },
  { href: "/dev/ui-lab/gate-b/b05-post-match-report/draft", id: "B05", title: "Post-match report, draft (editable, with a fixture-simulated completion)" },
  { href: "/dev/ui-lab/gate-b/b05-post-match-report/completed", id: "B05-COMPLETED", title: "Post-match report, completed (locked, read-only)" },
  { href: "/dev/ui-lab/gate-b/b05-post-match-report/match-details", id: "B05-NAV", title: "Post-match report — Match Details (navigation origin, not a comparison candidate)" },
  { href: "/dev/ui-lab/gate-b/b06-league-event-parity/league/before", id: "B06-LEAGUE-BEFORE", title: "League/Event parity — League, before" },
  { href: "/dev/ui-lab/gate-b/b06-league-event-parity/league/after", id: "B06-LEAGUE-AFTER", title: "League/Event parity — League, after" },
  { href: "/dev/ui-lab/gate-b/b06-league-event-parity/event/before", id: "B06-EVENT-BEFORE", title: "League/Event parity — Event, before (design proposal)" },
  { href: "/dev/ui-lab/gate-b/b06-league-event-parity/event/after", id: "B06-EVENT-AFTER", title: "League/Event parity — Event, after (locked report)" },
  { href: "/dev/ui-lab/gate-b/b06-league-event-parity/league/match-details", id: "B06-LEAGUE-NAV", title: "League/Event parity — League Match Details (navigation origin, not a comparison candidate)" },
  { href: "/dev/ui-lab/gate-b/b06-league-event-parity/event/event-detail", id: "B06-EVENT-NAV", title: "League/Event parity — Event Detail (navigation origin, not a comparison candidate)" },
  { href: "/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/historical-pattern", id: "B07-HISTORICAL-PATTERN", title: "Assistant Coach longitudinal context — meaningful historical pattern" },
  { href: "/dev/ui-lab/gate-b/b07-assistant-coach-longitudinal/trivial-fact", id: "B07-TRIVIAL-FACT", title: "Assistant Coach longitudinal context — trivial hat-trick fact (contrast)" },
];

export default function GateBIndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; UI Lab
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">Gate B — Match Details &amp; Post-Match Report</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        B01-B04 (W1), B05 (W2), B06 (W3, League/Event parity), and B07 (W4, Assistant Coach
        longitudinal context). B08 (information ownership/transitions) remains deferred, not
        deleted from scope. Dev-only, synthetic fixtures only.
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
