"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { OverrideReasonInput } from "@/components/round/override-reason-input";
import { MatchTacticsPanel } from "@/components/matches/match-tactics-panel";
import type { SelectionRole } from "@/generated/prisma/client";
import {
  Calendar,
  MapPin,
  Trophy,
  Users,
  ClipboardList,
  ClipboardCheck,
  ShieldCheck,
  Eye,
  LayoutGrid,
  XCircle,
  RotateCcw,
  RotateCw,
  Radio,
  Tv,
} from "lucide-react";
import { RoleBadge } from "@/components/ui/role-badge";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";
import { MatchdayResponsibilitySelector } from "@/components/matches/matchday-responsibility-selector";
import { AbsenceControl } from "@/components/matches/absence-control";
import { MatchEditForm } from "@/components/matches/match-edit-form";
import { MatchHelpersPanel } from "@/components/matches/match-helpers-panel";
import { PlannedRotationPanel } from "@/components/matches/planned-rotation-panel";
import type { PlannedRotationWithChanges } from "@/lib/planned-rotation/planned-rotation";
import { PreviousEncountersDisplay } from "@/components/opponents/previous-encounters-display";
import { PLAYING_STYLE_TAG_LABELS, type PlayingStyleTag } from "@/lib/opponents/playing-style-tags";
import { cancelMatchAction, reopenMatchAction } from "@/app/(app)/matches/actions";
import { formatWarningCode } from "@/lib/match-utils";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Surface } from "@/components/ui/surface";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { Button } from "@/components/ui/button";
import { StatusPill, type StatusPillVariant } from "@/components/ui/status-pill";
import { MatchLifecycleBadge, type MatchLifecycleStatus } from "@/components/ui/status-badge";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { TabRail, type TabItem } from "@/components/ui/tab-rail";
import { TeamShield } from "@/components/ui/team-shield";
import { IntentCard } from "@/components/ui/intent-card";
import { MetricTile } from "@/components/ui/metric-tile";
import { COACHING_INTENT_LABELS, type CoachingIntentCategory } from "@/lib/coaching/types";
import type { OpponentHistoryData } from "@/lib/audit/opponent-history";
import { useOrgUrl } from "@/components/shell/org-slug-context";

type SelectionRow = {
  id: string;
  playerId: string;
  playerName: string;
  playerFirstName: string;
  playerLastName: string | null;
  coreTeamName: string;
  role: string;
  status: string;
  manualOverride: boolean;
  controlledDoubleLoad: boolean;
  selectionReason: string;
  priorityScore: number | null;
  overrideReason: string | null;
  matchdayResponsibility?: string | null;
  primaryPosition: string;
  secondaryPosition: string | null;
  /** Match-specific absence (production consistency pass item #3) — null means the player is an
   * active participant for this match. Independent of round/team assignment (Selection stays). */
  absenceReason?: string | null;
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
  matchStatus: string;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  postMatchStatus?: string;
  /** The primary, football-action-oriented match status (ADR-0101) — computed server-side via
   * deriveMatchLifecycleStatus(). Supersedes matchRoundStatus/postMatchStatus as the label shown
   * to the coach; those remain available above for internal/legacy consumers. */
  lifecycleStatus?: MatchLifecycleStatus;
  selections: SelectionRow[];
  warnings: WarningRow[];
  coachingIntent?: string;
  coachingIntentId?: string;
  inheritedIntentScope?: "round" | "league season";
  opponentTeamId?: string | null;
  footballGroupId?: string;
  /** Whether an ACTIVE LiveMatchSession currently exists for this match — gates the "Follow
   * live" entry point below. Computed server-side; this component never re-derives it. */
  isLive?: boolean;
  /** Whether the current actor has at least GROUP_VIEWER access to this match's group —
   * computed server-side (AGENTS.md: "UI-only protection is insufficient"). The "Follow
   * live" button is hidden entirely when false, but the realtime ticket route enforces this
   * independently regardless of what this flag says. */
  canFollowLive?: boolean;
  opponentHistory?: OpponentHistoryData | null;
  opponentConcernCount?: number;
  opponentLatestConcernDate?: string | null;
  currentMatchStyleTags?: string[];
  phaseStartDate?: Date;
  phaseEndDate?: Date;
  plannedRotation?: PlannedRotationWithChanges | null;
  isCancelled?: boolean;
};

const roleOrder = [
  "CORE",
  "SUPPORT",
  "BACKFILL",
  "DEVELOPMENT",
  "HELPER",
  "REDUCED_MATCH_LOAD_DROP",
  "CORE_MATCH_DROP",
  "UNAVAILABLE",
];

type MatchTab = "squad" | "tactics" | "rotations" | "after-match" | "opponent" | "review";

function formatMatchType(type: string): string {
  const map: Record<string, string> = {
    LEAGUE: "League",
    FRIENDLY: "Friendly",
    CUP: "Cup",
    DEVELOPMENT: "Development",
  };
  return map[type] ?? type;
}

 function formatGameFormat(format: string): string {
   const map: Record<string, string> = {
     THREE_A_SIDE: "3-a-side",
     FIVE_A_SIDE: "5-a-side",
     SEVEN_A_SIDE: "7-a-side",
     NINE_A_SIDE: "9-a-side",
     ELEVEN_A_SIDE: "11-a-side",
   };
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

const STATUS_PILL_CONFIG: Record<string, { label: string; variant: StatusPillVariant }> = {
  NOT_GENERATED: { label: "Not generated", variant: "neutral" },
  DRAFT: { label: "Draft", variant: "warning" },
  BLOCKED: { label: "Blocked", variant: "danger" },
  READY: { label: "Ready", variant: "success" },
  FINALIZED: { label: "Finalised", variant: "finalized" },
};

const POST_MATCH_PILL: Record<string, { label: string; variant: StatusPillVariant }> = {
  DRAFT: { label: "Draft report", variant: "warning" },
  REPORTED: { label: "Reported", variant: "info" },
  LOCKED: { label: "Report complete", variant: "finalized" },
};

function isMatchFinalized(selections: SelectionRow[]): boolean {
  if (selections.length === 0) return false;
  return selections.every((s) => s.status === "FINALIZED");
}

const tabs: TabItem<MatchTab>[] = [
  { key: "squad", label: "Squad", icon: <Users className="h-3.5 w-3.5" aria-hidden="true" /> },
  {
    key: "tactics",
    label: "Tactics",
    icon: <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    key: "rotations",
    label: "Rotations",
    icon: <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    key: "after-match",
    label: "After match",
    icon: <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  { key: "opponent", label: "Opponent context", icon: <Eye className="h-3.5 w-3.5" aria-hidden="true" /> },
  { key: "review", label: "Review", icon: <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /> },
];

function severityToBannerVariant(
  severity: string,
): "blocked" | "decision" | "note" {
  if (severity === "HARD_BLOCK") return "blocked";
  if (severity === "REQUIRES_OVERRIDE") return "decision";
  return "note";
}

export function MatchDetail({ match }: { match: MatchData }) {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const finalized = searchParams.get("finalized");
  const roundFinalized = searchParams.get("roundFinalized");
  const orgUrl = useOrgUrl();
  const [isPending, startTransition] = useTransition();
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [matchOverrideReason, setMatchOverrideReason] = useState({ category: "", detail: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<MatchTab | null>(null);

  const activeTabParam = searchParams.get("tab");
  const currentTab: MatchTab =
    activeTabParam === "tactics"
      ? "tactics"
      : activeTabParam === "after-match"
        ? "after-match"
        : activeTabParam === "opponent"
          ? "opponent"
          : "squad";
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
    .map((role) => ({ role, players: match.selections.filter((s) => s.role === role) }))
    .filter((g) => g.players.length > 0);

  const blockingWarnings = match.warnings.filter((w) => w.severity === "HARD_BLOCK");
  const requiresOverrideWarnings = match.warnings.filter(
    (w) => w.severity === "REQUIRES_OVERRIDE",
  );
  const otherWarnings = match.warnings.filter(
    (w) => w.severity !== "HARD_BLOCK" && w.severity !== "REQUIRES_OVERRIDE",
  );
  const hasOverrideWarnings =
    blockingWarnings.length > 0 || requiresOverrideWarnings.length > 0;

  const matchFinalized = isMatchFinalized(match.selections);
  const roundFinalizedFlag = match.matchRoundStatus === "FINALIZED";
  const canFinalize = !matchFinalized && !roundFinalizedFlag && match.selections.length > 0;

  const intentLabel = match.coachingIntent
    ? COACHING_INTENT_LABELS[match.coachingIntent as CoachingIntentCategory] ??
      match.coachingIntent
    : null;

  const statusPill = STATUS_PILL_CONFIG[match.matchRoundStatus];
  const postMatchPill = match.postMatchStatus && match.postMatchStatus !== "NOT_STARTED"
    ? POST_MATCH_PILL[match.postMatchStatus]
    : null;

  const isCancelled = match.matchStatus === "CANCELLED";

  function handleCancel() {
    startTransition(async () => {
      await cancelMatchAction(match.id, cancelReason || undefined);
      router.refresh();
      setShowCancelDialog(false);
    });
  }

  function handleReopen() {
    if (!confirm("Reopen this match? It will be restored to scheduled status and will require normal post-match reporting.")) return;
    startTransition(async () => {
      await reopenMatchAction(match.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {isCancelled && (
        <DecisionBanner
          variant="blocked"
          title="Match cancelled"
          description={
            match.cancelledReason
              ? `This match was cancelled and will not require post-match reporting. Planned squad is kept for reference but will not count as played. Reason: ${match.cancelledReason}`
              : "This match was cancelled and will not require post-match reporting. Planned squad is kept for reference but will not count as played."
          }
          action={
            <Button variant="secondary" size="sm" onClick={handleReopen} disabled={isPending} leadingIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}>
              {isPending ? "Reopening…" : "Reopen match"}
            </Button>
          }
        />
      )}
      <div>
         <Link
           href={orgUrl("/fixtures")}
           className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-zinc-100 transition-colors"
         >
           <Calendar className="h-3.5 w-3.5" />
           Fixtures
        </Link>
      </div>

      <PageHeader
        title={`${match.teamName} vs ${match.opponent}`}
        description={`${dateStr} at ${timeStr}`}
        actions={
          <div className="flex items-center gap-2">
            <TeamShield teamName={match.teamName} size="sm" />
            {match.lifecycleStatus ? (
              <MatchLifecycleBadge status={match.lifecycleStatus} />
            ) : (
              <>
                {statusPill && (
                  <StatusPill variant={statusPill.variant}>{statusPill.label}</StatusPill>
                )}
                {isCancelled && (
                  <StatusPill variant="danger">Cancelled</StatusPill>
                )}
                {postMatchPill && !isCancelled && (
                  <StatusPill variant={postMatchPill.variant}>{postMatchPill.label}</StatusPill>
                )}
              </>
            )}
            {matchFinalized && !isCancelled && (
              <Button as={Link} href={`/matches/${match.id}/live`} variant="secondary" size="sm" leadingIcon={<Radio className="h-3.5 w-3.5" aria-hidden="true" />}>
                Live reporting
              </Button>
            )}
            {match.isLive && match.canFollowLive && (
              <Button as={Link} href={`/matches/${match.id}/live/follow`} variant="secondary" size="sm" leadingIcon={<Tv className="h-3.5 w-3.5" aria-hidden="true" />}>
                Follow live
              </Button>
            )}
          </div>
        }
        context={
          <span>
            Round:{" "}
            <Link
              href={`/rounds/${match.matchRoundId}`}
              className="text-[var(--accent-strong)] hover:underline"
            >
              {match.matchRoundName}
            </Link>
          </span>
        }
      />

      <TacticalSurface variant="hero" padding="lg">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetaTile icon={<MapPin className="h-3.5 w-3.5" />} label="Venue" value={formatVenue(match.homeAway)} />
          <MetaTile icon={<Trophy className="h-3.5 w-3.5" />} label="Type" value={formatMatchType(match.matchType)} />
          <MetaTile label="Format" value={formatGameFormat(match.gameFormat)} />
          <MetaTile
            icon={<Users className="h-3.5 w-3.5" />}
            label="Target squad"
            value={`${match.selections.length} / ${match.squadSize}`}
          />
        </div>

        {(intentLabel || match.matchFit !== "UNKNOWN" || match.notes) && (
          <div className="mt-3 flex flex-col gap-2">
            {intentLabel && (
              <IntentCard
                title={intentLabel}
                compact
              />
            )}
            {match.matchFit !== "UNKNOWN" && <p>Match fit: {formatMatchFit(match.matchFit)}</p>}
            {match.notes && <p>{match.notes}</p>}
          </div>
        )}

        <div className="mt-3">
          <MatchEditForm
            matchId={match.id}
            startsAt={match.startsAt}
            matchRoundName={match.matchRoundName}
            phaseStartDate={match.phaseStartDate ?? match.startsAt}
            phaseEndDate={match.phaseEndDate ?? match.startsAt}
          />
        </div>

        <div className="mt-3">
          <CoachingIntentSelector
            scopeType="MATCH"
            scopeId={match.id}
            currentIntent={match.coachingIntent}
            currentIntentId={match.coachingIntentId}
          />
        </div>
      </TacticalSurface>

      <TabRail
        items={tabs}
        activeKey={selectedTab}
        variant="pill"
        ariaLabel="Match sections"
        onSelect={(key) => {
          if (key === "after-match") {
            router.push(`/matches/${match.id}/post-match`);
            return;
          }
          if (key === "review") {
            router.push(`/matches/${match.id}/review`);
            return;
          }
          setActiveTab(key);
        }}
      />

      {selectedTab === "squad" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            {grouped.length > 0 ? (
              <Surface padding="md">
                <SectionHeader
                  title={`Squad`}
                  eyebrow={`${match.selections.length} player${match.selections.length === 1 ? "" : "s"}`}
                />
                <div className="mt-3 flex flex-col gap-3">
                  {grouped.map((group) => (
                    <div key={group.role}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <RoleBadge role={group.role as SelectionRole} />
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {group.players.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.players.map((p) => (
                          <span
                            key={p.id}
                            title={p.playerName}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs ${
                              p.absenceReason
                                ? "border-[var(--danger)]/20 bg-[var(--danger-subtle)] text-[var(--text-muted)] opacity-70"
                                : p.status === "FINALIZED"
                                  ? "border-[var(--accent)]/30 bg-[var(--accent-subtle)] text-[var(--accent-strong)]"
                                  : "border-[var(--border-soft)] bg-[var(--surface-muted)]/50 text-[var(--text-soft)]"
                            }`}
                          >
                            <Link
                              href={`/players/${p.playerId}`}
                              className={p.absenceReason ? "line-through hover:text-zinc-50 transition-colors" : "hover:text-zinc-50 transition-colors"}
                            >
                              {p.playerName}
                            </Link>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {p.coreTeamName}
                            </span>
                            {p.manualOverride && (
                              <span
                                className="text-[9px] font-semibold uppercase tracking-wider text-[var(--warning)]"
                                title="Manual override"
                              >
                                OVR
                              </span>
                            )}
                            <MatchdayResponsibilitySelector
                              selectionId={p.id}
                              currentResponsibility={p.matchdayResponsibility}
                              status={p.status}
                            />
                            <AbsenceControl
                              matchId={match.id}
                              playerId={p.playerId}
                              currentReason={p.absenceReason}
                              isLocked={isCancelled || match.postMatchStatus === "LOCKED"}
                            />
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Surface>
            ) : (
              <EmptyState
                title="No squad selections yet."
                description="Generate or edit the squad in the round board to plan this match."
                illustration="emptyLineup"
                action={
                  <Button
                    as={Link}
                    href={`/rounds/${match.matchRoundId}`}
                    variant="primary"
                    size="sm"
                  >
                    Go to round
                  </Button>
                }
              />
            )}
          </div>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
            {error && (
              <DecisionBanner variant="blocked" title="Error" description={error} />
            )}

            {!isCancelled && <MatchHelpersPanel matchId={match.id} />}

            {finalized && (
              <DecisionBanner
                variant="finalized"
                 title="Match finalised"
                 description={roundFinalized ? "Entire round finalised." : undefined}
              />
            )}

            {matchFinalized && !finalized && (
              <DecisionBanner
                variant="finalized"
                 title="This match is finalised."
              />
            )}

            {roundFinalizedFlag && !finalized && !matchFinalized && (
              <DecisionBanner
                variant="finalized"
                 title="This round is finalised."
                action={
                  <Button as={Link} href={`/rounds/${match.matchRoundId}`} variant="ghost" size="sm">
                    View round
                  </Button>
                }
              />
            )}

            {canFinalize && (
              <Surface padding="md">
                <SectionHeader
                   title="Finalise match"
                  description={`Lock selections. ${match.selections.length} of ${match.squadSize} players selected.`}
                />
                {hasOverrideWarnings && (
                  <p className="mt-2 text-xs text-[var(--danger)] inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    {blockingWarnings.length} blocked, {requiresOverrideWarnings.length} decision
                    {requiresOverrideWarnings.length === 1 ? "" : "s"} — override reason required.
                  </p>
                )}
                {hasOverrideWarnings && (
                  <div className="mt-3">
                    <OverrideReasonInput
                      hasBlockingWarnings={true}
                      value={matchOverrideReason}
                      onChange={setMatchOverrideReason}
                    />
                  </div>
                )}
                <div className="mt-3 flex flex-col gap-2">
                  <Button
                    variant="primary"
                    fullWidth
                    leadingIcon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                    disabled={
                      isPending ||
                      (hasOverrideWarnings &&
                        (!matchOverrideReason.category ||
                          matchOverrideReason.detail.trim().length < 10))
                    }
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
                        const { finalizeMatchAction } = await import(
                          "@/app/(app)/matches/actions"
                        );
                        await finalizeMatchAction(fd);
                      });
                    }}
                  >
                    {isPending ? "Finalising…" : "Finalise this match"}
                  </Button>
                  <Link
                    href={`/rounds/${match.matchRoundId}`}
                    className="text-center text-xs text-[var(--accent-strong)] hover:underline"
                  >
                    Finalise entire round instead
                  </Link>
                </div>
              </Surface>
            )}

            {(blockingWarnings.length > 0 || requiresOverrideWarnings.length > 0) && (
              <Surface padding="md">
                <SectionHeader
                  title="Plan checks"
                  description={`${blockingWarnings.length + requiresOverrideWarnings.length} need attention${otherWarnings.length > 0 ? `, ${otherWarnings.length} planning note${otherWarnings.length === 1 ? "" : "s"}` : ""}`}
                />
                <ul className="mt-3 flex flex-col gap-2">
                  {blockingWarnings.map((w) => (
                    <DecisionBanner
                      key={w.id}
                      variant={severityToBannerVariant(w.severity)}
                      title={formatWarningCode(w.code)}
                      description={w.message}
                    />
                  ))}
                  {requiresOverrideWarnings.map((w) => (
                    <DecisionBanner
                      key={w.id}
                      variant={severityToBannerVariant(w.severity)}
                      title={formatWarningCode(w.code)}
                      description={w.message}
                    />
                  ))}
                </ul>
                {otherWarnings.length > 0 && (
                  <button
                    className="mt-3 text-xs text-[var(--accent-strong)] hover:underline"
                    onClick={() => setShowAllWarnings(!showAllWarnings)}
                    type="button"
                  >
                    {showAllWarnings
                      ? "Hide planning notes"
                      : `Show ${otherWarnings.length} planning ${otherWarnings.length === 1 ? "note" : "notes"}`}
                  </button>
                )}
                {showAllWarnings && otherWarnings.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-2">
                    {otherWarnings.map((w) => (
                      <DecisionBanner
                        key={w.id}
                        variant="note"
                        title={formatWarningCode(w.code)}
                        description={w.message}
                      />
                    ))}
                  </ul>
                )}
              </Surface>
            )}
            {!isCancelled && !matchFinalized && (
              <Surface padding="md">
                <SectionHeader title="Cancel match" description="Mark this match as cancelled if it was not played." />
                {showCancelDialog ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-sm text-zinc-100 placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]"
                      placeholder="Cancellation reason (optional)"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" onClick={handleCancel} disabled={isPending}>
                        {isPending ? "Cancelling…" : "Confirm cancellation"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowCancelDialog(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-[var(--danger)]"
                    leadingIcon={<XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Mark as cancelled
                  </Button>
                )}
              </Surface>
            )}
          </aside>
        </div>
      )}

      {selectedTab === "tactics" && (
        <MatchTacticsPanel
          matchId={match.id}
          teamId={match.teamId}
          teamName={match.teamName}
          gameFormat={match.gameFormat}
          selections={match.selections.map((s) => ({
            playerId: s.playerId,
            playerName: s.playerName,
            role: s.role,
            coreTeamName: s.coreTeamName,
            primaryPosition: s.primaryPosition,
            secondaryPosition: s.secondaryPosition,
          }))}
        />
      )}

      {selectedTab === "rotations" && (
        <PlannedRotationPanel
          matchId={match.id}
          teamId={match.teamId}
          rotation={match.plannedRotation ?? null}
          squadPlayers={match.selections.map((s) => ({
            id: s.playerId,
            firstName: s.playerFirstName,
            lastName: s.playerLastName,
            primaryPosition: s.primaryPosition,
          }))}
          readOnly={match.isCancelled ?? false}
        />
      )}

      {selectedTab === "after-match" && (
        isCancelled ? (
          <Surface padding="md">
            <SectionHeader title="Post-match report" />
            <p className="text-sm text-[var(--text-muted)]">
              This match was cancelled. No post-match report is required.
            </p>
          </Surface>
        ) : (
          <div className="flex flex-col gap-4">
            <Surface padding="md">
              <SectionHeader title="Post-match report" description="Record match results, player participation, and observations." />
              <Button
                as={Link}
                href={`/matches/${match.id}/post-match`}
                variant="primary"
                size="md"
                className="self-start mt-2"
              >
                Open post-match report
              </Button>
            </Surface>
            {match.plannedRotation && (
              <Surface padding="md">
                <SectionHeader title="Planned vs actual rotations" description="Compare planned rotation changes with what happened during the match." />
                <Button
                  as={Link}
                  href={`/matches/${match.id}/review`}
                  variant="secondary"
                  size="md"
                  className="self-start mt-2"
                >
                  View rotation review
                </Button>
              </Surface>
            )}
          </div>
        )
      )}

      {selectedTab === "opponent" && (
        <div className="flex flex-col gap-4">
          {match.opponentTeamId ? (
            <>
              {match.currentMatchStyleTags && match.currentMatchStyleTags.length > 0 && (
                <Surface padding="md">
                  <SectionHeader title="Opponent playing style" description="Observed style in this encounter. This describes this match, not a fixed trait." />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {match.currentMatchStyleTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-[var(--surface-raised)] border border-[var(--border-soft)] px-3 py-1 text-xs font-medium text-zinc-200"
                      >
                        {PLAYING_STYLE_TAG_LABELS[tag as PlayingStyleTag] ?? tag}
                      </span>
                    ))}
                  </div>
                </Surface>
              )}
              {match.opponentHistory && (
                <PreviousEncountersDisplay
                  history={match.opponentHistory}
                  concernCount={match.opponentConcernCount ?? 0}
                  latestConcernDate={match.opponentLatestConcernDate ?? null}
                  opponentTeamId={match.opponentTeamId}
                />
              )}
              <Surface padding="md" className="flex flex-col gap-3">
                <SectionHeader
                  title="Opponent context"
                  description="Sporting fit, post-match observations, and full encounter history."
                />
                <Button
                  as={Link}
                  href={`/opponents/${match.opponentTeamId}`}
                  variant="primary"
                  size="md"
                  leadingIcon={<Eye className="h-4 w-4" aria-hidden="true" />}
                  className="self-start"
                >
                  View opponent detail
                </Button>
              </Surface>
            </>
          ) : (
            <EmptyState
              title="No opponent profile linked yet."
              description="A canonical opponent profile is linked when the post-match report is completed."
            />
          )}
        </div>
      )}
    </div>
  );
}

function MetaTile({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const displayValue = typeof value === "string" || typeof value === "number" ? String(value) : String(value);
  return (
    <MetricTile
      icon={icon}
      label={label}
      value={displayValue}
      tone={tone}
    />
  );
}
