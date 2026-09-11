import Link from "next/link";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { atlasNav, teamsOverviewViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Teams overview — `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §C`.
 * Matchboard owns its own teams, not an external standings table — no "league position" column.
 */
export default function AtlasTeamsPage() {
  const vm = teamsOverviewViewModel;

  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[1000px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Teams" context="Results and match record" actions={<TouchlineButton variant="primary">New team</TouchlineButton>} />

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
              <th className="py-2 pr-3 font-semibold">Team</th>
              <th className="py-2 pr-3 font-semibold">Played</th>
              <th className="py-2 pr-3 font-semibold">W-D-L</th>
              <th className="py-2 pr-3 font-semibold">GF</th>
              <th className="py-2 pr-3 font-semibold">GA</th>
              <th className="py-2 pr-3 font-semibold">GD</th>
              <th className="py-2 pr-3 font-semibold">Clean sheets</th>
              <th className="py-2 pr-3 font-semibold">Core players</th>
              <th className="py-2 font-semibold">Attention</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)]">
            {vm.rows.map((r) => (
              <tr key={r.teamId}>
                <td className="py-2.5 pr-3 font-[600] text-[var(--foreground)]"><Link href="#" className="no-underline text-[var(--foreground)]">{r.teamName}</Link></td>
                <td className="py-2.5 pr-3 tabular-nums">{r.matchesPlayed}</td>
                <td className="py-2.5 pr-3 tabular-nums">{r.wins}-{r.draws}-{r.losses}</td>
                <td className="py-2.5 pr-3 tabular-nums">{r.goalsFor}</td>
                <td className="py-2.5 pr-3 tabular-nums">{r.goalsAgainst}</td>
                <td className="py-2.5 pr-3 tabular-nums">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
                <td className="py-2.5 pr-3 tabular-nums">{r.cleanSheets}</td>
                <td className="py-2.5 pr-3 tabular-nums">{r.corePlayerCount}</td>
                <td className="py-2.5 text-[var(--warning)]">{r.unresolvedPlanningAttentionCount > 0 ? r.unresolvedPlanningAttentionCount : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UiLabShell>
  );
}
