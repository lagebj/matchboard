"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import type {
  SeasonSimulationRequest,
  SeasonSimulationResult,
  SimulationScope,
  SimulationPolicyMode,
  SimulationConflict,
  PlayerSimulationParticipation,
  RoundCoverageSummary,
  EventSimulationResult,
} from "@/lib/simulation/simulation-types";

interface LeagueSeasonOption {
  id: string;
  name: string;
  seasonYear: number;
  part: string;
}

const SCOPE_OPTIONS: { value: SimulationScope; label: string }[] = [
  { value: "league_round", label: "League: Selected rounds" },
  { value: "league_date_range", label: "League: Date range" },
  { value: "league_period_remainder", label: "League: Remaining period" },
  { value: "event", label: "Event" },
  { value: "combined_date_range", label: "Combined: League + events" },
];

const POLICY_MODE_OPTIONS: { value: SimulationPolicyMode; label: string }[] = [
  { value: "default_only", label: "Default policy only" },
  { value: "default_plus_rego", label: "Default + Rego comparison" },
];

const FAIRNESS_FLAG_LABELS: Record<string, string> = {
  zero_planned_opportunity: "No planned match opportunity",
  low_period_participation: "Low period participation",
  high_recent_load: "High recent load",
  eligible_not_selected: "Eligible but not selected",
  consecutive_support_burden: "Consecutive support burden",
  gk_coverage_gap: "GK coverage gap",
  position_coverage_weakness: "Position coverage weakness",
  team_disproportionate_support: "Disproportionate support",
};

const CONFLICT_TYPE_LABELS: Record<string, string> = {
  player_league_event_overlap: "League/event overlap",
  helper_conflict: "Helper conflict",
  player_overuse_same_week: "Player overuse",
  unavailable_player_planned: "Unavailable player planned",
  gk_conflict: "GK conflict",
  position_coverage_conflict: "Position coverage conflict",
};

export default function SimulationPage() {
  const [scope, setScope] = useState<SimulationScope>("league_period_remainder");
  const [policyMode, setPolicyMode] = useState<SimulationPolicyMode>("default_only");
  const [includeLeague, setIncludeLeague] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(false);
  const [leagueSeasonId, setLeagueSeasonId] = useState<string>("");
  const [leagueSeasons, setLeagueSeasons] = useState<LeagueSeasonOption[]>([]);
  const [result, setResult] = useState<SeasonSimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeagueSeasons() {
      try {
        const res = await fetch("/api/league-seasons");
        if (res.ok) {
          const data = await res.json();
          setLeagueSeasons(data);
          if (data.length > 0 && !leagueSeasonId) {
            setLeagueSeasonId(data[0].id);
          }
        }
      } catch {
        // Ignore — league season selector will be empty
      }
    }
    fetchLeagueSeasons();
  }, []);

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);

    const request: SeasonSimulationRequest = {
      scope,
      policyMode,
      includeLeague,
      includeEvents,
      includeCommittedPlans: true,
      includeDraftPlans: true,
      ...(leagueSeasonId ? { leagueSeasonId } : {}),
    };

    try {
      const res = await fetch("/api/simulation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || `HTTP ${res.status}`);
        return;
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Season Planning Simulation"
        description="Dry-run planning across league rounds and events without committing changes."
      />
      <p className="text-xs text-[var(--text-muted)] border border-[var(--border-subtle)] rounded px-2 py-1 bg-[var(--surface-muted)]">
        Simulation creates draft selections for non-finalized rounds. Existing drafts will be replaced. No finalized history is created.
      </p>

      <Surface variant="default" padding="md">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3">Simulation Scope</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-[var(--text-muted)]">League season</label>
            <select
              className="mt-1 w-full h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-sm text-zinc-100"
              value={leagueSeasonId}
              onChange={(e) => setLeagueSeasonId(e.target.value)}
            >
              <option value="">Auto-detect</option>
              {leagueSeasons.map((ls) => (
                <option key={ls.id} value={ls.id}>{ls.name} ({ls.seasonYear} {ls.part})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-[var(--text-muted)]">Scope</label>
            <select
              className="mt-1 w-full h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-sm text-zinc-100"
              value={scope}
              onChange={(e) => setScope(e.target.value as SimulationScope)}
            >
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeLeague}
                onChange={(e) => setIncludeLeague(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              Include league
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeEvents}
                onChange={(e) => setIncludeEvents(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              Include events
            </label>
          </div>
          <div>
            <label className="text-sm text-[var(--text-muted)]">Policy mode</label>
            <select
              className="mt-1 w-full h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-sm text-zinc-100"
              value={policyMode}
              onChange={(e) => setPolicyMode(e.target.value as SimulationPolicyMode)}
            >
              {POLICY_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={handleRun} disabled={loading || (!includeLeague && !includeEvents)}>
            {loading ? "Simulating..." : "Run simulation"}
          </Button>
        </div>
      </Surface>

      {error && (
        <Surface variant="danger" padding="md">
          <p className="text-sm">{error}</p>
        </Surface>
      )}

      {result?.dryRunWarning && (
        <Surface variant="warning" padding="md">
          <p className="text-sm">{result.dryRunWarning}</p>
        </Surface>
      )}

      {result && (
        <>
          <FairnessSummary fairness={result.fairness} />

          {result.league && (
            <LeagueResults
              participation={result.league.playerParticipation}
              roundCoverage={result.league.roundCoverage}
              conflicts={result.league.conflicts}
            />
          )}

          {result.events && result.events.length > 0 && (
            <EventResults events={result.events} />
          )}

          {result.conflicts.length > 0 && (
            <ConflictList conflicts={result.conflicts} />
          )}

          <Surface variant="subtle" padding="md">
            <p className="text-xs text-[var(--text-muted)]">
              Policy version: {result.policy.policyVersion} | Rego: {result.policy.regoEnabled ? "enabled" : "disabled"} | Simulation is dry-run only
            </p>
          </Surface>

          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Raw JSON (sanitized)
            </summary>
            <pre className="mt-2 p-3 bg-[var(--surface-muted)] rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(
                {
                  scope: result.request.scope,
                  fairness: {
                    totalPlayers: result.fairness.totalPlayers,
                    playersWithZeroOpportunity: result.fairness.playersWithZeroOpportunity,
                    playersWithLowParticipation: result.fairness.playersWithLowParticipation,
                    playersWithHighLoad: result.fairness.playersWithHighLoad,
                    playersEligibleNotSelected: result.fairness.playersWithEligibleNotSelected,
                    flagCount: result.fairness.flags?.length ?? 0,
                  },
                  conflicts: result.conflicts.length,
                  leagueRounds: result.league?.rounds.length ?? 0,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

function FairnessSummary({ fairness }: { fairness: SeasonSimulationResult["fairness"] }) {
  if (!fairness) return null;
  const flags = fairness.flags ?? [];

  return (
    <Surface variant="default" padding="md">
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">Fairness Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-4">
        <div><span className="text-[var(--text-muted)]">Total players</span><p className="font-bold">{fairness.totalPlayers}</p></div>
        <div><span className="text-[var(--text-muted)]">No opportunity</span><p className="font-bold text-[var(--danger)]">{fairness.playersWithZeroOpportunity}</p></div>
        <div><span className="text-[var(--text-muted)]">Low participation</span><p className="font-bold text-[var(--warning)]">{fairness.playersWithLowParticipation}</p></div>
        <div><span className="text-[var(--text-muted)]">High load</span><p className="font-bold text-[var(--warning)]">{fairness.playersWithHighLoad}</p></div>
        <div><span className="text-[var(--text-muted)]">Eligible not selected</span><p className="font-bold">{fairness.playersWithEligibleNotSelected}</p></div>
      </div>
      {flags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">Fairness Signals</h4>
          <div className="space-y-1">
            {flags.slice(0, 20).map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  f.flag === "zero_planned_opportunity" ? "bg-[var(--danger-subtle)] text-[var(--danger)]" :
                  f.flag === "high_recent_load" ? "bg-[var(--warning-subtle)] text-[var(--warning)]" :
                  "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                }`}>{FAIRNESS_FLAG_LABELS[f.flag] ?? f.flag}</span>
                <span>{f.detail}</span>
              </div>
            ))}
            {flags.length > 20 && (
              <p className="text-xs text-[var(--text-muted)]">+{flags.length - 20} more signals</p>
            )}
          </div>
        </div>
      )}
    </Surface>
  );
}

function LeagueResults({
  participation,
  roundCoverage,
  conflicts: _conflicts,
}: {
  participation: PlayerSimulationParticipation[];
  roundCoverage: RoundCoverageSummary[];
  conflicts: SimulationConflict[];
}) {
  const [sortBy, setSortBy] = useState<"name" | "opportunity" | "load">("opportunity");

  const sorted = [...participation].sort((a, b) => {
    if (sortBy === "opportunity") return a.plannedRounds - b.plannedRounds;
    if (sortBy === "load") return (b.supportAssignments + b.developmentAssignments) - (a.supportAssignments + a.developmentAssignments);
    return a.playerName.localeCompare(b.playerName);
  });

  return (
    <>
      <Surface variant="default" padding="md">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3">League Simulation</h3>
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Round Coverage</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)]">
                  <th className="text-left py-1 pr-3 text-[var(--text-muted)]">Round</th>
                  <th className="text-right py-1 px-2 text-[var(--text-muted)]">Total</th>
                  <th className="text-right py-1 px-2 text-[var(--text-muted)]">Selected</th>
                  <th className="text-right py-1 px-2 text-[var(--text-muted)]">Not selected</th>
                  <th className="text-right py-1 px-2 text-[var(--text-muted)]">GK</th>
                </tr>
              </thead>
              <tbody>
                {roundCoverage.map((r) => (
                  <tr key={r.roundId} className="border-b border-[var(--border-soft)]/50">
                    <td className="py-1 pr-3">{r.roundName}</td>
                    <td className="text-right py-1 px-2">{r.totalPlayers}</td>
                    <td className="text-right py-1 px-2">{r.selectedPlayers}</td>
                    <td className="text-right py-1 px-2">{r.notSelectedPlayers}</td>
                    <td className="text-right py-1 px-2">
                      <span className={r.gkCoverageStatus === "gap" ? "text-[var(--danger)]" : ""}>
                        {r.gkCoverageStatus === "gap" ? "Gap" : "OK"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Surface>

      <Surface variant="default" padding="md">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-zinc-100">Player Participation</h4>
          <div className="flex gap-2">
            <select
              className="h-7 rounded border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-xs text-zinc-100"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "opportunity" | "load")}
            >
              <option value="opportunity">Sort: Opportunity</option>
              <option value="load">Sort: Load</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)]">
                <th className="text-left py-1 pr-3 text-[var(--text-muted)]">Player</th>
                <th className="text-right py-1 px-2 text-[var(--text-muted)]">Planned</th>
                <th className="text-right py-1 px-2 text-[var(--text-muted)]">Core</th>
                <th className="text-right py-1 px-2 text-[var(--text-muted)]">Support</th>
                <th className="text-right py-1 px-2 text-[var(--text-muted)]">Dev</th>
                <th className="text-right py-1 px-2 text-[var(--text-muted)]">Not sel.</th>
                <th className="text-right py-1 px-2 text-[var(--text-muted)]">Unavail.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 30).map((p) => (
                <tr key={p.playerId} className="border-b border-[var(--border-soft)]/50">
                  <td className="py-1 pr-3">{p.playerName}</td>
                  <td className="text-right py-1 px-2">{p.plannedRounds}</td>
                  <td className="text-right py-1 px-2">{p.coreAssignments}</td>
                  <td className="text-right py-1 px-2">{p.supportAssignments}</td>
                  <td className="text-right py-1 px-2">{p.developmentAssignments}</td>
                  <td className="text-right py-1 px-2">{p.notSelectedRounds}</td>
                  <td className="text-right py-1 px-2">{p.unavailableRounds}</td>
                </tr>
              ))}
              {sorted.length > 30 && (
                <tr>
                  <td colSpan={7} className="text-center py-2 text-xs text-[var(--text-muted)]">
                    +{sorted.length - 30} more players
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Surface>
    </>
  );
}

function ConflictList({ conflicts }: { conflicts: SimulationConflict[] }) {
  if (conflicts.length === 0) return null;

  return (
    <Surface variant="warning" padding="md">
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">Conflicts</h3>
      <div className="space-y-1">
        {conflicts.slice(0, 20).map((c, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--warning-subtle)] text-[var(--warning)] font-medium">
              {CONFLICT_TYPE_LABELS[c.type] ?? c.type}
            </span>
            <span>{c.detail}</span>
          </div>
        ))}
        {conflicts.length > 20 && (
          <p className="text-xs text-[var(--text-muted)]">+{conflicts.length - 20} more conflicts</p>
        )}
      </div>
    </Surface>
  );
}

function EventResults({ events }: { events: EventSimulationResult[] }) {
  return (
    <Surface variant="default" padding="md">
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">Event Simulation</h3>
      <div className="space-y-4">
        {events.map((event) => (
          <div key={event.eventId} className="border border-[var(--border-soft)] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-zinc-100">{event.eventName}</h4>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                event.valid ? "bg-[var(--success-subtle)] text-[var(--success)]" : "bg-[var(--danger-subtle)] text-[var(--danger)]"
              }`}>
                {event.valid ? "Valid" : "Issues found"}
              </span>
            </div>
            {event.poolValidation && (
              <div className="text-xs text-[var(--text-muted)] mb-2">
                Pool: {event.poolValidation.availablePlayers} available | {event.poolValidation.missingRatingsCount} missing ratings | GK: {event.poolValidation.gkCoverageStatus}
              </div>
            )}
            <div className="space-y-1">
              {event.squads.map((squad) => (
                <div key={squad.squadId} className="flex items-center justify-between text-sm">
                  <span>{squad.squadName} ({squad.intent})</span>
                  <span className="text-[var(--text-muted)]">{squad.playerCount} players</span>
                </div>
              ))}
            </div>
            {event.warnings.length > 0 && (
              <div className="mt-2 text-xs text-[var(--text-muted)]">
                {event.warnings.length} warning(s)
              </div>
            )}
          </div>
        ))}
      </div>
    </Surface>
  );
}