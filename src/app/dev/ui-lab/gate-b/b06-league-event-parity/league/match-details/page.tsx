import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MATCH_B_TEAM_KIT_COLOR, B06_LEAGUE_OPPONENT_NAME } from "../../../shared/match-b-fixture";
import { matchIdentity as beforeIdentity } from "../before/fixtures";

/**
 * B3-R5 — a real, fixture-backed stand-in for League Match Details (the production route this
 * match genuinely lives at), separate from `CompareNav`'s reviewer-navigation strip. Its own job
 * is to be the real origin/return point for the League journey: planning → Match Details →
 * Live Reporting → Post-Match Report → back here, every step keeping this one match's identity.
 * `league/before` and `league/after` link back here, not to a generic page.
 */
export default function B06LeagueMatchDetailsPage() {
  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate B
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">B06 — League Match Details</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          The real origin and return point for this match — not a candidate for comparison itself.
        </p>
      </div>

      <AppearanceControl />

      <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
        <MatchIdentityCard presentation={beforeIdentity} ownKitColor={MATCH_B_TEAM_KIT_COLOR} />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          This match&apos;s own journey
        </p>
        <Link
          href="/dev/ui-lab/gate-b/b06-league-event-parity/league/before"
          className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2 text-[13px] text-[var(--foreground)] hover:border-[var(--accent)]"
        >
          Before kickoff — planning, lineup
        </Link>
        <span className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/10 px-3 py-2 text-[13px] text-[var(--text-muted)]">
          Live Reporting — shared production surface, not reproduced here
        </span>
        <Link
          href="/dev/ui-lab/gate-b/b06-league-event-parity/league/after"
          className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2 text-[13px] text-[var(--foreground)] hover:border-[var(--accent)]"
        >
          After the match — result, report
        </Link>
      </div>

      <p className="text-[12px] text-[var(--text-muted)]">
        vs {B06_LEAGUE_OPPONENT_NAME} — every step above keeps this same match. Leaving either state returns here,
        not to a generic fixtures list.
      </p>
    </div>
  );
}
