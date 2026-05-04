"use client";

import Link from "next/link";
import type { GameFormat, SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { formatDate } from "@/lib/date-utils";
import { formatMatchVenue } from "@/lib/match-utils";
import { formatPlayerName } from "@/lib/player-metrics";

type BucketKey =
  | "CORE"
  | "SUPPORT"
  | "BACKFILL"
  | "DEVELOPMENT"
  | "CONFIDENCE_REBUILD"
  | "CORE_MATCH_DROP"
  | "REDUCED_MATCH_LOAD_DROP"
  | "MANUAL_OVERRIDE";

type PlayerCardData = {
  id: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string;
  coreTeamId: string;
  coreTeamName: string;
  role: SelectionRole;
  explanation?: string | null;
  currentAvailability?: string;
  nonRotatable?: boolean;
};

type BucketGroup = {
  key: BucketKey;
  label: string;
  players: PlayerCardData[];
};

type WarningItem = {
  rule: string;
  message: string;
  severity: string;
};

type RoundBoardColumnProps = {
  matchId: string;
  teamName: string;
  opponent: string;
  startsAt: Date;
  homeAway: string;
  gameFormat: GameFormat;
  squadSize: number;
  targetSquadSize: number;
  minAcceptedSquadSize: number;
  selectedCount: number;
  supportCount: number;
  latestSelectionStatus: SelectionStatus | null;
  matchRoundStatus: string;
  warnings: WarningItem[];
  buckets: BucketGroup[];
  onMovePlayer?: (matchId: string, playerId: string, targetBucket: BucketKey) => void;
};

const BUCKET_ORDER: BucketKey[] = [
  "CORE",
  "SUPPORT",
  "BACKFILL",
  "DEVELOPMENT",
  "CONFIDENCE_REBUILD",
  "CORE_MATCH_DROP",
  "REDUCED_MATCH_LOAD_DROP",
  "MANUAL_OVERRIDE",
];

const BUCKET_LABELS: Record<BucketKey, string> = {
  CORE: "Core",
  SUPPORT: "Support received",
  BACKFILL: "Backfill received",
  DEVELOPMENT: "Development",
  CONFIDENCE_REBUILD: "Confidence rebuild",
  CORE_MATCH_DROP: "Dropped",
  REDUCED_MATCH_LOAD_DROP: "Dropped",
  MANUAL_OVERRIDE: "Manual override",
};

const BUCKET_VISUAL: Record<BucketKey, { border: string; bg: string; accent: string }> = {
  CORE: {
    border: "border-[rgba(140,167,146,0.2)]",
    bg: "bg-[rgba(140,167,146,0.04)]",
    accent: "text-[var(--accent-strong)]",
  },
  SUPPORT: {
    border: "border-[rgba(208,176,127,0.2)]",
    bg: "bg-[rgba(208,176,127,0.04)]",
    accent: "text-[var(--warning)]",
  },
  BACKFILL: {
    border: "border-[rgba(208,176,127,0.2)]",
    bg: "bg-[rgba(208,176,127,0.04)]",
    accent: "text-[var(--warning)]",
  },
  DEVELOPMENT: {
    border: "border-[rgba(140,167,146,0.18)]",
    bg: "bg-[rgba(140,167,146,0.03)]",
    accent: "text-[var(--accent-strong)]",
  },
  CONFIDENCE_REBUILD: {
    border: "border-[rgba(202,209,219,0.14)]",
    bg: "bg-[rgba(202,209,219,0.03)]",
    accent: "text-[var(--text-soft)]",
  },
  CORE_MATCH_DROP: {
    border: "border-[rgba(185,128,119,0.2)]",
    bg: "bg-[rgba(185,128,119,0.04)]",
    accent: "text-[var(--danger)]",
  },
  REDUCED_MATCH_LOAD_DROP: {
    border: "border-[rgba(185,128,119,0.2)]",
    bg: "bg-[rgba(185,128,119,0.04)]",
    accent: "text-[var(--danger)]",
  },
  MANUAL_OVERRIDE: {
    border: "border-[rgba(202,209,219,0.14)]",
    bg: "bg-[rgba(202,209,219,0.03)]",
    accent: "text-[var(--text-soft)]",
  },
};

function formatGameFormat(format: GameFormat): string {
  switch (format) {
    case "SEVEN_A_SIDE":
      return "7v7";
    case "NINE_A_SIDE":
      return "9v9";
    case "ELEVEN_A_SIDE":
      return "11v11";
    default:
      return String(format);
  }
}

function getStatusChip(status: SelectionStatus | null): { label: string; className: string } {
  if (status === "FINALIZED") {
    return {
      label: "Finalized",
      className: "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]",
    };
  }
  if (status === "DRAFT") {
    return {
      label: "Draft",
      className: "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]",
    };
  }
  return {
    label: "No selection",
    className: "border-[rgba(202,209,219,0.14)] bg-[rgba(255,255,255,0.04)] text-[var(--text-soft)]",
  };
}

function PlayerActionMenu({
  player,
  matchId,
  currentBucket,
  onMovePlayer,
}: {
  player: PlayerCardData;
  matchId: string;
  currentBucket: BucketKey;
  onMovePlayer?: RoundBoardColumnProps["onMovePlayer"];
}) {
  const moveTargets: BucketKey[] = BUCKET_ORDER.filter((b) => b !== currentBucket);

  return (
    <div className="relative ml-auto">
      <details className="group">
        <summary className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] text-[10px] app-copy-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50 list-none">
          &#8943;
        </summary>
        <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-xl border app-hairline bg-[rgba(17,22,31,0.98)] p-1 shadow-xl backdrop-blur-xl">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] app-copy-muted">
            Move to role
          </p>
          {moveTargets.map((target) => (
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-100 hover:bg-[rgba(255,255,255,0.06)]"
              key={target}
              onClick={() => onMovePlayer?.(matchId, player.id, target)}
              type="button"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${BUCKET_VISUAL[target].accent === "text-[var(--danger)]" ? "bg-[var(--danger)]" : BUCKET_VISUAL[target].accent === "text-[var(--warning)]" ? "bg-[var(--warning)]" : "bg-[var(--accent-strong)]"}`}
              />
              {BUCKET_LABELS[target]}
            </button>
          ))}
          <div className="my-1 border-t app-hairline" />
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--danger)] hover:bg-[rgba(185,128,119,0.1)]"
            onClick={() => onMovePlayer?.(matchId, player.id, currentBucket)}
            type="button"
          >
            Remove from selection
          </button>
        </div>
      </details>
    </div>
  );
}

export function RoundBoardColumn({
  matchId,
  teamName,
  opponent,
  startsAt,
  homeAway,
  gameFormat,
  squadSize: _squadSize,
  targetSquadSize,
  minAcceptedSquadSize,
  selectedCount,
  supportCount,
  latestSelectionStatus,
  matchRoundStatus,
  warnings,
  buckets,
  onMovePlayer,
}: RoundBoardColumnProps) {
  const statusChip = getStatusChip(latestSelectionStatus);
  const isDraft = matchRoundStatus === "DRAFT";
  const isBelowMin = selectedCount < minAcceptedSquadSize;
  const isBelowTarget = selectedCount < targetSquadSize;

  const orderedBuckets = BUCKET_ORDER.map((key) => {
    const bucket = buckets.find((b) => b.key === key);
    return bucket ?? { key, label: BUCKET_LABELS[key], players: [] };
  });

  return (
    <div className="flex min-w-[22rem] max-w-[26rem] flex-1 flex-col rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)]">
      <div className="rounded-t-[1.5rem] border-b app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-zinc-50">{teamName}</p>
            <p className="mt-1 text-sm app-copy-soft">
              vs. {opponent}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] app-copy-muted">
              {formatDate(startsAt)} &middot; {formatMatchVenue(homeAway as import("@/generated/prisma/client").MatchVenue)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusChip.className}`}
          >
            {statusChip.label}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${isBelowMin ? "border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.12)] text-[var(--danger)]" : isBelowTarget ? "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]" : "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]"}`}
          >
            {selectedCount} / {targetSquadSize}
          </span>
          <span className="rounded-full border app-hairline px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] app-copy-muted">
            min {minAcceptedSquadSize}
          </span>
          <span className="rounded-full border app-hairline px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] app-copy-muted">
            support {supportCount}
          </span>
          <span className="rounded-full border app-hairline px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] app-copy-muted">
            {formatGameFormat(gameFormat)}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-2.5">
          {orderedBuckets.map((bucket) => {
            const visual = BUCKET_VISUAL[bucket.key];
            if (bucket.players.length === 0) return null;

            return (
              <div
                key={bucket.key}
                className={`rounded-xl border p-3 ${visual.border} ${visual.bg}`}
              >
                <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${visual.accent}`}>
                  {bucket.label} ({bucket.players.length})
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {bucket.players.map((player) => {
                    const isDifferentCoreTeam = player.coreTeamId !== matchId.split("_")[0];
                    return (
                      <div
                        key={player.id}
                        className="flex items-center gap-2 rounded-lg border app-hairline bg-[rgba(0,0,0,0.12)] px-2.5 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            className="truncate text-sm font-medium text-zinc-100 hover:text-zinc-50"
                            href={`/players/${player.id}`}
                          >
                            {formatPlayerName(player)}
                          </Link>
                          <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] app-copy-muted">
                            {isDifferentCoreTeam ? player.coreTeamName : player.primaryPosition}
                            {player.nonRotatable && <span className="ml-1.5 text-[var(--accent-strong)]">non-rotatable</span>}
                            {player.currentAvailability === "TENTATIVE" && <span className="ml-1.5 text-[var(--warning)]">tentative</span>}
                          </p>
                          {player.explanation && (
                            <p className="mt-0.5 text-[10px] leading-4 app-copy-soft line-clamp-2">
                              {player.explanation}
                            </p>
                          )}
                        </div>
                        {isDraft && (
                          <PlayerActionMenu
                            currentBucket={bucket.key}
                            matchId={matchId}
                            onMovePlayer={onMovePlayer}
                            player={player}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {buckets.every((b) => b.players.length === 0) && (
            <p className="py-4 text-center text-sm app-copy-soft">No selections yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-b-[1.5rem] border-t app-hairline bg-[rgba(0,0,0,0.08)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            className="inline-flex h-8 items-center rounded-full border app-hairline px-3 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
            href={`/selection/${matchId}`}
          >
            Open selection
          </Link>
          {warnings.length > 0 && (
            <span className="rounded-full border border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--warning)]">
              {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {warnings.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-[10px] leading-4 app-copy-soft">
                {w.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}