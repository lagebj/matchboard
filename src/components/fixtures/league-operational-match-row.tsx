import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Radio } from "lucide-react";
import { cn } from "@/lib/cn";
import { TeamIdentityStrip } from "@/components/touchline";
import { formatKickoffDateTime } from "@/lib/date-utils";
import type { LeagueFocusedMatch, LeagueFocusedMatchIssueKind } from "@/lib/touchline/presentation/league-view-model";

/**
 * LeagueOperationalMatchRow — League Operating Surface (`01_GOLDEN_REFERENCE_CONTRACT.md
 * §"Match rows"`, `06_COMPONENT_COMPOSITION_CONTRACT.md`).
 *
 * The focused round's per-match operational row:
 * `[team identity strip]  Team / opponent   kickoff + venue   operational state/action   >`.
 * Every fact comes from the already-resolved `LeagueFocusedMatch` — no domain computation here.
 */
type Props = {
  match: LeagueFocusedMatch;
};

function toneClassName(kind: LeagueFocusedMatchIssueKind): string {
  switch (kind) {
    case "BLOCKED":
    case "REPORT_MISSING":
    case "REPORT_INCOMPLETE":
      return "text-[var(--danger)]";
    case "DECISION_REQUIRED":
    case "TACTICS_MISSING":
      return "text-[var(--warning)]";
    case "LIVE":
      return "text-[var(--tl-c-live)]";
    case "READY":
    case "DONE":
      return "text-[var(--success,var(--tl-c-live))]";
    default:
      return "text-[var(--text-muted)]";
  }
}

function IssueIcon({ kind }: { kind: LeagueFocusedMatchIssueKind }) {
  const className = cn("h-4 w-4 shrink-0", toneClassName(kind));
  switch (kind) {
    case "BLOCKED":
    case "DECISION_REQUIRED":
    case "TACTICS_MISSING":
    case "REPORT_MISSING":
    case "REPORT_INCOMPLETE":
      return <AlertTriangle aria-hidden="true" className={className} />;
    case "READY":
    case "DONE":
      return <CheckCircle2 aria-hidden="true" className={className} />;
    case "LIVE":
      return <Radio aria-hidden="true" className={className} />;
    default:
      return <Clock aria-hidden="true" className={className} />;
  }
}

export function LeagueOperationalMatchRow({ match }: Props) {
  const kickoff = match.startsAt ? new Date(match.startsAt) : null;
  const cancelled = match.matchStatus === "CANCELLED";
  const { issue } = match;

  const detail =
    issue.kind === "READY" && match.selectedPlayerCount != null
      ? `${match.selectedPlayerCount} player${match.selectedPlayerCount === 1 ? "" : "s"} planned`
      : issue.extraCount
        ? `+${issue.extraCount} more`
        : null;

  // Step 10 (focused match action navigation): the whole row navigates to the same canonical
  // target its action label promises (e.g. `?tab=tactics`) — never a League-owned mutation, and
  // never a mismatch between the visible action and where the row actually goes.
  const target = cancelled ? match.href : (issue.actionTarget ?? match.href);

  return (
    <Link
      href={target}
      className={cn(
        "-mx-2 flex items-stretch gap-3 rounded-[var(--tl-c-radius-control)] px-2 py-3 no-underline transition-colors hover:bg-[var(--tl-c-surface-hover)]",
        cancelled && "opacity-60",
      )}
    >
      <TeamIdentityStrip kitColor={match.teamKitColor} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-[620] text-[var(--foreground)]">{match.teamName}</p>
        <p className="truncate text-[12px] text-[var(--text-muted)]">
          {match.venue ? `${match.venue}` : null}
          {match.venue && match.opponent ? " · " : null}
          {match.opponent ? `vs ${match.opponent}` : null}
        </p>
      </div>

      <div className="hidden w-[9.5rem] shrink-0 flex-col justify-center text-[12px] text-[var(--text-muted)] medium:flex">
        {kickoff ? formatKickoffDateTime(kickoff) : "—"}
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-end justify-center gap-0.5 text-right medium:w-[13rem] medium:flex-none">
        {cancelled ? (
          <span className="text-[13px] font-medium text-[var(--text-muted)]">
            Cancelled{match.cancelledReason ? ` · ${match.cancelledReason}` : ""}
          </span>
        ) : (
          <>
            <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", toneClassName(issue.kind))}>
              <IssueIcon kind={issue.kind} />
              {issue.label}
            </span>
            {detail ? <span className="text-[12px] text-[var(--text-muted)]">{detail}</span> : null}
            {issue.actionLabel ? (
              <span className={cn("text-[12px] font-medium", toneClassName(issue.kind))}>
                {issue.actionLabel} <span aria-hidden="true">→</span>
              </span>
            ) : null}
          </>
        )}
      </div>

      <span aria-hidden="true" className="flex shrink-0 items-center text-[var(--text-muted)]">
        ›
      </span>
    </Link>
  );
}
