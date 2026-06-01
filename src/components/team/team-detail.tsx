"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatPlayerName } from "@/lib/player-metrics";
import { formatSeverity, formatSelectionRole } from "@/lib/match-utils";
import type { SelectionRole } from "@/generated/prisma/client";
import type { MovementCandidateRationale, MovementCandidateRole, MovementCandidateStatus } from "@/generated/prisma/client";
import { RotationPathCreateForm } from "@/components/rules/rotation-path-create-form";
import { RotationPathCard } from "@/components/rules/rotation-path-card";
import {
  createMovementCandidateAction,
  deleteMovementCandidateAction,
  toggleMovementCandidateStatusAction,
} from "@/app/(app)/teams/movement-candidate-actions";

function formatAvailability(status: string): string {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "TENTATIVE":
      return "Tentative";
    case "INJURED":
      return "Injured";
    case "SICK":
      return "Sick";
    case "AWAY":
      return "Away";
    case "UNKNOWN":
      return "Unknown";
    default:
      return status;
  }
}

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
  { key: "candidates", label: "Movement candidates" },
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

function severityColor(severity: string): string {
  switch (severity) {
    case "HARD_BLOCK":
      return "border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.12)] text-[#f0cbc5]";
    case "REQUIRES_OVERRIDE":
      return "border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.10)] text-[#d4b07a]";
    case "WARNING":
      return "border-app-hairline bg-[rgba(255,255,255,0.04)] text-zinc-100";
    case "SCORING_PREFERENCE":
      return "border-app-hairline bg-[rgba(255,255,255,0.025)] app-copy-soft";
    default:
      return "border-app-hairline bg-[rgba(255,255,255,0.025)] app-copy-soft";
  }
}

function availabilityColor(availability: string): string {
  switch (availability) {
    case "AVAILABLE":
      return "text-zinc-100";
    case "TENTATIVE":
      return "text-[#d4b07a]";
    case "INJURED":
    case "SICK":
    case "AWAY":
      return "text-[#f0cbc5]";
    default:
      return "app-copy-soft";
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

  const renderGroup = (label: string, players: PlayerSummary[], tone: string) => {
    if (players.length === 0) return null;
    return (
      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted">
          {label} ({players.length})
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {players.map((p) => (
            <Link
              key={p.id}
              className={`group/item rounded-xl border px-2.5 py-2 text-sm transition-colors hover:bg-[rgba(255,255,255,0.05)] ${tone}`}
              href={`/players/${p.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-zinc-100 group-hover/item:text-[var(--accent-strong)]">
                  {formatPlayerName(p)}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] app-copy-muted">
                  {p.primaryPosition}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className={`rounded-full border app-hairline bg-[rgba(0,0,0,0.18)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${availabilityColor(p.currentAvailability)}`}>
                  {formatAvailability(p.currentAvailability)}
                </span>
                {p.nonRotatable && (
                  <span className="rounded-full border border-[rgba(208,176,127,0.2)] bg-[rgba(208,176,127,0.06)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--warning)]">
                    Non-rot
                  </span>
                )}
                {p.reducedMatchLoadAllowed && (
                  <span className="rounded-full border border-[rgba(208,176,127,0.2)] bg-[rgba(208,176,127,0.06)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--warning)]">
                    RML
                  </span>
                )}
                {p.supportSuitability && p.supportSuitability !== "neutral" && (
                  <span className="rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] app-copy-muted">
                    Sup
                  </span>
                )}
                {p.developmentReadiness && p.developmentReadiness !== "neutral" && (
                  <span className="rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] app-copy-muted">
                    Dev
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          Availability
        </p>
        <div className="mt-2 rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
          {renderGroup("Available", groups.available, "border app-hairline bg-[rgba(0,0,0,0.08)]")}
          {renderGroup("Tentative", groups.tentative, "border-[rgba(208,176,127,0.2)] bg-[rgba(208,176,127,0.04)] border")}
          {renderGroup("Unknown", groups.unknown, "border app-hairline bg-[rgba(0,0,0,0.08)]")}
          {renderGroup("Unavailable", groups.unavailable, "border-[rgba(185,128,119,0.2)] bg-[rgba(185,128,119,0.04)] border")}
          {groups.available.length === 0 && groups.tentative.length === 0 && groups.unknown.length === 0 && groups.unavailable.length === 0 && (
            <p className="text-sm app-copy-soft">No core players assigned.</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          Planning groups
        </p>
        <div className="mt-2 rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
          {renderGroup("Non-rotatable", groups.nonRotatable, "border-[rgba(208,176,127,0.2)] bg-[rgba(208,176,127,0.04)] border")}
          {renderGroup("Reduced match load", groups.reducedLoad, "border-[rgba(178,140,219,0.2)] bg-[rgba(178,140,219,0.04)] border")}
          {renderGroup("Support candidates", groups.supportCandidates, "border app-hairline bg-[rgba(0,0,0,0.08)]")}
          {renderGroup("Development candidates", groups.devCandidates, "border app-hairline bg-[rgba(0,0,0,0.08)]")}
          {groups.nonRotatable.length === 0 && groups.reducedLoad.length === 0 && groups.supportCandidates.length === 0 && groups.devCandidates.length === 0 && (
            <p className="text-sm app-copy-soft">No special planning groups.</p>
          )}
        </div>
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
      <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
        <p className="text-sm app-copy-soft">No active round. Generate or select a round first.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Selected as core
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {selectedPlayers.length > 0 ? selectedPlayers.map((p) => (
              <Link
                key={p.playerId}
                className="group/item rounded-xl border app-hairline bg-[rgba(0,0,0,0.08)] px-3 py-2 text-sm hover:bg-[rgba(255,255,255,0.05)]"
                href={`/players/${p.playerId}`}
              >
                <span className="font-medium text-zinc-100 group-hover/item:text-[var(--accent-strong)]">
                  {p.playerName}
                </span>
                {p.explanation && (
                  <p className="mt-1 text-xs app-copy-muted">{p.explanation}</p>
                )}
              </Link>
            )) : (
              <p className="text-sm app-copy-soft">No core players selected in this round.</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Sent as support
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {sentPlayers.length > 0 ? sentPlayers.map((p) => (
              <Link
                key={p.playerId}
                className="group/item rounded-xl border border-[rgba(178,140,219,0.2)] bg-[rgba(178,140,219,0.04)] px-3 py-2 text-sm hover:bg-[rgba(255,255,255,0.05)]"
                href={`/players/${p.playerId}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-100 group-hover/item:text-[var(--accent-strong)]">
                    {p.playerName}
                  </span>
                  <span className="shrink-0 text-[10px] app-copy-muted">→ {p.destinationTeamName}</span>
                </div>
                {p.explanation && (
                  <p className="mt-1 text-xs app-copy-muted">{p.explanation}</p>
                )}
              </Link>
            )) : (
              <p className="text-sm app-copy-soft">No players sent as support this round.</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Dropped / Not selected
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {droppedPlayers.length > 0 ? droppedPlayers.map((p) => (
              <Link
                key={p.playerId}
                className="group/item rounded-xl border border-[rgba(185,128,119,0.2)] bg-[rgba(185,128,119,0.04)] px-3 py-2 text-sm hover:bg-[rgba(255,255,255,0.05)]"
                href={`/players/${p.playerId}`}
              >
                <span className="font-medium text-[#f0cbc5] group-hover/item:text-[var(--accent-strong)]">
                  {p.playerName}
                </span>
                <span className="ml-2 text-[10px] app-copy-muted">{formatRoleLabel(p.role)}</span>
                {p.explanation && (
                  <p className="mt-1 text-xs app-copy-muted">{p.explanation}</p>
                )}
              </Link>
            )) : (
              <p className="text-sm app-copy-soft">No players dropped this round.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Received support / squad repair / development
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {receivedPlayers.length > 0 ? receivedPlayers.map((p) => (
              <Link
                key={p.playerId}
                className="group/item rounded-xl border border-[rgba(140,167,146,0.2)] bg-[rgba(140,167,146,0.06)] px-3 py-2 text-sm hover:bg-[rgba(255,255,255,0.05)]"
                href={`/players/${p.playerId}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-100 group-hover/item:text-[var(--accent-strong)]">
                    {p.playerName}
                  </span>
                  <span className="shrink-0 text-[10px] app-copy-muted">
                    {formatSelectionRole(p.role as SelectionRole)} · from {p.sourceTeamName}
                  </span>
                </div>
                {p.explanation && (
                  <p className="mt-1 text-xs app-copy-muted">{p.explanation}</p>
                )}
              </Link>
            )) : (
              <p className="text-sm app-copy-soft">No players received this round.</p>
            )}
          </div>
        </div>

        {roundWarnings.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Plan integrity signals
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {roundWarnings.map((w) => (
                <div
                  key={w.id}
                  className={`rounded-xl border px-3 py-2 ${severityColor(w.severity)}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                      {formatSeverity(w.severity)}
                    </span>
                    <Link
                      className="text-[10px] app-copy-muted hover:text-zinc-50"
                      href={`/rounds/${w.matchRoundId}`}
                    >
                      {w.roundLabel}
                    </Link>
                  </div>
                  <p className="mt-1 text-xs">{w.message}</p>
                </div>
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
      <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
        <p className="text-sm app-copy-soft">No cross-team movement recorded for this team yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {movementHistory.map((entry) => (
        <div
          key={entry.id}
          className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)]"
              href={`/players/${entry.playerId}`}
            >
              {entry.playerName}
            </Link>
            <div className="flex items-center gap-2">
              <span className="rounded-full border app-hairline px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] app-copy-muted">
                {formatRoleLabel(entry.role)}
              </span>
              {entry.isDraft && (
                <span className="rounded-full border border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.08)] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--warning)]">
                  Draft
                </span>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm app-copy-soft">
            {entry.fromTeamName} → {entry.toTeamName}
          </p>
          {entry.reason && (
            <p className="mt-1 text-xs app-copy-muted">{entry.reason}</p>
          )}
          <p className="mt-1 text-[10px] app-copy-muted">
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
      <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
        <p className="text-sm app-copy-soft">No finalized rounds for this team yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {finalizedRounds.map((round) => (
        <Link
          key={round.matchRoundId}
          className="group rounded-xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3 hover:bg-[rgba(255,255,255,0.04)]"
          href={`/rounds/${round.matchRoundId}`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-100 group-hover:text-[var(--accent-strong)]">
              {round.roundLabel}
            </span>
            <span className="rounded-full border border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              Finalized
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs app-copy-soft">
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          Rotation paths
        </p>
        <button
          className="h-8 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-3 text-xs font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          onClick={() => setShowCreateForm(!showCreateForm)}
          type="button"
        >
          {showCreateForm ? "Cancel" : "Add path"}
        </button>
      </div>

      {showCreateForm && (
        <section className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Create rotation path</h3>
          <p className="mt-1 mb-4 text-xs app-copy-soft">Define which teams can send or receive players and in which role.</p>
          <RotationPathCreateForm teams={teamOptions} defaultToTeamId={teamId} />
        </section>
      )}

      {outgoingPaths.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] app-copy-muted">Outgoing</p>
          <div className="flex flex-col gap-1.5">
            {outgoingPaths.map((path) => (
              <RotationPathCard key={path.id} path={path} teamId={teamId} direction="outgoing" />
            ))}
          </div>
        </div>
      )}

      {incomingPaths.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] app-copy-muted">Incoming</p>
          <div className="flex flex-col gap-1.5">
            {incomingPaths.map((path) => (
              <RotationPathCard key={path.id} path={path} teamId={teamId} direction="incoming" />
            ))}
          </div>
        </div>
      )}

      {rotationPaths.length === 0 && !showCreateForm && (
        <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
          <p className="text-sm app-copy-soft">No rotation paths configured for this team. Add a path to enable support, development, or squad repair movement.</p>
        </div>
      )}

      <div>
        <Link
          className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
          href="/rules"
        >
          View global rules
        </Link>
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

  function renderCandidateCard(candidate: MovementCandidateEntry, direction: "incoming" | "outgoing") {
    const isOverdue = candidate.reviewBy && new Date(candidate.reviewBy) < new Date();
    const statusColor = candidate.status === "PAUSED"
      ? "border-[rgba(208,176,127,0.2)] bg-[rgba(208,176,127,0.04)]"
      : isOverdue
        ? "border-[rgba(185,128,119,0.2)] bg-[rgba(185,128,119,0.04)]"
        : "border app-hairline bg-[rgba(0,0,0,0.08)]";

    return (
      <div key={candidate.id} className={`rounded-xl border ${statusColor} px-3 py-2.5`}>
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
            <span className="rounded-full border app-hairline px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] app-copy-muted">
              {candidate.role === "SUPPORT" ? "Support" : "Development"}
            </span>
            {candidate.status === "PAUSED" && (
              <span className="rounded-full border border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.08)] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--warning)]">
                Paused
              </span>
            )}
            {isOverdue && (
              <span className="rounded-full border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[#f0cbc5]">
                Review overdue
              </span>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] app-copy-muted">
          <span>{direction === "incoming" ? `From ${candidate.coreTeamName}` : `To ${candidate.targetTeamName}`}</span>
          <span>·</span>
          <span>{formatRationaleCategory(candidate.rationaleCategory)}</span>
          {candidate.reviewBy && <span>· Review by {formatDateShort(candidate.reviewBy)}</span>}
          {candidate.movementCountInPeriod > 0 && <span>· {candidate.movementCountInPeriod} movements</span>}
        </div>
        {candidate.rationaleNote && (
          <p className="mt-1 text-xs app-copy-soft">{candidate.rationaleNote}</p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            className="text-[10px] app-copy-muted hover:text-zinc-50 underline"
            onClick={() => handleToggleStatus(candidate.id, candidate.status)}
            type="button"
            disabled={isPending}
          >
            {candidate.status === "ACTIVE" ? "Pause" : "Reactivate"}
          </button>
          <button
            className="text-[10px] text-[#f0cbc5] hover:text-zinc-50 underline"
            onClick={() => handleDelete(candidate.id)}
            type="button"
            disabled={isPending}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          Movement candidates
        </p>
        <button
          className="h-8 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-3 text-xs font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          onClick={() => setShowCreateForm(!showCreateForm)}
          type="button"
        >
          {showCreateForm ? "Cancel" : "Add candidate"}
        </button>
      </div>

      <p className="text-xs app-copy-soft">
        Candidate status means this player may be considered for this movement path. It does not change core team, guarantee selection, rank the player, or remove normal match opportunities.
      </p>

      {showCreateForm && (
        <section className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Create movement candidate</h3>
          <form
            action={createMovementCandidateAction}
            className="mt-4 flex flex-col gap-4"
          >
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted" htmlFor="mc-rotationPathId">Rotation path</label>
              <select
                className="mt-1 w-full rounded-xl border app-hairline bg-[rgba(0,0,0,0.18)] px-3 py-2 text-sm text-zinc-100"
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
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted" htmlFor="mc-playerId">Player</label>
              <select
                className="mt-1 w-full rounded-xl border app-hairline bg-[rgba(0,0,0,0.18)] px-3 py-2 text-sm text-zinc-100"
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
                <p className="mt-1 text-[10px] app-copy-soft">No eligible players found for this path&apos;s source team.</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted" htmlFor="mc-role">Role</label>
              <select
                className="mt-1 w-full rounded-xl border app-hairline bg-[rgba(0,0,0,0.18)] px-3 py-2 text-sm text-zinc-100"
                id="mc-role"
                name="role"
                required
              >
                <option value="SUPPORT">Support</option>
                <option value="DEVELOPMENT">Development</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted" htmlFor="mc-rationaleCategory">Rationale</label>
              <select
                className="mt-1 w-full rounded-xl border app-hairline bg-[rgba(0,0,0,0.18)] px-3 py-2 text-sm text-zinc-100"
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
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted" htmlFor="mc-rationaleNote">Note (optional)</label>
              <input
                className="mt-1 w-full rounded-xl border app-hairline bg-[rgba(0,0,0,0.18)] px-3 py-2 text-sm text-zinc-100"
                id="mc-rationaleNote"
                name="rationaleNote"
                type="text"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted" htmlFor="mc-reviewBy">Review by (optional)</label>
              <input
                className="mt-1 w-full rounded-xl border app-hairline bg-[rgba(0,0,0,0.18)] px-3 py-2 text-sm text-zinc-100"
                id="mc-reviewBy"
                name="reviewBy"
                type="date"
              />
            </div>
            <button
              className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              type="submit"
            >
              Create candidate
            </button>
          </form>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Incoming candidates
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {incomingSupport.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted">Support candidates ({incomingSupport.length})</p>
                {incomingSupport.map((c) => renderCandidateCard(c, "incoming"))}
              </div>
            )}
            {incomingDevelopment.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted">Development candidates ({incomingDevelopment.length})</p>
                {incomingDevelopment.map((c) => renderCandidateCard(c, "incoming"))}
              </div>
            )}
            {incomingCandidates.length === 0 && (
              <div className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.08)] px-3 py-2.5 text-sm app-copy-soft">
                No incoming movement candidates for this team.
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Outgoing candidates
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {outgoingCandidates.length > 0 ? (
              outgoingCandidates.map((c) => renderCandidateCard(c, "outgoing"))
            ) : (
              <div className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.08)] px-3 py-2.5 text-sm app-copy-soft">
                No outgoing movement candidates from this team.
              </div>
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
      <section className="app-panel-raised rounded-[1.9rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Team Detail
            </span>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">
                {data.teamName}
              </h1>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                  Target {data.targetSquadSize} · Min {data.minAcceptedSquadSize} · Max {data.maxSquadSize}
                </span>
                <span className="rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                  Min core {data.minCorePlayers}
                </span>
                <span className="rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                  Support priority rank (1 is highest) {data.supportPriority}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {data.previousTeamId && (
                <Link
                  className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                  href={`/teams/${data.previousTeamId}`}
                >
                  Previous team
                </Link>
              )}
              {data.nextTeamId && (
                <Link
                  className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                  href={`/teams/${data.nextTeamId}`}
                >
                  Next team
                </Link>
              )}
              <Link
                className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                href="/teams"
              >
                Back to teams
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel rounded-[1.6rem] p-5">
        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted">Round</p>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              {data.currentRoundLabel ?? "No active round"}
            </p>
          </div>
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted">Status</p>
            <p className="mt-1 text-sm font-medium text-zinc-100">{data.currentRoundStatus}</p>
          </div>
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted">Core</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-50">{data.coreCountThisRound}</p>
          </div>
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted">Sent</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-50">{data.sentAsSupportCount}</p>
          </div>
          <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] app-copy-muted">Received</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-50">
              {data.receivedSupportCount + data.receivedSquadRepairCount + data.receivedDevelopmentCount}
            </p>
          </div>
          {data.warningCount > 0 && (
            <div className="rounded-2xl border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f0cbc5]">Signals</p>
              <p className="mt-1 text-2xl font-semibold text-[#f0cbc5]">{data.warningCount}</p>
            </div>
          )}
        </div>
      </section>

      <nav className="flex gap-1 overflow-x-auto rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.03)] p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[rgba(255,255,255,0.08)] text-zinc-50"
                : "app-copy-soft hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-50"
            }`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="app-panel rounded-[1.6rem] p-5">
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
      </section>
    </div>
  );
}