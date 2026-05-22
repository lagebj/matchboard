"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { OverrideReasonInput } from "@/components/round/override-reason-input";
import type { SelectionRole } from "@/generated/prisma/client";
import {
  Calendar,
  MapPin,
  Trophy,
  Users,
  AlertTriangle,
  Lock,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { RoleBadge } from "@/components/ui/role-badge";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";
import { MatchdayResponsibilitySelector } from "@/components/matches/matchday-responsibility-selector";
import { formatWarningCode } from "@/lib/match-utils";

type SelectionRow = {
  id: string;
  playerId: string;
  playerName: string;
  coreTeamName: string;
  role: string;
  status: string;
  manualOverride: boolean;
  controlledDoubleLoad: boolean;
  selectionReason: string;
  priorityScore: number | null;
  overrideReason: string | null;
  matchdayResponsibility?: string | null;
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
  postMatchStatus?: string;
  selections: SelectionRow[];
  warnings: WarningRow[];
  coachingIntent?: string;
  coachingIntentId?: string;
  inheritedIntentScope?: "round" | "planning period";
  opponentTeamId?: string | null;
};

const roleOrder = ["CORE", "SUPPORT", "BACKFILL", "DEVELOPMENT", "REDUCED_MATCH_LOAD_DROP", "CORE_MATCH_DROP", "UNAVAILABLE"];

type MatchTab = "squad" | "after-match" | "opponent";

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

function isMatchFinalized(selections: SelectionRow[]): boolean {
  if (selections.length === 0) return false;
  return selections.every((s) => s.status === "FINALIZED");
}

const tabs: { key: MatchTab; label: string; icon: React.ReactNode }[] = [
  { key: "squad", label: "Squad", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "after-match", label: "After match", icon: <ClipboardList className="h-3.5 w-3.5" /> },
  { key: "opponent", label: "Opponent context", icon: <Eye className="h-3.5 w-3.5" /> },
];

export function MatchDetail({ match }: { match: MatchData }) {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const finalized = searchParams.get("finalized");
  const roundFinalized = searchParams.get("roundFinalized");
  const [isPending, startTransition] = useTransition();
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [matchOverrideReason, setMatchOverrideReason] = useState({ category: "", detail: "" });
  const [activeTab, setActiveTab] = useState<MatchTab>("squad");

  const activeTabParam = searchParams.get("tab");
  const currentTab: MatchTab = activeTabParam === "after-match" ? "after-match" : activeTabParam === "opponent" ? "opponent" : "squad";
  const selectedTab = activeTab ?? currentTab;

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
  const requiresOverrideWarnings = match.warnings.filter((w) => w.severity === "REQUIRES_OVERRIDE");
  const otherWarnings = match.warnings.filter((w) => w.severity !== "HARD_BLOCK" && w.severity !== "REQUIRES_OVERRIDE");
  const hasOverrideWarnings = blockingWarnings.length > 0 || requiresOverrideWarnings.length > 0;

  const matchFinalized = isMatchFinalized(match.selections);
  const roundFinalizedFlag = match.matchRoundStatus === "FINALIZED";
  const canFinalize = !matchFinalized && !roundFinalizedFlag && match.selections.length > 0;

  const hasSidebarContent = match.warnings.length > 0 || canFinalize || matchFinalized || roundFinalizedFlag || !!error || !!finalized;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href="/fixtures"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-zinc-50 transition-colors"
        >
          <Calendar className="h-3.5 w-3.5" />
          Fixtures
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
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${statusColor(match.matchRoundStatus)}`}>
              {formatStatus(match.matchRoundStatus)}
            </span>
            {match.postMatchStatus && match.postMatchStatus !== "NOT_STARTED" && (
              <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                match.postMatchStatus === "LOCKED" ? "bg-emerald-900/15 text-emerald-300 border border-emerald-700/40" :
                match.postMatchStatus === "REPORTED" ? "bg-blue-900/15 text-blue-300 border border-blue-700/40" :
                "bg-amber-900/15 text-amber-300 border border-amber-700/40"
              }`}>
              {match.postMatchStatus === "DRAFT" ? "Draft report" : match.postMatchStatus === "REPORTED" ? "Reported" : match.postMatchStatus === "LOCKED" ? "Report locked" : match.postMatchStatus}
            </span>
            )}
          </div>
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

        <div className="mt-3">
          <CoachingIntentSelector
            scopeType="MATCH"
            scopeId={match.id}
            currentIntent={match.coachingIntent}
            currentIntentId={match.coachingIntentId}
          />
          {match.inheritedIntentScope && match.coachingIntent && (
            <p className="mt-1 text-[10px] text-zinc-500">
              Inherited from {match.inheritedIntentScope}
            </p>
          )}
        </div>
      </div>

      <nav className="flex gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedTab === tab.key
                ? "bg-[rgba(255,255,255,0.08)] text-zinc-100"
                : "text-[var(--text-muted)] hover:text-zinc-200 hover:bg-[rgba(255,255,255,0.04)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {selectedTab === "squad" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-5">
            {grouped.length > 0 ? (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <h2 className="text-sm font-semibold text-zinc-200 mb-3">
                  Squad ({match.selections.length} players)
                </h2>
                <div className="flex flex-col gap-3">
                  {grouped.map((group) => (
                    <div key={group.role}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <RoleBadge role={group.role as SelectionRole} />
                        <span className="text-[10px] text-[var(--text-muted)]">{group.players.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.players.map((p) => (
                          <span
                            key={p.id}
                            title={p.playerName}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
                              p.status === "FINALIZED"
                                ? "border-emerald-700/40 bg-emerald-900/10 text-emerald-200"
                                : "border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-soft)]"
                            }`}
                          >
                            <Link href={`/players/${p.playerId}`} className="hover:text-zinc-50 transition-colors">
                              {p.playerName}
                            </Link>
                            <span className="text-[10px] text-[var(--text-muted)]">{p.coreTeamName}</span>
                            {p.manualOverride && (
                              <span className="text-[8px] text-amber-400 uppercase">ovr</span>
                            )}
                            <MatchdayResponsibilitySelector
                              selectionId={p.id}
                              currentResponsibility={p.matchdayResponsibility}
                              status={p.status}
                            />
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

          {hasSidebarContent && (
            <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
              {error && (
                <div className="rounded-2xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              {finalized && (
                <div className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
                  <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
                  Match finalized.
                  {roundFinalized && " Entire round finalized."}
                </div>
              )}

              {matchFinalized && !finalized && (
                <div className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
                  <Lock className="mr-1.5 inline h-4 w-4" />
                  This match is finalized.
                </div>
              )}

              {roundFinalizedFlag && !finalized && !matchFinalized && (
                <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3 text-sm text-zinc-300">
                  <Lock className="mr-1.5 inline h-4 w-4" />
                  This round is finalized.
                  <Link href={`/rounds/${match.matchRoundId}`} className="ml-1.5 text-[var(--accent-strong)] hover:underline">
                    View round
                  </Link>
                </div>
              )}

              {canFinalize && (
                <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                  <h3 className="text-sm font-semibold text-zinc-200 mb-2">Finalize match</h3>
                  <p className="text-xs text-[var(--text-muted)] mb-3">
                    Lock selections for this match. {match.selections.length} of {match.squadSize} players selected.
                  </p>
                  {blockingWarnings.length > 0 && (
                    <p className="text-xs text-red-300 mb-2">
                      <AlertTriangle className="mr-1 inline h-3 w-3" />
                      {blockingWarnings.length} blocking {blockingWarnings.length === 1 ? "warning" : "warnings"} — override reason required.
                    </p>
                  )}
                  {hasOverrideWarnings && (
                    <OverrideReasonInput
                      hasBlockingWarnings={true}
                      value={matchOverrideReason}
                      onChange={setMatchOverrideReason}
                    />
                  )}
                  <button
                    className="w-full rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                    disabled={isPending || (hasOverrideWarnings && (!matchOverrideReason.category || matchOverrideReason.detail.trim().length < 10))}
                    onClick={() => {
                      startTransition(async () => {
                        const fd = new FormData();
                        fd.set("matchId", match.id);
                        if (hasOverrideWarnings && matchOverrideReason.category) {
                          fd.set("overrideReasonCategory", matchOverrideReason.category);
                        }
                        if (hasOverrideWarnings && matchOverrideReason.detail.trim()) {
                          fd.set("overrideReasonDetail", matchOverrideReason.detail.trim());
                        }
                        const { finalizeMatchAction } = await import("@/app/(app)/matches/actions");
                        await finalizeMatchAction(fd);
                      });
                    }}
                    type="button"
                  >
                    <ShieldCheck className="mr-1.5 inline h-4 w-4" />
                    {isPending ? "Finalizing..." : "Finalize this match"}
                  </button>
                  <Link
                    href={`/rounds/${match.matchRoundId}`}
                    className="mt-2 block text-center text-xs text-[var(--accent-strong)] hover:underline"
                  >
                    Finalize entire round instead
                  </Link>
                </div>
              )}

              {(blockingWarnings.length > 0 || requiresOverrideWarnings.length > 0) && (
                <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings ({blockingWarnings.length + requiresOverrideWarnings.length} actionable{otherWarnings.length > 0 ? `, ${otherWarnings.length} informational` : ""})
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {blockingWarnings.map((w) => (
                      <li key={w.id} className={`rounded-lg border px-3 py-2 text-xs ${severityColor(w.severity)}`}>
                        <strong>{formatWarningCode(w.code)}</strong>: {w.message}
                      </li>
                    ))}
                    {requiresOverrideWarnings.map((w) => (
                      <li key={w.id} className={`rounded-lg border px-3 py-2 text-xs ${severityColor(w.severity)}`}>
                        <strong>{formatWarningCode(w.code)}</strong>: {w.message}
                      </li>
                    ))}
                  </ul>
                  {otherWarnings.length > 0 && (
                    <button
                      className="mt-2 text-xs text-[var(--accent-strong)] hover:underline"
                      onClick={() => setShowAllWarnings(!showAllWarnings)}
                      type="button"
                    >
                      {showAllWarnings ? "Hide" : `Show ${otherWarnings.length} informational ${otherWarnings.length === 1 ? "warning" : "warnings"}`}
                    </button>
                  )}
                  {showAllWarnings && otherWarnings.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {otherWarnings.map((w) => (
                        <li key={w.id} className={`rounded-lg border px-3 py-2 text-xs ${severityColor(w.severity)}`}>
                          <strong>{formatWarningCode(w.code)}</strong>: {w.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {selectedTab === "after-match" && (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-6">
          <h2 className="text-base font-semibold text-zinc-100 mb-3">After match</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Record post-match results, player feedback, and team reflection.
          </p>
          <Link
            href={`/matches/${match.id}/post-match`}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 py-2 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))]"
          >
            <ClipboardList className="h-4 w-4" />
            Open post-match report
          </Link>
        </div>
      )}

      {selectedTab === "opponent" && (
        <div className="flex flex-col gap-4">
          {match.opponentTeamId ? (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-6">
              <h2 className="text-base font-semibold text-zinc-100 mb-3">Opponent context</h2>
              <p className="text-sm text-[var(--text-muted)] mb-4">
                View previous encounters, match fit, and post-match observations for this opponent.
              </p>
              <Link
                href={`/opponents/${match.opponentTeamId}`}
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 py-2 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))]"
              >
                <Eye className="h-4 w-4" />
                View opponent detail
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm text-[var(--text-muted)]">
              No opponent team linked to this match. Observations and encounter history require an opponent team.
            </div>
          )}
        </div>
      )}
    </div>
  );
}