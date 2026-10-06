import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import type { SeasonReviewTeamSummary } from "@/lib/season/get-season-review-data";
import type { MovementPathRow } from "@/lib/selection/get-season-overview";

/**
 * Season Review's Teams tab (ADR-0157 slice C7, `09_SEASON_REVIEW.md` "Teams tab"). Season-level
 * team opportunity/support distribution, support sent/received and movement paths, and recurring
 * weekly/team-review themes -- factual distribution only, never a strongest/weakest ranking.
 *
 * Deferred for this slice (disclosed in the PR): "coverage exceptions over time" and "links to
 * relevant matches/rounds" -- the disposition table lists Coverage's *other* destination as Round
 * Board (a different slice's job), and no existing season-scoped coverage-exception aggregate
 * exists yet to reuse without a disproportionate new build.
 */
export function SeasonReviewTeams({ teams, movementPaths }: { teams: SeasonReviewTeamSummary[]; movementPaths: MovementPathRow[] }) {
  if (teams.length === 0) {
    return <EmptyState title="No teams yet" description="Add teams to see season-level support and movement distribution." illustration="emptyStats" />;
  }

  const teamsWithPatterns = teams.filter((t) => t.recurringPatterns.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <Surface variant="default" padding="lg">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Support and movement distribution</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Sent and received movement counts by team this season. Factual distribution only — not a strongest/weakest ranking.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-soft)]">
                <th className="px-2 py-1.5 text-left font-semibold text-[var(--text-soft)]">Team</th>
                <th className="px-2 py-1.5 text-right font-semibold text-[var(--text-soft)]">Support sent</th>
                <th className="px-2 py-1.5 text-right font-semibold text-[var(--text-soft)]">Support received</th>
                <th className="px-2 py-1.5 text-right font-semibold text-[var(--text-soft)]">Recurring patterns</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.teamId} className="border-b border-[var(--border-soft)]/50">
                  <td className="px-2 py-1.5 text-[var(--foreground)]">{team.teamName}</td>
                  <td className="px-2 py-1.5 text-right text-[var(--text-soft)]">{team.supportSent}</td>
                  <td className="px-2 py-1.5 text-right text-[var(--text-soft)]">{team.supportReceived}</td>
                  <td className="px-2 py-1.5 text-right text-[var(--text-soft)]">{team.recurringPatterns.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      {movementPaths.length > 0 && (
        <Surface variant="default" padding="lg">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Movement paths</h3>
          <div className="mt-3 flex flex-col gap-1.5">
            {movementPaths.map((p, i) => (
              <div key={`${p.fromTeamId}-${p.toTeamId}-${p.role}-${i}`} className="flex items-center justify-between text-xs">
                <span className="text-[var(--foreground)]">
                  {p.fromTeamName} → {p.toTeamName}
                </span>
                <span className="text-[var(--text-muted)]">
                  {p.role} · {p.count} ({p.uniquePlayers} player{p.uniquePlayers === 1 ? "" : "s"})
                </span>
              </div>
            ))}
          </div>
        </Surface>
      )}

      {teamsWithPatterns.length > 0 && (
        <Surface variant="default" padding="lg">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Recurring weekly/team-review themes</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Reused from weekly team review's own deterministic recurring-theme evidence — a phase shown in 2 or more matches.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {teamsWithPatterns.map((team) => (
              <div key={team.teamId}>
                <p className="text-xs font-medium text-[var(--text-soft)]">{team.teamName}</p>
                <div className="mt-1 flex flex-col gap-1">
                  {team.recurringPatterns.map((pattern) => (
                    <p key={pattern.phase} className="text-xs text-[var(--text-muted)]">
                      {pattern.phase}: working in {pattern.matchesWithWorking} match{pattern.matchesWithWorking === 1 ? "" : "es"}, problem in{" "}
                      {pattern.matchesWithProblem} match{pattern.matchesWithProblem === 1 ? "" : "es"}
                      {pattern.consecutiveStreak
                        ? ` · current streak: ${pattern.consecutiveStreak.direction.toLowerCase()} for ${pattern.consecutiveStreak.count} match${pattern.consecutiveStreak.count === 1 ? "" : "es"}`
                        : ""}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Surface>
      )}
    </div>
  );
}
