import { ScorebookRoundSection, ScorebookMatchRow } from "@/components/touchline";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";
import type { LeagueHistoryRound } from "@/lib/touchline/presentation/league-view-model";
import type { FixtureMatch } from "@/domain/fixtures/types";

/**
 * LeagueRecentRounds / LeagueEarlierRounds — League Operating Surface
 * (`06_COMPONENT_COMPOSITION_CONTRACT.md §"Compact recent scorebook history"`).
 *
 * The completed-round tail of the League surface reuses the existing dense scorebook grammar
 * (`ScorebookRoundSection` + `ScorebookMatchRow`) unchanged — operational focused-row components
 * are never forced onto finished history. "Recent" is capped at 2 rounds by
 * `buildLeagueOperatingViewModel()`; everything else sits behind a local "Show earlier rounds"
 * disclosure with no persistence.
 */
function HistoryMatchRow({ match }: { match: FixtureMatch }) {
  const isCancelled = match.matchStatus === "CANCELLED";
  const completedResult =
    match.reportState.state === "COMPLETED" ? match.reportState.result : undefined;

  const blockerCount = match.blockerCount ?? 0;
  const decisionRequiredCount = match.decisionRequiredCount ?? 0;
  const planningAttention =
    blockerCount > 0
      ? { label: `${blockerCount} blocked`, tone: "danger" as const }
      : decisionRequiredCount > 0
        ? {
            label: `${decisionRequiredCount} decision${decisionRequiredCount === 1 ? "" : "s"}`,
            tone: "warning" as const,
          }
        : null;
  const reportAttention =
    match.reportState.state === "DRAFT_REPORT_INCOMPLETE"
      ? { label: "Report incomplete", tone: "warning" as const }
      : null;

  const presentation = buildMatchPresentation({
    id: match.id,
    href: `/matches/${match.id}`,
    teamName: match.teamName,
    opponentName: match.opponent,
    isHome: match.venue === "Home",
    kickoffAt: match.startsAt ?? null,
    lifecycleStatus: isCancelled ? "cancelled" : match.lifecycleStatus,
    ownGoals: completedResult ? completedResult.goalsFor : null,
    opponentGoals: completedResult ? completedResult.goalsAgainst : null,
    outcome: completedResult ? completedResult.outcome : null,
    planningAttention,
    reportAttention,
    cancelledReason: isCancelled ? (match.cancelledReason ?? null) : null,
  });

  return <ScorebookMatchRow presentation={presentation} href={presentation.href ?? undefined} />;
}

function HistoryRoundSection({ round }: { round: LeagueHistoryRound }) {
  const matchCount = round.matches.length;
  const summary = [
    round.statusLabel,
    matchCount > 0 ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : "No matches",
  ].join(" · ");

  return (
    <ScorebookRoundSection
      marker={round.title}
      summary={summary}
      boardHref={`/rounds/${round.id}`}
      boardAriaLabel={`Open ${round.title} round board`}
    >
      {round.matches.length > 0 ? (
        round.matches.map((match) => <HistoryMatchRow key={match.id} match={match} />)
      ) : (
        <p className="py-3 text-[13px] text-[var(--text-muted)]">No matches in this round.</p>
      )}
    </ScorebookRoundSection>
  );
}

export function LeagueRecentRounds({ rounds }: { rounds: LeagueHistoryRound[] }) {
  if (rounds.length === 0) return null;
  return (
    <div className="flex flex-col">
      {rounds.map((round) => (
        <HistoryRoundSection key={round.id} round={round} />
      ))}
    </div>
  );
}

export function LeagueEarlierRounds({
  rounds,
  expanded,
  onToggle,
}: {
  rounds: LeagueHistoryRound[];
  expanded: boolean;
  onToggle: () => void;
}) {
  if (rounds.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="self-start text-[13px] font-medium text-[var(--text-soft)] hover:text-[var(--foreground)]"
      >
        {expanded ? "Hide earlier rounds" : `Show earlier rounds (${rounds.length})`}
      </button>
      {expanded ? (
        <div className="flex flex-col">
          {rounds.map((round) => (
            <HistoryRoundSection key={round.id} round={round} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
