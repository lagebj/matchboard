import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * `/dev/ui-lab/gate-c/c08-same-day-quick-add` index — register C08 (Gate C W3). Dev-only,
 * fixture-backed, `CANDIDATE` only, covering the Today-side quick-add states (A/B/C below) that
 * are fully prop-driven and can be meaningfully fixture-displayed without faking a mutation.
 *
 * C08-D (guest) and C08-E (late arrival) are NOT built as fixture routes here: the real
 * `AddPlayerDialog` self-fetches its candidate lists via real Server Actions
 * (`getLeagueMatchHelperCandidatesAction`/`getLeagueMatchGuestCandidatesAction`), so it cannot be
 * meaningfully mounted against static props without either (a) hitting a real seeded match
 * anyway, or (b) faking a result — the brief's own §7 forbids exactly that ("A simulated success
 * message without a successful underlying mutation is not acceptable"). Those two scenarios are
 * instead verified and captured via authenticated Playwright evidence against a real seeded
 * match (`e2e/gate-c-w3-match-day-additions.spec.ts`) — see `docs/ui-lab/gate-c-w3-candidates/`
 * for the full disclosure and visual evidence.
 */
const SCENARIOS = [
  { href: "/dev/ui-lab/gate-c/c08-same-day-quick-add/planning-open", id: "C08-A", title: "Planning open" },
  { href: "/dev/ui-lab/gate-c/c08-same-day-quick-add/after-availability-change", id: "C08-B", title: "After RSVP (tentative availability)" },
  { href: "/dev/ui-lab/gate-c/c08-same-day-quick-add/planning-closed", id: "C08-C", title: "Planning closed" },
];

export default function C08IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-c" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate C
      </Link>
      <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">C08 — Same-day quick add</h1>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">
        A/B/C below are fixture-driven displays of Today&apos;s real quick-add. D (guest) and E
        (late arrival) use the real Match Details &quot;Add player&quot; dialog, which self-fetches
        from Server Actions and so is verified via authenticated Playwright evidence instead — see
        docs/ui-lab/gate-c-w3-candidates/ for the full disclosure.
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
