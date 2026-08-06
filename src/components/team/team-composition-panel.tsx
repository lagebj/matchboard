"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import type { SystemTeamScenario } from "@/domain/team-composition/team-composition-types";
import type { TeamCompositionProposal, ProposedTeamAssignment, ProposalIssue } from "@/domain/team-composition/team-composition-types";
import { getAllSystemScenarios, isScenarioPolicyGated } from "@/domain/team-composition/scenario-catalogue";
import type { GameFormat } from "@/domain/team-composition/structural-requirements";
import { GAME_FORMAT_PLAYER_COUNT } from "@/domain/team-composition/structural-requirements";
import { generateLeagueTeamPreviewAction, applyLeagueTeamProposalAction, getCompositionFormationOptionsAction, type FormationOption } from "@/app/(app)/o/[orgSlug]/teams/team-composition-actions";
import { formatGameFormat } from "@/lib/formatters/game-format";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { StatusPill } from "@/components/ui/status-pill";
import { Dialog } from "@/components/ui/dialog";
import { Shuffle, CheckCircle2 } from "lucide-react";

const SCENARIOS = getAllSystemScenarios();

const GAME_FORMATS: GameFormat[] = ["THREE_A_SIDE", "FIVE_A_SIDE", "SEVEN_A_SIDE", "NINE_A_SIDE", "ELEVEN_A_SIDE"];

const ROLE_LABELS: Record<string, string> = {
  GOALKEEPER: "GK",
  DEFENCE: "DEF",
  MIDFIELD: "MID",
  ATTACK: "ATT",
  FLEXIBLE: "FLX",
};

const FIT_LABELS: Record<string, string> = {
  PRIMARY: "P",
  SECONDARY: "S",
  TERTIARY: "T",
  NO_FIT: "\u2014",
};

const GK_COVERAGE_LABELS: Record<string, string> = {
  full: "Full GK",
  emergency: "Emergency GK",
  none: "No GK",
};

const VIABILITY_LABELS: Record<string, string> = {
  viable: "Viable",
  degraded: "Degraded",
  broken: "Broken",
};

type Step = "select" | "preview" | "apply";

type TeamCompositionPanelProps = {
  footballGroupId: string;
  leagueSeasons: { id: string; name: string; status: string }[];
  teamCount: number;
  playerCount: number;
  orgSlug: string;
  defaultGameFormat?: GameFormat;
};

export function TeamCompositionPanel({
  footballGroupId,
  leagueSeasons,
  teamCount,
  playerCount,
  orgSlug,
  defaultGameFormat = "SEVEN_A_SIDE",
}: TeamCompositionPanelProps) {
  const [step, setStep] = useState<Step>("select");
  const [selectedScenario, setSelectedScenario] = useState<SystemTeamScenario>("BALANCED");
  const [selectedGameFormat, setSelectedGameFormat] = useState<GameFormat>(defaultGameFormat);
  const [selectedFormationId, setSelectedFormationId] = useState<string>("");
  const [formationOptions, setFormationOptions] = useState<FormationOption[]>([]);
  const [loadingFormations, setLoadingFormations] = useState(false);
  const [proposal, setProposal] = useState<TeamCompositionProposal | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);

  const draftSeasons = leagueSeasons.filter((s) => s.status !== "FINALIZED");
  const defaultSeason = draftSeasons[0] ?? leagueSeasons[0];
  const [selectedSeasonId, setSelectedSeasonId] = useState(defaultSeason?.id ?? "");
  const selectedSeason = leagueSeasons.find((s) => s.id === selectedSeasonId);
  const isFinalized = selectedSeason?.status === "FINALIZED";

  const isPolicyGated = isScenarioPolicyGated(selectedScenario);

  useEffect(() => {
    let cancelled = false;
    setLoadingFormations(true);
    setFormationOptions([]);
    setSelectedFormationId("");
    getCompositionFormationOptionsAction(selectedGameFormat)
      .then((options) => {
        if (!cancelled) {
          setFormationOptions(options);
          setLoadingFormations(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingFormations(false);
      });
    return () => { cancelled = true; };
  }, [selectedGameFormat]);

  const handleScenarioChange = useCallback((scenario: SystemTeamScenario) => {
    setSelectedScenario(scenario);
    if (isScenarioPolicyGated(scenario) !== isScenarioPolicyGated(selectedScenario)) {
      setPolicyAcknowledged(false);
    }
  }, [selectedScenario]);

  const handleGenerate = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateLeagueTeamPreviewAction({
          footballGroupId,
          leagueSeasonId: selectedSeasonId,
          scenario: selectedScenario,
          gameFormat: selectedGameFormat,
          formationId: selectedFormationId || undefined,
          coachAcknowledgedPolicyGate: isPolicyGated ? policyAcknowledged : undefined,
        });
        setProposal(result);
        setStep("preview");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate preview");
      }
    });
  }, [footballGroupId, selectedSeasonId, selectedScenario, selectedGameFormat, selectedFormationId, isPolicyGated, policyAcknowledged]);

  const handleApply = useCallback(() => {
    if (!proposal) return;
    setError(null);
    startTransition(async () => {
      try {
        await applyLeagueTeamProposalAction({
          footballGroupId,
          leagueSeasonId: selectedSeasonId,
          scenario: selectedScenario,
          gameFormat: selectedGameFormat,
          formationId: selectedFormationId || undefined,
          deterministicSeed: proposal.deterministicSeed,
          proposalIdempotencyKey: proposal.inputFingerprint,
        });
        setStep("apply");
        setProposal(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to apply composition");
      }
    });
  }, [footballGroupId, selectedSeasonId, selectedScenario, selectedGameFormat, selectedFormationId, proposal]);

  const handleReset = useCallback(() => {
    setStep("select");
    setProposal(null);
    setError(null);
  }, []);

  const handleRegenerate = useCallback(() => {
    setStep("select");
    setProposal(null);
    setError(null);
  }, []);

  if (teamCount < 2) {
    return (
      <Surface variant="subtle" padding="md">
        <p className="text-sm text-[var(--text-muted)]">
          Team composition requires at least 2 teams in this group.
        </p>
      </Surface>
    );
  }

  if (leagueSeasons.length === 0) {
    return (
      <Surface variant="subtle" padding="md">
        <SectionHeader
          title="Auto-select teams"
          description="Create a league season for this group before using auto-select."
        />
      </Surface>
    );
  }

  if (isFinalized) {
    return (
      <Surface variant="subtle" padding="md">
        <SectionHeader
          title="Auto-select teams"
          description={`The league season "${selectedSeason?.name ?? ""}" is finalized. Select an active season to generate team assignments.`}
        />
        <div className="mt-3">
          <label className="block text-xs text-[var(--text-muted)] mb-1">League season</label>
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
          >
            {leagueSeasons.map((s) => (
              <option key={s.id} value={s.id} disabled={s.status === "FINALIZED"}>
                {s.name} {s.status === "FINALIZED" ? "(Finalized)" : ""}
              </option>
            ))}
          </select>
        </div>
      </Surface>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <DecisionBanner variant="blocked" title={error} />}

      {step === "select" && (
        <ScenarioSelector
          selectedScenario={selectedScenario}
          onSelectScenario={handleScenarioChange}
          onGenerate={handleGenerate}
          isPending={isPending}
          teamCount={teamCount}
          playerCount={playerCount}
          leagueSeasonName={selectedSeason?.name ?? "No season"}
          leagueSeasons={leagueSeasons}
          selectedSeasonId={selectedSeasonId}
          onSeasonChange={setSelectedSeasonId}
          isPolicyGated={isPolicyGated}
          policyAcknowledged={policyAcknowledged}
          onPolicyAcknowledgedChange={setPolicyAcknowledged}
          selectedGameFormat={selectedGameFormat}
          onGameFormatChange={setSelectedGameFormat}
          selectedFormationId={selectedFormationId}
          onFormationChange={setSelectedFormationId}
          formationOptions={formationOptions}
          loadingFormations={loadingFormations}
        />
      )}

      {step === "preview" && proposal && (
        <ProposalPreview
          proposal={proposal}
          onApply={handleApply}
          onRegenerate={handleRegenerate}
          onCancel={handleReset}
          isPending={isPending}
        />
      )}

      {step === "apply" && (
        <Surface variant="default" padding="md">
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-10 w-10 text-[var(--accent-strong)]" />
            <p className="text-sm text-[var(--text-soft)]">
              Team composition applied. Player core-team assignments have been updated.
            </p>
            <Button variant="secondary" size="sm" as="a" href={`/o/${orgSlug}/teams`}>
              View teams
            </Button>
          </div>
        </Surface>
      )}
    </div>
  );
}

function ScenarioSelector({
  selectedScenario,
  onSelectScenario,
  onGenerate,
  isPending,
  teamCount,
  playerCount,
  leagueSeasonName,
  leagueSeasons,
  selectedSeasonId,
  onSeasonChange,
  isPolicyGated,
  policyAcknowledged,
  onPolicyAcknowledgedChange,
  selectedGameFormat,
  onGameFormatChange,
  selectedFormationId,
  onFormationChange,
  formationOptions,
  loadingFormations,
}: {
  selectedScenario: SystemTeamScenario;
  onSelectScenario: (s: SystemTeamScenario) => void;
  onGenerate: () => void;
  isPending: boolean;
  teamCount: number;
  playerCount: number;
  leagueSeasonName: string;
  leagueSeasons: { id: string; name: string; status: string }[];
  selectedSeasonId: string;
  onSeasonChange: (id: string) => void;
  isPolicyGated: boolean;
  policyAcknowledged: boolean;
  onPolicyAcknowledgedChange: (v: boolean) => void;
  selectedGameFormat: GameFormat;
  onGameFormatChange: (f: GameFormat) => void;
  selectedFormationId: string;
  onFormationChange: (id: string) => void;
  formationOptions: FormationOption[];
  loadingFormations: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fallbackSlotCount = GAME_FORMAT_PLAYER_COUNT[selectedGameFormat];

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Auto-select teams"
        description={`Generate team assignments for ${leagueSeasonName} using a composition scenario. This will preview proposed assignments before applying.`}
      />

      {leagueSeasons.length > 1 && (
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">League season</label>
          <select
            value={selectedSeasonId}
            onChange={(e) => onSeasonChange(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
          >
            {leagueSeasons.map((s) => (
              <option key={s.id} value={s.id} disabled={s.status === "FINALIZED"}>
                {s.name} {s.status === "FINALIZED" ? "(Finalized)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Game format</label>
          <select
            value={selectedGameFormat}
            onChange={(e) => onGameFormatChange(e.target.value as GameFormat)}
            className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
          >
            {GAME_FORMATS.map((f) => (
              <option key={f} value={f}>{formatGameFormat(f)} ({GAME_FORMAT_PLAYER_COUNT[f]} players)</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Formation (optional)</label>
          <select
            value={selectedFormationId}
            onChange={(e) => onFormationChange(e.target.value)}
            disabled={loadingFormations}
            className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          >
            <option value="">Default {formatGameFormat(selectedGameFormat)} formation</option>
            {formationOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} {f.source === "SYSTEM" ? "" : "(Custom)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Structure: {fallbackSlotCount} players per team{selectedFormationId ? " (formation override)" : " (default)"}.
        The engine fills role requirements based on the selected format{selectedFormationId ? " and formation" : ""}.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SCENARIOS.map((scenario) => {
          const gated = isScenarioPolicyGated(scenario.code);
          const isSelected = selectedScenario === scenario.code;
          return (
            <button
              key={scenario.code}
              type="button"
              onClick={() => onSelectScenario(scenario.code)}
              className={`text-left rounded-lg border p-4 transition-colors ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border-soft)] hover:border-[var(--text-muted)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-zinc-200">{scenario.displayName}</p>
                {gated && <StatusPill variant="warning" size="sm">Policy-gated</StatusPill>}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">{scenario.description}</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span>{teamCount} teams</span>
        <span>{playerCount} available players</span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={isPending || (isPolicyGated && !policyAcknowledged)}
          onClick={() => setConfirmOpen(true)}
        >
          <Shuffle className="h-4 w-4 mr-1.5" />
          {isPending ? "Generating..." : "Generate preview"}
        </Button>
        {isPolicyGated && !policyAcknowledged && (
          <p className="text-xs text-[var(--warning)]">
            Acknowledge the policy gate below to enable generation.
          </p>
        )}
      </div>

      {isPolicyGated && (
        <Surface variant="subtle" padding="sm">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={policyAcknowledged}
              onChange={(e) => onPolicyAcknowledgedChange(e.target.checked)}
              className="mt-0.5 rounded border-[var(--border-soft)]"
            />
            <span className="text-xs text-[var(--text-soft)]">
              I acknowledge that the tiered competitive teams scenario creates intentionally unequal teams ranked by strength. This scenario requires explicit coach approval.
            </span>
          </label>
        </Surface>
      )}

      <Dialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Generate team composition preview?"
        description={isPolicyGated
          ? "This will calculate a TIERED proposal that creates intentionally unequal teams. No changes will be made until you review and apply."
          : "This will calculate a proposed team assignment based on the selected scenario. No changes will be made until you review and apply the proposal."
        }
        size="sm"
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => { setConfirmOpen(false); onGenerate(); }}
          >
            Generate preview
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function ProposalPreview({
  proposal,
  onApply,
  onRegenerate,
  onCancel,
  isPending,
}: {
  proposal: TeamCompositionProposal;
  onApply: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const scenario = SCENARIOS.find((s) => s.code === proposal.scenarioCode);

  const { blockingIssues, warnings, notes } = proposal.validation;

  const assignmentsByTeam = new Map<string, ProposedTeamAssignment[]>();
  for (const a of proposal.assignments) {
    const list = assignmentsByTeam.get(a.teamId) ?? [];
    list.push(a);
    assignmentsByTeam.set(a.teamId, list);
  }

  const playerNameMap = new Map(proposal.assignments.map((a) => [a.playerId, a.playerDisplayName ?? a.playerId]));

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Composition preview"
        description={`${scenario?.displayName ?? proposal.scenarioCode} — Review proposed assignments before applying.`}
      />

      {blockingIssues.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {blockingIssues.map((issue, i) => (
            <DecisionBanner key={i} variant="blocked" title={issue.message} />
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {warnings.map((issue: ProposalIssue, i: number) => (
            <DecisionBanner key={i} variant="decision" title={issue.message} />
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <Surface variant="subtle" padding="sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Planning notes</p>
          <ul className="flex flex-col gap-0.5">
            {notes.map((note: ProposalIssue, i: number) => (
              <li key={i} className="text-xs text-[var(--text-muted)]">{note.message}</li>
            ))}
          </ul>
        </Surface>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Teams" value={String(proposal.teamMetrics.length)} />
        <MetricCard label="Players assigned" value={String(proposal.assignments.length)} />
        <MetricCard label="Players moved" value={String(proposal.proposalMetrics.totalPlayersMoved)} />
        <MetricCard label="Avg team size" value={proposal.proposalMetrics.averageTeamSize.toFixed(1)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {proposal.teamMetrics.map((team) => {
          const teamAssignments = assignmentsByTeam.get(team.teamId) ?? [];
          const sortedAssignments = [...teamAssignments].sort((a, b) => {
            const roleOrder: Record<string, number> = { GOALKEEPER: 0, DEFENCE: 1, MIDFIELD: 2, ATTACK: 3, FLEXIBLE: 4 };
            return (roleOrder[a.assignedRole] ?? 5) - (roleOrder[b.assignedRole] ?? 5);
          });
          return (
            <Surface key={team.teamId} variant="default" padding="md">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">{team.teamName}</p>
                  <StatusPill
                    variant={team.formationViability === "viable" ? "success" : team.formationViability === "degraded" ? "warning" : "danger"}
                    size="sm"
                  >
                    {VIABILITY_LABELS[team.formationViability] ?? team.formationViability}
                  </StatusPill>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span>{team.squadSize} players</span>
                  <span>GK: {GK_COVERAGE_LABELS[team.goalkeeperCoverage] ?? team.goalkeeperCoverage}</span>
                  {team.averageOverall !== null && <span>Avg: {team.averageOverall.toFixed(1)}</span>}
                </div>
                {team.structuralWarnings.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {team.structuralWarnings.map((w, i) => (
                      <p key={i} className="text-[10px] text-[var(--warning)]">{w}</p>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {sortedAssignments.map((a) => (
                    <div
                      key={a.playerId}
                      className="flex items-center gap-2 text-xs"
                      title={a.selectionReason}
                    >
                      <span className="inline-flex items-center justify-center rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-medium uppercase text-[var(--text-muted)] min-w-[28px]">
                        {ROLE_LABELS[a.assignedRole] ?? a.assignedRole}
                      </span>
                      <span className="inline-flex items-center justify-center rounded px-1 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                        {FIT_LABELS[a.positionFit] ?? "?"}
                      </span>
                      <span className="text-[var(--text-soft)] truncate">
                        {playerNameMap.get(a.playerId) ?? a.playerId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Surface>
          );
        })}
      </div>

      <Surface variant="subtle" padding="sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Spread metrics</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-[var(--text-soft)]">
          <SpreadMetric label="Overall" value={proposal.proposalMetrics.overallSpread} />
          <SpreadMetric label="Defence" value={proposal.proposalMetrics.defensiveSpread} />
          <SpreadMetric label="Midfield" value={proposal.proposalMetrics.midfieldSpread} />
          <SpreadMetric label="Attack" value={proposal.proposalMetrics.attackingSpread} />
          <SpreadMetric label="Size" value={proposal.proposalMetrics.sizeSpread} />
        </div>
      </Surface>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={isPending || blockingIssues.length > 0}
          onClick={() => setApplyConfirmOpen(true)}
        >
          {isPending ? "Applying..." : "Apply composition"}
        </Button>
        <Button variant="ghost" size="sm" disabled={isPending} onClick={onRegenerate}>
          Regenerate
        </Button>
        <Button variant="ghost" size="sm" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <Dialog
        isOpen={applyConfirmOpen}
        onClose={() => setApplyConfirmOpen(false)}
        title="Apply this team composition?"
        description="This will update core-team assignments for all affected players. The change is immediate and will be recorded in the decision log."
        size="sm"
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={() => setApplyConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => { setApplyConfirmOpen(false); onApply(); }}
          >
            Confirm and apply
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Surface variant="default" padding="sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="text-lg font-semibold text-zinc-100">{value}</p>
    </Surface>
  );
}

function SpreadMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <span className="text-[var(--text-muted)]">{label}:</span>{" "}
      <span className="font-medium tabular-nums">{value !== null ? value.toFixed(2) : "\u2014"}</span>
    </div>
  );
}