"use client";

import Link from "next/link";
import {
  Calendar,
  MapPin,
  Trophy,
  Users,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { RoleBadge } from "@/components/ui/role-badge";

type SelectionRow = {
  id: string;
  playerId: string;
  playerName: string;
  coreTeamName: string;
  role: string;
  status: string;
  manualOverride: boolean;
  selectionReason: string;
  priorityScore: number | null;
};

type WarningRow = {
  id: string;
  code: string;
  severity: string;
  message: string;
};

type MatchData = {
  id: string;
  teamId: string;
  teamName: string;
  opponent: string;
  startsAt: Date;
  homeAway: string;
  matchType: string;
  gameFormat: string;
  squadSize: number;
  matchRoundId: string;
  matchRoundName: string;
  matchRoundStatus: string;
  matchFit: string;
  notes: string | null;
  selections: SelectionRow[];
  warnings: WarningRow[];
};

const roleOrder = ["CORE", "SUPPORT", "BACKFILL", "DEVELOPMENT", "REDUCED_MATCH_LOAD_DROP", "CORE_MATCH_DROP", "UNAVAILABLE"];

function formatMatchType(type: string): string {
  const map: Record<string, string> = { LEAGUE: "League", FRIENDLY: "Friendly", CUP: "Cup", DEVELOPMENT: "Development" };
  return map[type] ?? type;
}

function formatGameFormat(format: string): string {
  const map: Record<string, string> = { SEVEN_A_SIDE: "7-a-side", NINE_A_SIDE: "9-a-side", ELEVEN_A_SIDE: "11-a-side" };
  return map[format] ?? format;
}

function formatVenue(venue: string): string {
  return venue === "HOME" ? "Home" : "Away";
}

function formatMatchFit(fit: string): string {
  const map: Record<string, string> = {
    UNKNOWN: "Not evaluated",
    TOO_EASY: "Too easy",
    GOOD_FIT: "Good fit",
    TOO_HARD: "Too hard",
    CHAOTIC: "Chaotic",
    SUPPORT_OVERPOWERED: "Support overpowered",
    SUPPORT_TOO_LOW: "Support too low",
  };
  return map[fit] ?? fit;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    NOT_GENERATED: "Not generated",
    DRAFT: "Draft",
    BLOCKED: "Blocked",
    READY: "Ready",
    FINALIZED: "Finalized",
  };
  return map[status] ?? status;
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    NOT_GENERATED: "text-[var(--text-muted)]",
    DRAFT: "text-amber-300",
    BLOCKED: "text-red-400",
    READY: "text-emerald-400",
    FINALIZED: "text-zinc-100",
  };
  return map[status] ?? "text-zinc-100";
}

function severityColor(severity: string): string {
  const map: Record<string, string> = {
    HARD_BLOCK: "text-red-400 bg-red-900/20 border-red-800/40",
    REQUIRES_OVERRIDE: "text-amber-300 bg-amber-900/20 border-amber-800/40",
    WARNING: "text-yellow-200 bg-yellow-900/20 border-yellow-800/40",
    SCORING_PREFERENCE: "text-zinc-300 bg-zinc-800/30 border-zinc-700/40",
  };
  return map[severity] ?? "text-zinc-300";
}

export function MatchDetail({ match }: { match: MatchData }) {
  const dateStr = match.startsAt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const timeStr = match.startsAt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const grouped = roleOrder
    .map((role) => ({
      role,
      players: match.selections.filter((s) => s.role === role),
    }))
    .filter((g) => g.players.length > 0);

  const blockingWarnings = match.warnings.filter((w) => w.severity === "HARD_BLOCK");
  const otherWarnings = match.warnings.filter((w) => w.severity !== "HARD_BLOCK");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href="/matches"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-zinc-50 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All matches
        </Link>
      </div>

      <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-zinc-50">
              {match.teamName} vs {match.opponent}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              <Calendar className="mr-1 inline h-3.5 w-3.5" />
              {dateStr} at {timeStr}
            </p>
          </div>
          <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${statusColor(match.matchRoundStatus)}`}>
            {formatStatus(match.matchRoundStatus)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Venue</p>
            <p className="text-sm text-zinc-100">
              <MapPin className="mr-1 inline h-3.5 w-3.5" />
              {formatVenue(match.homeAway)}
            </p>
          </div>
          <div className="rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Type</p>
            <p className="text-sm text-zinc-100">
              <Trophy className="mr-1 inline h-3.5 w-3.5" />
              {formatMatchType(match.matchType)}
            </p>
          </div>
          <div className="rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Format</p>
            <p className="text-sm text-zinc-100">{formatGameFormat(match.gameFormat)}</p>
          </div>
          <div className="rounded-lg border app-hairline bg-[rgba(255,255,255,0.03)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Target squad</p>
            <p className="text-sm text-zinc-100">
              <Users className="mr-1 inline h-3.5 w-3.5" />
              {match.selections.length} / {match.squadSize}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span>Round:</span>
          <Link
            href={`/rounds/${match.matchRoundId}`}
            className="text-[var(--accent-strong)] hover:underline"
          >
            {match.matchRoundName}
          </Link>
        </div>

        {match.matchFit !== "UNKNOWN" && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Match fit: {formatMatchFit(match.matchFit)}
          </p>
        )}

        {match.notes && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">{match.notes}</p>
        )}
      </div>

      {blockingWarnings.length > 0 && (
        <div className="rounded-2xl border border-red-800/40 bg-red-950/20 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-red-300">
            <AlertTriangle className="h-4 w-4" />
            Blocking warnings ({blockingWarnings.length})
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {blockingWarnings.map((w) => (
              <li key={w.id} className={`rounded-lg border px-3 py-2 text-xs ${severityColor(w.severity)}`}>
                <strong>{w.code}</strong>: {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {otherWarnings.length > 0 && (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
          <h2 className="text-sm font-semibold text-zinc-200">
            Warnings ({otherWarnings.length})
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {otherWarnings.map((w) => (
              <li key={w.id} className={`rounded-lg border px-3 py-2 text-xs ${severityColor(w.severity)}`}>
                <strong>{w.code}</strong>: {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {grouped.length > 0 ? (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3">
            Squad ({match.selections.length} players)
          </h2>
          <div className="flex flex-col gap-3">
            {grouped.map((group) => (
              <div key={group.role}>
                <div className="flex items-center gap-1.5 mb-1">
                  <RoleBadge role={group.role as any} />
                  <span className="text-[10px] text-[var(--text-muted)]">{group.players.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.players.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-soft)]"
                    >
                      <Link href={`/players/${p.playerId}`} className="hover:text-zinc-50 transition-colors">
                        {p.playerName}
                      </Link>
                      <span className="text-[10px] text-[var(--text-muted)]">{p.coreTeamName}</span>
                      {p.manualOverride && (
                        <span className="text-[8px] text-amber-400 uppercase">ovr</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm text-[var(--text-muted)]">
          No squad selections yet.{" "}
          <Link href={`/rounds/${match.matchRoundId}`} className="text-[var(--accent-strong)] hover:underline">
            Go to round
          </Link>{" "}
          to generate or edit the squad.
        </div>
      )}
    </div>
  );
}