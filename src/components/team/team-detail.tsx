"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPlayerName } from "@/lib/player-metrics";

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
  backfillReceivedCount: number;
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
  partnerTeamName: string;
  partnerTeamId: string;
  purpose: string | null;
  priority: number | null;
  active: boolean;
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
  receivedBackfillCount: number;
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
  previousTeamId: string | null;
  nextTeamId: string | null;
};

type TabKey = "squad" | "current-round" | "movement" | "history" | "rules";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "squad", label: "Squad" },
  { key: "current-round", label: "Current Round" },
  { key: "movement", label: "Movement" },
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
      return "Received backfill";
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
            Received support / backfill / development
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
                    {p.role === "SUPPORT" ? "Support" : p.role === "BACKFILL" ? "Backfill" : p.role === "DEVELOPMENT" ? "Development" : p.role} · from {p.sourceTeamName}
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
              Warnings
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {roundWarnings.map((w) => (
                <div
                  key={w.id}
                  className={`rounded-xl border px-3 py-2 ${severityColor(w.severity)}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                      {w.severity}
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
            {round.backfillReceivedCount > 0 && <span>{round.backfillReceivedCount} received backfill</span>}
            {round.developmentReceivedCount > 0 && <span>{round.developmentReceivedCount} received development</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}

function RulesTab({ rotationPaths, teamId: _teamId }: { rotationPaths: RotationPathSummary[]; teamId: string }) {
  if (rotationPaths.length === 0) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
          <p className="text-sm app-copy-soft">No rotation paths configured for this team.</p>
        </div>
        <div>
          <Link
            className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
            href="/rules"
          >
            View Rules page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          Rotation paths
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {rotationPaths.map((path) => (
            <Link
              key={path.id}
              className="group/path rounded-xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3 hover:bg-[rgba(255,255,255,0.04)]"
              href={`/teams/${path.partnerTeamId}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-100 group-hover/path:text-[var(--accent-strong)]">
                  {path.partnerTeamName}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${path.role === "SUPPORT" ? "border-[rgba(178,140,219,0.24)] bg-[rgba(178,140,219,0.08)] text-[#c0a0db]" : path.role === "DEVELOPMENT" ? "border-[rgba(140,167,146,0.24)] bg-[rgba(140,167,146,0.08)] text-[var(--accent-strong)]" : "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.08)] text-[var(--warning)]"}`}>
                  {path.role}
                </span>
              </div>
              {path.purpose && (
                <p className="mt-1 text-xs app-copy-muted">{path.purpose}</p>
              )}
              {path.priority != null && (
                <p className="mt-1 text-[10px] app-copy-muted">Priority: {path.priority}</p>
              )}
              {!path.active && (
                <span className="mt-1 inline-block rounded-full border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[#f0cbc5]">
                  Inactive
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
          href="/rules"
        >
          View and edit rules on the Rules page
        </Link>
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
                  Support priority {data.supportPriority}
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
              {data.receivedSupportCount + data.receivedBackfillCount + data.receivedDevelopmentCount}
            </p>
          </div>
          {data.warningCount > 0 && (
            <div className="rounded-2xl border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f0cbc5]">Warnings</p>
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
        {activeTab === "history" && <HistoryTab finalizedRounds={data.finalizedRounds} />}
        {activeTab === "rules" && <RulesTab rotationPaths={data.rotationPaths} teamId={data.teamId} />}
      </section>
    </div>
  );
}