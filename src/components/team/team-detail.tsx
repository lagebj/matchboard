"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatPlayerName } from "@/lib/player-metrics";
import { formatSeverity, formatSelectionRole } from "@/lib/match-utils";
import type { SelectionRole } from "@/generated/prisma/client";
import type { MovementCandidateRationale, MovementCandidateRole, MovementCandidateStatus } from "@/generated/prisma/client";
import { RotationPathCreateForm } from "@/components/rules/rotation-path-create-form";
import { RotationPathCard } from "@/components/rules/rotation-path-card";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { TabRail } from "@/components/ui/tab-rail";
import { MetricTile } from "@/components/ui/metric-tile";
import { IssueMarker } from "@/components/ui/issue-marker";
import { TeamShield } from "@/components/ui/team-shield";
import { PlayerMagnet } from "@/components/ui/player-magnet";
import { MovementArrow } from "@/components/ui/movement-arrow";
import {
  Users,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import {
  createMovementCandidateAction,
  deleteMovementCandidateAction,
  toggleMovementCandidateStatusAction,
} from "@/app/(app)/teams/movement-candidate-actions";

type PlayerSummary = {
  id: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string | null;
  currentAvailability: string;
  nonRotatable: boolean;
  reducedMatchLoadAllowed: boolean;
  supportSuitability: string | null;
  developmentReadiness: string | null;
  active: boolean;
};

type MovementEntry = {
  id: string;
  playerName: string;
  playerId: string;
  role: string;
  fromTeamName: string;
  toTeamName: string;
  roundLabel: string;
  matchRoundId: string;
  reason: string | null;
  isDraft: boolean;
};

type HistoryRound = {
  matchRoundId: string;
  roundLabel: string;
  coreCount: number;
  supportSentCount: number;
  supportReceivedCount: number;
  squadRepairReceivedCount: number;
  developmentReceivedCount: number;
};

type RoundWarning = {
  id: string;
  rule: string;
  message: string;
  severity: string;
  matchRoundId: string;
  roundLabel: string;
};

type RotationPathSummary = {
  id: string;
  role: string;
  direction: "outgoing" | "incoming";
  fromTeamId: string;
  fromTeamName: string;
  toTeamId: string;
  toTeamName: string;
  purpose: string | null;
  priority: number | null;
  minimumCount: number | null;
  targetCount: number | null;
  maximumCount: number | null;
  cooldownRounds: number | null;
  active: boolean;
};

type MovementCandidateEntry = {
  id: string;
  playerId: string;
  playerFirstName: string;
  playerLastName: string | null;
  coreTeamId: string;
  coreTeamName: string;
  rotationPathId: string;
  role: MovementCandidateRole;
  status: MovementCandidateStatus;
  activeFrom: Date;
  reviewBy: Date | null;
  rationaleCategory: MovementCandidateRationale;
  rationaleNote: string | null;
  lastUsed: Date | null;
  movementCountInPeriod: number;
  targetTeamId: string;
  targetTeamName: string;
};

type TeamDetailData = {
  teamId: string;
  teamName: string;
  targetSquadSize: number;
  minAcceptedSquadSize: number;
  maxSquadSize: number;
  minCorePlayers: number;
  supportPriority: number;
  minSupportPlayers: number;
  targetSupportCount: number;
  maxSupportCount: number;
  minSupportCount: number;
  developmentSlots: number;
  corePlayers: PlayerSummary[];
  currentRoundStatus: string;
  currentRoundLabel: string | null;
  currentRoundId: string | null;
  coreCountThisRound: number;
  sentAsSupportCount: number;
  receivedSupportCount: number;
  receivedSquadRepairCount: number;
  receivedDevelopmentCount: number;
  warningCount: number;
  selectedPlayers: Array<{
    playerId: string;
    playerName: string;
    role: string;
    explanation: string | null;
  }>;
  sentPlayers: Array<{
    playerId: string;
    playerName: string;
    role: string;
    destinationTeamName: string;
    explanation: string | null;
  }>;
  receivedPlayers: Array<{
    playerId: string;
    playerName: string;
    role: string;
    sourceTeamName: string;
    explanation: string | null;
  }>;
  droppedPlayers: Array<{
    playerId: string;
    playerName: string;
    role: string;
    explanation: string | null;
  }>;
  roundWarnings: RoundWarning[];
  movementHistory: MovementEntry[];
  finalizedRounds: HistoryRound[];
  rotationPaths: RotationPathSummary[];
  incomingCandidates: MovementCandidateEntry[];
  outgoingCandidates: MovementCandidateEntry[];
  eligibleCandidates: Array<{ id: string; firstName: string; lastName: string | null; coreTeamId: string | null; nonRotatable: boolean }>;
  teamOptions: Array<{ id: string; name: string }>;
  previousTeamId: string | null;
  nextTeamId: string | null;
};

type TabKey = "squad" | "current-round" | "movement" | "candidates" | "history" | "rules";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "squad", label: "Squad" },
  { key: "current-round", label: "Current Round" },
  { key: "movement", label: "Movement" },
  { key: "candidates", label: "Possible movement" },
  { key: "history", label: "History" },
  { key: "rules", label: "Rules & Links" },
];

function formatRoleLabel(role: string): string {
  switch (role) {
    case "CORE":
      return "Core";
    case "SUPPORT":
      return "Sent as support";
    case "DEVELOPMENT":
      return "Development movement";
    case "BACKFILL":
      return "Received squad repair";
    case "CONFIDENCE_REBUILD":
      return "Confidence rebuild";
    case "CORE_MATCH_DROP":
      return "Dropped (core match conflict)";
    case "REDUCED_MATCH_LOAD_DROP":
      return "Dropped (reduced load)";
    case "MANUAL_OVERRIDE":
      return "Manual override";
    default:
      return role;
  }
}

type SeverityVariant = "blocked" | "decision" | "note";

function severityToBannerVariant(severity: string): SeverityVariant {
  switch (severity) {
    case "HARD_BLOCK":
      return "blocked";
    case "REQUIRES_OVERRIDE":
      return "decision";
    default:
      return "note";
  }
}


function SquadTab({ corePlayers }: { corePlayers: PlayerSummary[] }) {
  const groups = {
    available: corePlayers.filter((p) => p.currentAvailability === "AVAILABLE"),
    tentative: corePlayers.filter((p) => p.currentAvailability === "TENTATIVE"),
    unknown: corePlayers.filter((p) => p.currentAvailability === "UNKNOWN"),
    unavailable: corePlayers.filter(
      (p) =>
        p.currentAvailability !== "AVAILABLE" &&
        p.currentAvailability !== "TENTATIVE" &&
        p.currentAvailability !== "UNKNOWN",
    ),
    nonRotatable: corePlayers.filter((p) => p.nonRotatable),
    reducedLoad: corePlayers.filter((p) => p.reducedMatchLoadAllowed),
    supportCandidates: corePlayers.filter(
      (p) => p.supportSuitability && p.supportSuitability !== "neutral",
    ),
    devCandidates: corePlayers.filter(
      (p) => p.developmentReadiness && p.developmentReadiness !== "neutral",
    ),
  };

  const renderGroup = (label: string, players: PlayerSummary[]) => {
    if (players.length === 0) return null;
    return (
      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {label} ({players.length})
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
           {players.map((p) => (
            <Link key={p.id} href={`/players/${p.id}`}>
              <PlayerMagnet
                name={formatPlayerName(p)}
                position={p.primaryPosition}
                status={
                  p.currentAvailability === "AVAILABLE" ? "available"
                    : p.currentAvailability === "INJURED" ? "injured"
                    : p.currentAvailability === "SICK" ? "sick"
                    : p.currentAvailability === "AWAY" ? "away"
                    : p.currentAvailability === "TENTATIVE" ? "available"
                    : "unknown"
                }
                warning={p.nonRotatable || !!p.reducedMatchLoadAllowed}
                movement={!!(p.supportSuitability && p.supportSuitability !== "neutral")}
                compact
              />
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <SectionHeader title="Availability" />
        <Surface variant="default" padding="md" className="mt-2">
          {renderGroup("Available", groups.available)}
          {renderGroup("Tentative", groups.tentative)}
          {renderGroup("Unknown", groups.unknown)}
          {renderGroup("Unavailable", groups.unavailable)}
          {groups.available.length === 0 && groups.tentative.length === 0 && groups.unknown.length === 0 && groups.unavailable.length === 0 && (
            <p className="text-sm text-[var(--text-soft)]">No core players assigned.</p>
          )}
        </Surface>
      </div>

      <div>
        <SectionHeader title="Planning groups" />
        <Surface variant="default" padding="md" className="mt-2">
          {renderGroup("Non-rotatable", groups.nonRotatable)}
          {renderGroup("Reduced match load", groups.reducedLoad)}
          {renderGroup("Support candidates", groups.supportCandidates)}
          {renderGroup("Development candidates", groups.devCandidates)}
          {groups.nonRotatable.length === 0 && groups.reducedLoad.length === 0 && groups.supportCandidates.length === 0 && groups.devCandidates.length === 0 && (
            <p className="text-sm text-[var(--text-soft)]">No special planning groups.</p>
          )}
        </Surface>
      </div>
    </div>
  );
}

function CurrentRoundTab({
  selectedPlayers,
  sentPlayers,
  receivedPlayers,
  droppedPlayers,
  roundWarnings,
  roundLabel,
  roundId,
}: {
  selectedPlayers: TeamDetailData["selectedPlayers"];
  sentPlayers: TeamDetailData["sentPlayers"];
  receivedPlayers: TeamDetailData["receivedPlayers"];
  droppedPlayers: TeamDetailData["droppedPlayers"];
  roundWarnings: TeamDetailData["roundWarnings"];
  roundLabel: string | null;
  roundId: string | null;
}) {
  if (!roundLabel || !roundId) {
    return (
      <Surface variant="default" padding="md">
        <p className="text-sm text-[var(--text-soft)]">No active round. Generate or select a round first.</p>
      </Surface>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <div>
          <SectionHeader title="Selected as core" />
          <div className="mt-2 flex flex-col gap-1.5">
            {selectedPlayers.length > 0 ? selectedPlayers.map((p) => (
              <Link
                key={p.playerId}
                className="group/item rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
                href={`/players/${p.playerId}`}
              >
                <span className="font-medium text-zinc-100 group-hover/item:text-[var(--accent-strong)]">
                  {p.playerName}
                </span>
                {p.explanation && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{p.explanation}</p>
                )}
              </Link>
            )) : (
              <p className="text-sm text-[var(--text-soft)]">No core players selected in this round.</p>
            )}
          </div>
        </div>

        <div>
          <SectionHeader title="Sent as support" />
          <div className="mt-2 flex flex-col gap-1.5">
            {sentPlayers.length > 0 ? sentPlayers.map((p) => (
              <Link
                key={p.playerId}
                className="group/item rounded-xl border border-[var(--info)]/20 bg-[var(--info-subtle)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
                href={`/players/${p.playerId}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-100 group-hover/item:text-[var(--accent-strong)]">
                    {p.playerName}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--text-muted)]">→ {p.destinationTeamName}</span>
                </div>
                {p.explanation && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{p.explanation}</p>
                )}
              </Link>
            )) : (
              <p className="text-sm text-[var(--text-soft)]">No players sent as support this round.</p>
            )}
          </div>
        </div>

        <div>
          <SectionHeader title="Dropped / Not selected" />
          <div className="mt-2 flex flex-col gap-1.5">
            {droppedPlayers.length > 0 ? droppedPlayers.map((p) => (
              <Link
                key={p.playerId}
                className="group/item rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-subtle)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
                href={`/players/${p.playerId}`}
              >
                <span className="font-medium text-[var(--danger)] group-hover/item:text-[var(--accent-strong)]">
                  {p.playerName}
                </span>
                <span className="ml-2 text-[10px] text-[var(--text-muted)]">{formatRoleLabel(p.role)}</span>
                {p.explanation && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{p.explanation}</p>
                )}
              </Link>
            )) : (
              <p className="text-sm text-[var(--text-soft)]">No players dropped this round.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <SectionHeader title="Received support / squad repair / development" />
          <div className="mt-2 flex flex-col gap-1.5">
            {receivedPlayers.length > 0 ? receivedPlayers.map((p) => (
              <Link
                key={p.playerId}
                className="group/item rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-subtle)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
                href={`/players/${p.playerId}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-100 group-hover/item:text-[var(--accent-strong)]">
                    {p.playerName}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                    {formatSelectionRole(p.role as SelectionRole)} · from {p.sourceTeamName}
                  </span>
                </div>
                {p.explanation && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{p.explanation}</p>
                )}
              </Link>
            )) : (
              <p className="text-sm text-[var(--text-soft)]">No players received this round.</p>
            )}
          </div>
        </div>

        {roundWarnings.length > 0 && (
          <div>
            <SectionHeader title="Plan checks" />
            <div className="mt-2 flex flex-col gap-1.5">
              {roundWarnings.map((w) => (
                <DecisionBanner
                  key={w.id}
                  variant={severityToBannerVariant(w.severity)}
                  title={formatSeverity(w.severity)}
                  description={w.message}
                  action={
                    <Link
                      className="text-[10px] text-[var(--text-muted)] hover:text-zinc-50"
                      href={`/rounds/${w.matchRoundId}`}
                    >
                      {w.roundLabel}
                    </Link>
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MovementTab({ movementHistory }: { movementHistory: MovementEntry[] }) {
  if (movementHistory.length === 0) {
    return (
      <Surface variant="default" padding="md">
        <p className="text-sm text-[var(--text-soft)]">No cross-team movement recorded for this team yet.</p>
      </Surface>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {movementHistory.map((entry) => (
        <div
          key={entry.id}
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)]"
              href={`/players/${entry.playerId}`}
            >
              {entry.playerName}
            </Link>
            <div className="flex items-center gap-2">
              <StatusPill variant="neutral" size="sm">
                {formatRoleLabel(entry.role)}
              </StatusPill>
              {entry.isDraft && (
                <StatusPill variant="warning" size="sm">Draft</StatusPill>
              )}
            </div>
          </div>
          <div className="mt-2">
            <MovementArrow
              fromTeam={entry.fromTeamName}
              toTeam={entry.toTeamName}
              role={
                entry.role === "SUPPORT" ? "support"
                  : entry.role === "DEVELOPMENT" ? "development"
                  : entry.role === "BACKFILL" ? "support"
                  : "core"
              }
              compact
            />
          </div>
          {entry.reason && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">{entry.reason}</p>
          )}
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">
            <Link
              className="hover:text-zinc-50"
              href={`/rounds/${entry.matchRoundId}`}
            >
              {entry.roundLabel}
            </Link>
          </p>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ finalizedRounds }: { finalizedRounds: HistoryRound[] }) {
  if (finalizedRounds.length === 0) {
    return (
      <Surface variant="default" padding="md">
        <p className="text-sm text-[var(--text-soft)]">No finalized rounds for this team yet.</p>
      </Surface>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {finalizedRounds.map((round) => (
        <Link
          key={round.matchRoundId}
          className="group rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-3 hover:bg-[var(--surface-hover)]"
          href={`/rounds/${round.matchRoundId}`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-100 group-hover:text-[var(--accent-strong)]">
              {round.roundLabel}
            </span>
            <StatusPill variant="finalized" size="sm">Finalised</StatusPill>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--text-soft)]">
            <span>{round.coreCount} core</span>
            {round.supportSentCount > 0 && <span>{round.supportSentCount} sent as support</span>}
            {round.supportReceivedCount > 0 && <span>{round.supportReceivedCount} received support</span>}
            {round.squadRepairReceivedCount > 0 && <span>{round.squadRepairReceivedCount} received squad repair</span>}
            {round.developmentReceivedCount > 0 && <span>{round.developmentReceivedCount} received development</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}

function RulesTab({ rotationPaths, teamId, teamOptions }: { rotationPaths: RotationPathSummary[]; teamId: string; teamOptions: Array<{ id: string; name: string }> }) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  const outgoingPaths = rotationPaths.filter((p) => p.direction === "outgoing");
  const incomingPaths = rotationPaths.filter((p) => p.direction === "incoming");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Rotation paths" />
        <Button variant="secondary" size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "Cancel" : "Add path"}
        </Button>
      </div>

      {showCreateForm && (
        <Surface variant="default" padding="lg">
          <h3 className="text-sm font-semibold text-zinc-100">Create rotation path</h3>
          <p className="mt-1 mb-4 text-xs text-[var(--text-soft)]">Define which teams can send or receive players and in which role.</p>
          <RotationPathCreateForm teams={teamOptions} defaultToTeamId={teamId} />
        </Surface>
      )}

      {outgoingPaths.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Outgoing</p>
          <div className="flex flex-col gap-1.5">
            {outgoingPaths.map((path) => (
              <RotationPathCard key={path.id} path={path} teamId={teamId} direction="outgoing" />
            ))}
          </div>
        </div>
      )}

      {incomingPaths.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Incoming</p>
          <div className="flex flex-col gap-1.5">
            {incomingPaths.map((path) => (
              <RotationPathCard key={path.id} path={path} teamId={teamId} direction="incoming" />
            ))}
          </div>
        </div>
      )}

      {rotationPaths.length === 0 && !showCreateForm && (
        <Surface variant="default" padding="md">
          <p className="text-sm text-[var(--text-soft)]">No rotation paths configured for this team. Add a path to enable support, development, or squad repair movement.</p>
        </Surface>
      )}

      <div>
        <Button variant="ghost" size="sm" as="a" href="/rules">
          View global rules
        </Button>
      </div>
    </div>
  );
}

const RATIONALE_LABELS: Record<string, string> = {
  CHALLENGE_EXPOSURE: "Challenge exposure",
  CONFIDENCE_AND_INVOLVEMENT: "Confidence and involvement",
  STABILISE_TEAM_FUNCTION: "Stabilise team function",
  SUPPORT_TEAMMATES: "Support teammates",
  POSITIONAL_LEARNING: "Positional learning",
  RESET_AND_RESPONSIBILITY: "Reset and responsibility",
  COACH_JUDGEMENT: "Coach judgement",
};

function formatRationaleCategory(category: string): string {
  return RATIONALE_LABELS[category] ?? category;
}

function formatDateShort(date: Date | null): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function MovementCandidatesTab({
  incomingCandidates,
  outgoingCandidates,
  rotationPaths,
  eligibleCandidates,
  teamId: _teamId,
  teamOptions: _teamOptions,
}: {
  incomingCandidates: MovementCandidateEntry[];
  outgoingCandidates: MovementCandidateEntry[];
  rotationPaths: RotationPathSummary[];
  eligibleCandidates: Array<{ id: string; firstName: string; lastName: string | null; coreTeamId: string | null; nonRotatable: boolean }>;
  teamId: string;
  teamOptions: Array<{ id: string; name: string }>;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState("");
  const [isPending, startTransition] = useTransition();

  const activeOutgoingPaths = rotationPaths.filter((p) => p.direction === "outgoing" && p.active);
  const activeIncomingPaths = rotationPaths.filter((p) => p.direction === "incoming" && p.active);

  const selectedPath = rotationPaths.find((p) => p.id === selectedPathId);
  const filteredPlayers = selectedPath
    ? eligibleCandidates.filter((p) => p.coreTeamId === selectedPath.fromTeamId && !p.nonRotatable)
    : [];

  const incomingSupport = incomingCandidates.filter((c) => c.role === "SUPPORT");
  const incomingDevelopment = incomingCandidates.filter((c) => c.role === "DEVELOPMENT");

  function handleToggleStatus(candidateId: string, currentStatus: MovementCandidateStatus) {
    const targetStatus: "ACTIVE" | "PAUSED" = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    startTransition(async () => {
      await toggleMovementCandidateStatusAction(candidateId, targetStatus);
    });
  }

  function handleDelete(candidateId: string) {
    if (!confirm("Remove this movement candidate?")) return;
    startTransition(async () => {
      await deleteMovementCandidateAction(candidateId);
    });
  }

  const renderCandidateCard = (candidate: MovementCandidateEntry, direction: "incoming" | "outgoing") => {
    const isOverdue = candidate.reviewBy && new Date(candidate.reviewBy) < new Date();

    return (
      <div key={candidate.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <Link
            className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)] truncate"
            href={`/players/${candidate.playerId}`}
          >
            {candidate.playerLastName
              ? `${candidate.playerFirstName} ${candidate.playerLastName}`
              : candidate.playerFirstName}
          </Link>
          <div className="flex items-center gap-1.5">
            <StatusPill variant={candidate.role === "SUPPORT" ? "support" : "development"} size="sm">
              {candidate.role === "SUPPORT" ? "Support" : "Development"}
            </StatusPill>
            {candidate.status === "PAUSED" && (
              <StatusPill variant="warning" size="sm">Paused</StatusPill>
            )}
            {isOverdue && (
              <StatusPill variant="danger" size="sm">Review overdue</StatusPill>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-[var(--text-muted)]">
          <span>{direction === "incoming" ? `From ${candidate.coreTeamName}` : `To ${candidate.targetTeamName}`}</span>
          <span>·</span>
          <span>{formatRationaleCategory(candidate.rationaleCategory)}</span>
          {candidate.reviewBy && <span>· Review by {formatDateShort(candidate.reviewBy)}</span>}
          {candidate.movementCountInPeriod > 0 && <span>· {candidate.movementCountInPeriod} movements</span>}
        </div>
        {candidate.rationaleNote && (
          <p className="mt-1 text-xs text-[var(--text-soft)]">{candidate.rationaleNote}</p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            className="text-[10px] text-[var(--text-muted)] hover:text-zinc-50 underline"
            onClick={() => handleToggleStatus(candidate.id, candidate.status)}
            type="button"
            disabled={isPending}
          >
            {candidate.status === "ACTIVE" ? "Pause" : "Reactivate"}
          </button>
          <button
            className="text-[10px] text-[var(--danger)]/70 hover:text-[var(--danger)] underline"
            onClick={() => handleDelete(candidate.id)}
            type="button"
            disabled={isPending}
          >
            Remove
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Possible movement" />
        <Button variant="secondary" size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "Cancel" : "Add candidate"}
        </Button>
      </div>

      <p className="text-xs text-[var(--text-soft)]">
        Candidate status means this player may be considered for this movement path. It does not change core team, guarantee selection, rank the player, or remove normal match opportunities.
      </p>

      {showCreateForm && (
        <Surface variant="default" padding="lg">
          <h3 className="text-sm font-semibold text-zinc-100">Create movement candidate</h3>
          <form
            action={createMovementCandidateAction}
            className="mt-4 flex flex-col gap-4"
          >
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" htmlFor="mc-rotationPathId">Rotation path</label>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                id="mc-rotationPathId"
                name="rotationPathId"
                required
                value={selectedPathId}
                onChange={(e) => setSelectedPathId(e.target.value)}
              >
                <option value="">Select path</option>
                <optgroup label="Outgoing">
                  {activeOutgoingPaths.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.toTeamName} ({p.role})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Incoming">
                  {activeIncomingPaths.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fromTeamName} → {p.toTeamName} ({p.role})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" htmlFor="mc-playerId">Player</label>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                id="mc-playerId"
                name="playerId"
                required
                disabled={!selectedPathId}
              >
                <option value="">{selectedPathId ? "Select player" : "Select a rotation path first"}</option>
                {filteredPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName}
                  </option>
                ))}
              </select>
              {selectedPathId && filteredPlayers.length === 0 && (
                <p className="mt-1 text-[10px] text-[var(--text-soft)]">No eligible players found for this path&apos;s source team.</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" htmlFor="mc-role">Role</label>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                id="mc-role"
                name="role"
                required
              >
                <option value="SUPPORT">Support</option>
                <option value="DEVELOPMENT">Development</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" htmlFor="mc-rationaleCategory">Rationale</label>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                id="mc-rationaleCategory"
                name="rationaleCategory"
                required
              >
                {Object.entries(RATIONALE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" htmlFor="mc-rationaleNote">Note (optional)</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                id="mc-rationaleNote"
                name="rationaleNote"
                type="text"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" htmlFor="mc-reviewBy">Review by (optional)</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                id="mc-reviewBy"
                name="reviewBy"
                type="date"
              />
            </div>
            <Button variant="primary" size="md" type="submit">
              Create candidate
            </Button>
          </form>
        </Surface>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="Incoming candidates" />
          <div className="mt-2 flex flex-col gap-1.5">
            {incomingSupport.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Support candidates ({incomingSupport.length})</p>
                {incomingSupport.map((c) => renderCandidateCard(c, "incoming"))}
              </div>
            )}
            {incomingDevelopment.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Development candidates ({incomingDevelopment.length})</p>
                {incomingDevelopment.map((c) => renderCandidateCard(c, "incoming"))}
              </div>
            )}
            {incomingCandidates.length === 0 && (
              <Surface variant="default" padding="sm">
                <p className="text-sm text-[var(--text-soft)]">No incoming movement candidates for this team.</p>
              </Surface>
            )}
          </div>
        </div>

        <div>
          <SectionHeader title="Outgoing candidates" />
          <div className="mt-2 flex flex-col gap-1.5">
            {outgoingCandidates.length > 0 ? (
              outgoingCandidates.map((c) => renderCandidateCard(c, "outgoing"))
            ) : (
              <Surface variant="default" padding="sm">
                <p className="text-sm text-[var(--text-soft)]">No outgoing movement candidates from this team.</p>
              </Surface>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TeamDetail({ data }: { data: TeamDetailData }) {
  const [activeTab, setActiveTab] = useState<TabKey>("squad");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={data.teamName}
        description={`Target ${data.targetSquadSize} · Min ${data.minAcceptedSquadSize} · Max ${data.maxSquadSize} · Min core ${data.minCorePlayers} · Support priority rank (1 is highest): ${data.supportPriority}`}
        icon={<TeamShield teamName={data.teamName} size="lg" />}
        actions={
          <div className="flex flex-wrap gap-2">
            {data.previousTeamId && (
              <Button variant="ghost" size="sm" as="a" href={`/teams/${data.previousTeamId}`}>
                Previous team
              </Button>
            )}
            {data.nextTeamId && (
              <Button variant="ghost" size="sm" as="a" href={`/teams/${data.nextTeamId}`}>
                Next team
              </Button>
            )}
            <Button variant="ghost" size="sm" as="a" href="/teams">
              Back to teams
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <MetricTile
          icon={<span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Round</span>}
          label="Round"
          value={data.currentRoundLabel ?? "No active round"}
        />
        <MetricTile
          label="Status"
          value={data.currentRoundStatus}
          tone={data.currentRoundStatus === "FINALIZED" ? "success" : data.currentRoundStatus === "BLOCKED" ? "danger" : "neutral"}
        />
        <MetricTile
          icon={<Users className="h-4 w-4" />}
          label="Core"
          value={data.coreCountThisRound}
        />
        <MetricTile
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="Sent"
          value={data.sentAsSupportCount}
        />
        <MetricTile
          icon={<ArrowDownLeft className="h-4 w-4" />}
          label="Received"
          value={data.receivedSupportCount + data.receivedSquadRepairCount + data.receivedDevelopmentCount}
        />
        {data.warningCount > 0 && (
          <IssueMarker
            type="blocked"
            label="Signals"
            count={data.warningCount}
          />
        )}
      </div>

      <TabRail
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        activeKey={activeTab}
        onSelect={(key) => setActiveTab(key as TabKey)}
        variant="pill"
      />

      <Surface variant="default" padding="lg">
        {activeTab === "squad" && <SquadTab corePlayers={data.corePlayers} />}
        {activeTab === "current-round" && (
          <CurrentRoundTab
            droppedPlayers={data.droppedPlayers}
            receivedPlayers={data.receivedPlayers}
            roundId={data.currentRoundId}
            roundLabel={data.currentRoundLabel}
            roundWarnings={data.roundWarnings}
            selectedPlayers={data.selectedPlayers}
            sentPlayers={data.sentPlayers}
          />
        )}
        {activeTab === "movement" && <MovementTab movementHistory={data.movementHistory} />}
        {activeTab === "candidates" && (
          <MovementCandidatesTab
            incomingCandidates={data.incomingCandidates}
            outgoingCandidates={data.outgoingCandidates}
            rotationPaths={data.rotationPaths}
            eligibleCandidates={data.eligibleCandidates}
            teamId={data.teamId}
            teamOptions={data.teamOptions}
          />
        )}
        {activeTab === "history" && <HistoryTab finalizedRounds={data.finalizedRounds} />}
        {activeTab === "rules" && <RulesTab rotationPaths={data.rotationPaths} teamId={data.teamId} teamOptions={data.teamOptions} />}
      </Surface>
    </div>
  );
}