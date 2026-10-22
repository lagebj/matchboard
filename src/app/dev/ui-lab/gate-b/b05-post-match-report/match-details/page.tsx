import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MATCH_B_TEAM_KIT_COLOR, B05_OPPONENT_NAME, b05DraftMatchIdentity } from "../../shared/match-b-fixture";

/**
 * B5/R5 — a real, fixture-backed stand-in for this match's own Match Details route (the
 * production destination `PostMatchReportPageShell` actually links to —
 * `breadcrumbHref={`/o/${orgSlug}/matches/${matchId}`}`, verified directly in
 * `src/app/(app)/o/[orgSlug]/matches/[matchId]/post-match/page.tsx`). B05's draft and completed
 * pages both link here instead of a `#matches`/plain-text placeholder, preserving this one
 * match's identity (`match-gate-b-05`) rather than inventing a fake destination or leaking to an
 * unrelated match (B01/B06).
 */
export default function B05MatchDetailsPage() {
  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate B
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">B05 — Match Details</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          The real origin and return point for this match&apos;s report — not a candidate for comparison itself.
        </p>
      </div>

      <AppearanceControl />

      <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
        <MatchIdentityCard presentation={b05DraftMatchIdentity} ownKitColor={MATCH_B_TEAM_KIT_COLOR} />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          This match&apos;s own journey
        </p>
        <span className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/10 px-3 py-2 text-[13px] text-[var(--text-muted)]">
          Live Reporting — shared production surface, not reproduced here
        </span>
        <Link
          href="/dev/ui-lab/gate-b/b05-post-match-report/draft"
          className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2 text-[13px] text-[var(--foreground)] hover:border-[var(--accent)]"
        >
          Post-match report — draft (editable)
        </Link>
        <Link
          href="/dev/ui-lab/gate-b/b05-post-match-report/completed"
          className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2 text-[13px] text-[var(--foreground)] hover:border-[var(--accent)]"
        >
          Post-match report — completed (locked)
        </Link>
      </div>

      <p className="text-[12px] text-[var(--text-muted)]">
        vs {B05_OPPONENT_NAME} — every report state above keeps this same match. Leaving either state returns here,
        not to a generic fixtures list.
      </p>
    </div>
  );
}
