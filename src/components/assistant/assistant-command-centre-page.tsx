"use client";

import Link from "next/link";
import { formatKickoffTime } from "@/lib/date-utils";
import type { AssistantCommandCentre, AssistantWorkItem, TodayMatch } from "@/lib/assistant/types";
import type {
  CoachSituationProjection,
  CoachSituationProjectionStatus,
  SituationContext,
} from "@/lib/situational/situation-types";
import type { WeeklyCoachingContextResult } from "@/lib/weekly/weekly-coaching-context-types";
import { WeeklyCoachingContextSection } from "@/components/assistant/weekly-coaching-context-section";
import { workItemIdFromCandidateId } from "@/lib/situational/providers/assistant-candidate-provider";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Surface } from "@/components/ui/surface";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { MatchLifecycleBadge } from "@/components/ui/status-badge";
import { MetricTile } from "@/components/ui/metric-tile";
import { IssueMarker } from "@/components/ui/issue-marker";
import { BrandIllustration } from "@/components/ui/brand-illustration";
import { InstallPwaCard } from "@/components/pwa/install-prompt-card";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import {
  OctagonAlert,
  AlertTriangle,
  ClipboardList,
  CalendarRange,
  CalendarDays,
  ArrowRight,
  ShieldAlert,
  Eye,
  FileText,
  Radio,
  Timer,
} from "lucide-react";

/**
 * AssistantCommandCentrePage — mission board for coach operations.
 *
 * Layout:
 * 1. Page header
 * 2. Hero TacticalSurface with next action
 * 3. MetricTile row (blocked, decisions, reports, upcoming)
 * 4. Grouped work sections
 * 5. Repeated reports are grouped, not duplicated.
 *
 * No red/amber unless actual blocker/decision exists.
 * Next action is obvious within 3 seconds.
 */

type WorkCategory = AssistantWorkItem["category"];

type GroupKey = "blockers" | "decisions" | "setup" | "events" | "reviews" | "reports";

type GroupConfig = {
  key: GroupKey;
  label: string;
  description: string;
  categories: WorkCategory[];
  icon: typeof OctagonAlert;
  variant: "danger" | "warning" | "success" | "info" | "neutral";
};

const groups: GroupConfig[] = [
  {
    key: "blockers",
    label: "Blockers",
    description: "Hard problems that need fixing before kickoff.",
    categories: ["blocked_round"],
    icon: OctagonAlert,
    variant: "danger",
  },
  {
    key: "decisions",
    label: "Decisions",
    description: "Coach judgement needed before kickoff.",
    categories: ["decision_required"],
    icon: AlertTriangle,
    variant: "warning",
  },
  {
    key: "setup",
    label: "Setup",
    description: "Foundations needed before squad work starts.",
    categories: ["setup_missing", "availability_missing", "populate_needed"],
    icon: ClipboardList,
    variant: "neutral",
  },
  {
    key: "events",
    label: "Events",
    description: "Event setup, lineups, helpers, and reports.",
    categories: ["event_setup_missing", "event_squads_missing", "event_lineup_missing", "event_helpers_missing", "event_report_needed", "event_report_incomplete"],
    icon: CalendarDays,
    variant: "info",
  },
  {
    key: "reviews",
    label: "Reviews",
    description: "Pending review requests and changes requested.",
    categories: ["review_assigned", "review_changes_requested"],
    icon: Eye,
    variant: "warning",
  },
  {
    key: "reports",
    label: "Post-match reports",
    description: "Matches still missing a completed report.",
    categories: ["post_match_report", "planned_rotation_delayed"],
    icon: CalendarRange,
    variant: "info",
  },
];

function isActionable(item: AssistantWorkItem): boolean {
  return item.category !== "upcoming_round";
}

/** Groups whose categories are excluded from `assistantWorkItemsToCandidates()` (a richer
 * per-signal provider covers the same underlying problem instead — see today/page.tsx). Their
 * items have no corresponding situational decision to look up, so situational annotation must
 * not attempt to map them and must never mark a Blocked/Decision-required item as deferred —
 * AGENTS.md requires those to always remain prominent, never de-emphasized. */
const GROUPS_WITHOUT_CANDIDATE_MAPPING: ReadonlySet<GroupKey> = new Set(["blockers", "decisions"]);

/**
 * Work item ids whose corresponding situational decision was NOT promoted/normal-visibility in
 * the current projection (i.e. the situation policy deferred or suppressed it) — used to
 * annotate, never hide, grouped-section rows (docs/domain/situational-decision-support.md:
 * "Today's grouped sections and metric tiles are not yet situationally filtered"). Items in
 * `GROUPS_WITHOUT_CANDIDATE_MAPPING` are never included here since they have no candidate to
 * compare against.
 */
function computeDeferredWorkItemIds(
  actionable: AssistantWorkItem[],
  projection: CoachSituationProjection | undefined,
): Set<string> {
  if (!projection) return new Set();
  const promotedIds = new Set(
    projection.decisions
      .map((d) => workItemIdFromCandidateId(d.candidateId))
      .filter((id): id is string => id != null),
  );
  const deferred = new Set<string>();
  for (const item of actionable) {
    if (GROUPS_WITHOUT_CANDIDATE_MAPPING.has(groupForCategory(item.category)?.key as GroupKey)) continue;
    if (!promotedIds.has(item.id)) deferred.add(item.id);
  }
  return deferred;
}

/**
 * The hero "Next action" is chosen by the situational projection's ordering — not raw
 * `CATEGORY_PRIORITY` array order (ADR-0107, SDS-018) — whenever a projection is available and
 * has at least one decision. `CATEGORY_PRIORITY` remains in `items`' own order for the grouped
 * sections below (grouping/diagnostics use per docs/domain/situational-decision-support.md), but
 * no longer controls which single item is the primary next action.
 */
function resolveNextAction(
  actionable: AssistantWorkItem[],
  projection: CoachSituationProjection | undefined,
): AssistantWorkItem | undefined {
  // No projection was ever built (e.g. a caller that doesn't wire up the situational layer) --
  // fall back to raw category-priority order. This is a graceful-degradation path, distinct from
  // the case below.
  if (!projection) return actionable[0];

  const topDecision = projection.decisions[0];
  if (!topDecision) {
    // The situation policy evaluated every actionable item's candidate and produced zero
    // decisions to feature -- respect that conclusion rather than silently reverting to raw
    // category-priority order, which would defeat the entire point of situational ordering
    // (SDS-018). This is safe: a Blocked/Decision-required item can never reach this branch,
    // because its plan-integrity candidate always carries a hard consequence
    // (SQUAD_DEGRADED/PLANNING_BLOCKED), and matchboard_situation.rego's `hard_consequences` set
    // is structurally exempt from SUPPRESS -- so `decisions` is only empty here when every
    // actionable item was a soft, non-hard-consequence signal the policy legitimately decided not
    // to feature. Those items remain fully visible below in the grouped sections, which are never
    // filtered by the projection -- nothing is hidden, only not force-featured as the hero.
    return undefined;
  }

  const workItemId = workItemIdFromCandidateId(topDecision.candidateId);
  const matched = workItemId ? actionable.find((item) => item.id === workItemId) : undefined;
  return matched ?? actionable[0];
}

/**
 * Copy for the hero's empty state, distinguished by `projection.status` (SDS-019: "explicit ready
 * state") -- a coach mid-live-match sees different, situationally-appropriate wording from a
 * coach with a genuinely quiet day, instead of the same generic "Nothing urgent" message either
 * way. `REVIEW_AVAILABLE` cannot reach the empty state (it requires at least one decision, per
 * `computeStatus()`) and `ACTION_REQUIRED` never reaches it either (it implies a promoted
 * decision, which becomes the hero) -- only `LIVE` and `READY` (or no projection at all) are
 * actually reachable here, so those are the only two cases distinguished.
 */
function readyStateCopy(status: CoachSituationProjectionStatus | undefined): {
  title: string;
  description: string;
} {
  if (status === "LIVE") {
    return {
      title: "Nothing else needs attention while today's match is live.",
      description: "Follow along above, or open Fixtures to plan ahead.",
    };
  }
  return {
    title: "Nothing urgent right now.",
    description: "Upcoming rounds are under control. Open Fixtures to plan ahead.",
  };
}


/**
 * `status === "REVIEW_AVAILABLE"` means the featured item is worth a look but nothing is
 * urgent/blocking (no PROMOTE decision, no active match) -- SDS-019's remaining distinction
 * beyond the LIVE/READY empty-state copy (see readyStateCopy()). Framing it as "Worth reviewing"
 * rather than "Next action" avoids implying urgency that doesn't exist, per this file's own
 * "No red/amber unless actual blocker/decision exists" rule -- the pill's colour/variant is
 * untouched (still derived from the item's own category), only the label text changes.
 */
function heroPillLabel(status: CoachSituationProjectionStatus | undefined): string {
  return status === "REVIEW_AVAILABLE" ? "Worth reviewing" : "Next action";
}

function NextActionCard({
  item,
  status,
}: {
  item: AssistantWorkItem;
  status: CoachSituationProjectionStatus | undefined;
}) {
  const config = groupForCategory(item.category);
  return (
    <TacticalSurface variant="hero" padding="lg" pitch className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <StatusPill
          variant={config?.variant ?? "neutral"}
          icon={config?.icon}
          size="md"
        >
          {heroPillLabel(status)}
        </StatusPill>
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {config?.label ?? "Action"}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold text-zinc-50">{item.title}</h2>
        {item.summary && (
          <p className="text-sm text-[var(--text-soft)] leading-snug">{item.summary}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <ItemCounts item={item} />
        <Button
          as={Link}
          href={item.primaryActionHref}
          variant="primary"
          trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          {item.primaryActionLabel}
        </Button>
      </div>
    </TacticalSurface>
  );
}

function ItemCounts({ item }: { item: AssistantWorkItem }) {
  const counts = [
    item.blockedCount && item.blockedCount > 0
      ? { value: item.blockedCount, label: "blocked", variant: "danger" as const }
      : null,
    item.decisionRequiredCount && item.decisionRequiredCount > 0
      ? { value: item.decisionRequiredCount, label: "decisions", variant: "warning" as const }
      : null,
  ].filter((x): x is { value: number; label: string; variant: "danger" | "warning" } => x !== null);

  if (counts.length === 0) return <div />;

  return (
    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
      {counts.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          <span
            className={`tabular-nums font-semibold ${c.variant === "danger" ? "text-[var(--danger)]" : "text-[var(--warning)]"}`}
          >
            {c.value}
          </span>
          <span>{c.label}</span>
        </span>
      ))}
    </div>
  );
}

function groupForCategory(category: WorkCategory): GroupConfig | undefined {
  return groups.find((g) => g.categories.includes(category));
}

/**
 * Matchday mobile decision-first surface (ADR-0107, Phase 5,
 * docs/domain/situational-decision-support.md). Renders only when the situational projection has
 * inferred MATCHDAY — a relevant match is live or imminent. Additive: it sits above the existing
 * hero/grouped content, which is unchanged, and never replaces the live reporter — "Follow live"/
 * "Open match" both route to the existing match pages; no new mutation logic is introduced here.
 *
 * Deliberately compact for a phone viewport per the programme's mobile rules: minimal text before
 * the one primary action, a single large touch target, no information that requires hover.
 */
function MatchdayContextBanner({
  projection,
  todayMatches,
  orgUrl,
}: {
  projection: CoachSituationProjection;
  todayMatches: TodayMatch[];
  orgUrl: (path: string) => string;
}) {
  const { situation } = projection;
  if (situation.primarySituation !== "MATCHDAY") return null;

  const relevantMatchId = situation.activeMatchId ?? situation.imminentMatchIds[0];
  const match = todayMatches.find((m) => m.matchId === relevantMatchId);
  if (!match) return null;

  const isLive = match.hasActiveLiveSession;
  const minutesToKickoff =
    !isLive && match.startsAt
      ? Math.round((new Date(match.startsAt).getTime() - Date.now()) / 60_000)
      : null;

  const statusLabel = isLive
    ? "Live now"
    : minutesToKickoff != null && minutesToKickoff >= 0
      ? minutesToKickoff <= 1
        ? "Kicking off now"
        : `Kicks off in ${minutesToKickoff} min`
      : "Matchday";

  return (
    <TacticalSurface
      variant="hero"
      padding="md"
      pitch
      className="flex items-center justify-between gap-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <StatusPill variant={isLive ? "danger" : "warning"} icon={isLive ? Radio : Timer} size="sm">
          {statusLabel}
        </StatusPill>
        <span className="min-w-0 truncate text-sm font-semibold text-zinc-50">
          {match.teamName} {match.homeAway === "HOME" ? "vs" : "@"} {match.opponent}
        </span>
      </div>
      <Button
        as={Link}
        href={orgUrl(isLive ? `/matches/${match.matchId}/live` : `/matches/${match.matchId}`)}
        variant="primary"
        size="sm"
        trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
      >
        {isLive ? "Follow live" : "Open match"}
      </Button>
    </TacticalSurface>
  );
}

/**
 * Next-round readiness summary (ADR-0107, Phase 6, docs/domain/situational-decision-support.md).
 * Renders only in the NEXT situation. Sits above the Round Board, never replaces it — every row
 * only deep-links to the existing `/rounds/{id}` workspace; no inline mutation is offered from
 * here (the bundle only requires this for genuinely simple decisions once a safe command boundary
 * exists — not yet true for finalize/override-reason flows, so this stays read-only navigation).
 * Reuses `roundPlanIntegrities` — already computed by `getAssistantCommandCentre()` — rather than
 * recomputing readiness.
 */
function NextRoundReadinessSection({
  situation,
  roundPlanIntegrities,
  todayMatches,
  orgUrl,
}: {
  situation: SituationContext;
  roundPlanIntegrities: AssistantCommandCentre["roundPlanIntegrities"];
  todayMatches: TodayMatch[];
  orgUrl: (path: string) => string;
}) {
  if (situation.primarySituation !== "NEXT") return null;

  const roundsNeedingAttention = Object.values(roundPlanIntegrities).filter(
    (integrity) => integrity.summary.blockerCount > 0 || integrity.summary.decisionRequiredCount > 0,
  );
  if (roundsNeedingAttention.length === 0) return null;

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader
        title="Next round"
        description="Readiness before opening the full Round Board."
        eyebrow={`${roundsNeedingAttention.length} round${roundsNeedingAttention.length === 1 ? "" : "s"}`}
      />
      <ul className="flex flex-col">
        {roundsNeedingAttention.map((integrity) => {
          const roundName =
            todayMatches.find((m) => m.matchRoundId === integrity.matchRoundId)?.matchRoundName ??
            "Round readiness";
          const parts = [
            integrity.summary.blockerCount > 0 ? `${integrity.summary.blockerCount} blocked` : null,
            integrity.summary.decisionRequiredCount > 0
              ? `${integrity.summary.decisionRequiredCount} decision${integrity.summary.decisionRequiredCount === 1 ? "" : "s"} required`
              : null,
          ].filter(Boolean);

          return (
            <li
              key={integrity.matchRoundId}
              className="flex items-center justify-between gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-[var(--surface-muted)]/30 transition-colors"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-zinc-100 truncate">{roundName}</span>
                <span className="text-xs text-[var(--text-muted)]">{parts.join(" · ")}</span>
              </div>
              <Button
                as={Link}
                href={orgUrl(`/rounds/${integrity.matchRoundId}`)}
                variant="secondary"
                size="sm"
                trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
              >
                Open Round Board
              </Button>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}

function WorkRow({
  item,
  dim = false,
  deferred = false,
}: {
  item: AssistantWorkItem;
  dim?: boolean;
  /** True when the situational projection deferred this item's decision (still shown in full —
   * never hidden — just annotated as lower priority given the coach's current situation). */
  deferred?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-[var(--surface-muted)]/30 transition-colors">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={`text-sm font-medium ${dim ? "text-[var(--text-muted)]" : "text-zinc-100"} truncate`}
        >
          {item.title}
        </span>
        {item.summary && (
          <span className="text-xs text-[var(--text-muted)] line-clamp-1">
            {item.summary}
          </span>
        )}
        {deferred && (
          <span className="text-[11px] text-[var(--text-muted)] italic">
            Lower priority right now
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <ItemCounts item={item} />
        <Button
          as={Link}
          href={item.primaryActionHref}
          variant="ghost"
          size="sm"
          trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
        >
          {item.primaryActionLabel}
        </Button>
      </div>
    </li>
  );
}

/** Stable sort placing deferred items after non-deferred ones -- never drops or duplicates an
 * item, only reorders within the group it was already going to render in. An empty `deferredIds`
 * (no projection, or nothing deferred) leaves order unchanged. */
function sortByDeferred(items: AssistantWorkItem[], deferredIds: Set<string>): AssistantWorkItem[] {
  if (deferredIds.size === 0) return items;
  return [...items].sort((a, b) => Number(deferredIds.has(a.id)) - Number(deferredIds.has(b.id)));
}

function GroupedReports({
  items,
  deferredIds,
}: {
  items: AssistantWorkItem[];
  deferredIds: Set<string>;
}) {
  const byRound = new Map<string, AssistantWorkItem[]>();
  for (const item of items) {
    const key = item.matchRoundId ?? "_";
    const list = byRound.get(key) ?? [];
    list.push(item);
    byRound.set(key, list);
  }

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader
        title="Post-match reports"
        description={`${items.length} report${items.length === 1 ? "" : "s"} still need completing.`}
        eyebrow={`${byRound.size} round${byRound.size === 1 ? "" : "s"}`}
      />
      <ul className="flex flex-col">
        {sortByDeferred(items, deferredIds).map((item) => (
          <WorkRow key={item.id} item={item} deferred={deferredIds.has(item.id)} />
        ))}
      </ul>
    </Surface>
  );
}

function TodayMatchRow({ match, orgUrl }: { match: TodayMatch; orgUrl: (path: string) => string }) {
  const homeAway = match.homeAway === "HOME" ? "vs" : "@";
  const timeStr = match.startsAt
    ? formatKickoffTime(new Date(match.startsAt))
    : "";
  const squadHref = match.squadStatus === "not_generated"
    ? orgUrl(`/fixtures`)
    : orgUrl(`/matches/${match.matchId}`);
  const needsReport = match.lifecycleStatus === "played" || match.lifecycleStatus === "report_incomplete";

  return (
    <li className="flex items-center justify-between gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-[var(--surface-muted)]/30 transition-colors">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-zinc-100 truncate">
          {match.teamName} {homeAway} {match.opponent}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          {match.matchRoundName}
          {timeStr ? ` · ${timeStr}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <MatchLifecycleBadge status={match.lifecycleStatus} size="sm" />
        <Button as={Link} href={squadHref} variant="ghost" size="sm">
          View
        </Button>
        {match.hasActiveLiveSession && (
          <Button as={Link} href={orgUrl(`/matches/${match.matchId}/live`)} variant="primary" size="sm">
            Follow live
          </Button>
        )}
        {needsReport && !match.hasActiveLiveSession && (
          <Button as={Link} href={orgUrl(`/matches/${match.matchId}`)} variant="ghost" size="sm" trailingIcon={<FileText className="h-3 w-3" aria-hidden="true" />}>
            Report
          </Button>
        )}
      </div>
    </li>
  );
}

function TodayMatchesSection({ matches, orgUrl }: { matches: TodayMatch[]; orgUrl: (path: string) => string }) {
  if (matches.length === 0) return null;

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader
        title="Today's matches"
        description={`${matches.length} match${matches.length === 1 ? "" : "es"} today.`}
        eyebrow={`${matches.filter((m) => m.hasActiveLiveSession).length} live`}
        actions={
          <StatusPill variant="info" size="sm" icon={CalendarDays}>
            {matches.length}
          </StatusPill>
        }
      />
      <ul className="flex flex-col">
        {matches.map((match) => (
          <TodayMatchRow key={match.matchId} match={match} orgUrl={orgUrl} />
        ))}
      </ul>
    </Surface>
  );
}

function StandardGroup({
  group,
  items,
  deferredIds,
}: {
  group: GroupConfig;
  items: AssistantWorkItem[];
  deferredIds: Set<string>;
}) {
  const Icon = group.icon;
  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader
        title={group.label}
        description={group.description}
        eyebrow={`${items.length} item${items.length === 1 ? "" : "s"}`}
        actions={
          <StatusPill variant={group.variant} size="sm" icon={Icon}>
            {items.length}
          </StatusPill>
        }
      />
      {/* Issue markers for blocked/decision groups */}
      {(group.key === "blockers" || group.key === "decisions") && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <IssueMarker
              key={item.id}
              type={group.key === "blockers" ? "blocked" : "decision"}
              label={item.title}
              count={group.key === "blockers" ? item.blockedCount : item.decisionRequiredCount}
            />
          ))}
        </div>
      )}
      <ul className="flex flex-col">
        {sortByDeferred(items, deferredIds).map((item) => (
          <WorkRow key={item.id} item={item} deferred={deferredIds.has(item.id)} />
        ))}
      </ul>
    </Surface>
  );
}

export function AssistantCommandCentrePage({
  commandCentre,
  projection,
  weeklyContext,
}: {
  commandCentre: AssistantCommandCentre;
  /** Situational projection (ADR-0107, docs/domain/situational-decision-support.md). When
   * provided, it — not raw category order — determines which item is featured as the hero "Next
   * action". Optional so the component remains usable without a full projection (e.g. tests). */
  projection?: CoachSituationProjection;
  /** Weekly Coaching Context (ADR-0108, docs/domain/weekly-coaching-context.md). Optional so the
   * component remains usable without it (e.g. tests, or a caller with no projection at all —
   * the section also needs `projection.situation.primarySituation` to know how to present). */
  weeklyContext?: WeeklyCoachingContextResult;
}) {
  const orgUrl = useOrgUrl();
  const { items, leagueSeasonName } = commandCentre;
  const actionable = items.filter(isActionable);
  const upcoming = items.filter((i) => i.category === "upcoming_round");
  const nextAction = resolveNextAction(actionable, projection);
  const deferredWorkItemIds = computeDeferredWorkItemIds(actionable, projection);
  const readyState = readyStateCopy(projection?.status);

  // Metric aggregates
  const blockedCount = actionable.reduce((sum, i) => sum + (i.blockedCount ?? 0), 0);
  const decisionCount = actionable.reduce((sum, i) => sum + (i.decisionRequiredCount ?? 0), 0);
  const reviewCount = actionable.filter((i) => i.category === "review_assigned" || i.category === "review_changes_requested").length;
  const reportCount = actionable.filter((i) => i.category === "post_match_report").length;
  const upcomingCount = upcoming.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <PageHeader
            title="Today"
            description="What needs attention before the next matches."
            context={leagueSeasonName ? <span>{leagueSeasonName}</span> : null}
          />
        </div>
        {actionable.length > 0 && (
          <BrandIllustration
            name="matchdayPrepSketch"
            decorative
            className="hidden expanded:block h-16 large:h-20 w-auto opacity-60 dark:opacity-50 shrink-0"
          />
        )}
      </div>

      {projection && (
        <MatchdayContextBanner projection={projection} todayMatches={commandCentre.todayMatches} orgUrl={orgUrl} />
      )}

      {projection && (
        <NextRoundReadinessSection
          situation={projection.situation}
          roundPlanIntegrities={commandCentre.roundPlanIntegrities}
          todayMatches={commandCentre.todayMatches}
          orgUrl={orgUrl}
        />
      )}

      {projection && (
        <WeeklyCoachingContextSection
          result={weeklyContext ?? null}
          primarySituation={projection.situation.primarySituation}
        />
      )}

      <InstallPwaCard dismissible />

      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 medium:grid-cols-3 expanded:grid-cols-5">
        <MetricTile
          label="Blocked"
          value={blockedCount}
          tone={blockedCount > 0 ? "danger" : "neutral"}
          icon={<OctagonAlert className="h-4 w-4" />}
        />
        <MetricTile
          label="Decisions"
          value={decisionCount}
          tone={decisionCount > 0 ? "warning" : "neutral"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <MetricTile
          label="Reviews"
          value={reviewCount}
          tone={reviewCount > 0 ? "warning" : "neutral"}
          icon={<Eye className="h-4 w-4" />}
        />
        <MetricTile
          label="Reports"
          value={reportCount}
          tone={reportCount > 0 ? "info" : "neutral"}
          icon={<CalendarRange className="h-4 w-4" />}
        />
        <MetricTile
          label="Upcoming"
          value={upcomingCount}
          tone="neutral"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>

      {/* Next action hero */}
      {nextAction ? (
        <NextActionCard item={nextAction} status={projection?.status} />
      ) : (
        <EmptyState
          tone="info"
          title={readyState.title}
          description={readyState.description}
          illustration="matchdayPrepSketch"
          action={
            <Button
              as={Link}
              href={orgUrl("/fixtures")}
              variant="primary"
              trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Open Fixtures
            </Button>
          }
        />
      )}

      {/* Today's matches */}
      <TodayMatchesSection matches={commandCentre.todayMatches} orgUrl={orgUrl} />

      {/* Review/attention link */}
      {reviewCount > 0 && (
        <div className="flex items-center justify-end">
          <Button
            as={Link}
            href={orgUrl("/reviews")}
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
          >
            View all reviews
          </Button>
        </div>
      )}

      {/* Grouped work sections */}
      {groups.map((group) => {
        const groupItems = actionable.filter((i) =>
          group.categories.includes(i.category),
        );
        const filtered = groupItems.filter((i) => i.id !== nextAction?.id);
        if (filtered.length === 0) return null;
        if (group.key === "reports") {
          return <GroupedReports key={group.key} items={filtered} deferredIds={deferredWorkItemIds} />;
        }
        return <StandardGroup key={group.key} group={group} items={filtered} deferredIds={deferredWorkItemIds} />;
      })}

      {upcoming.length > 0 && (
        <Surface padding="md" className="flex flex-col gap-3">
          <SectionHeader
            title="Upcoming"
            description="Rounds in the planning horizon — no action needed yet."
            eyebrow={`${upcoming.length} round${upcoming.length === 1 ? "" : "s"}`}
          />
          <ul className="flex flex-col">
            {upcoming.map((item) => (
              <WorkRow key={item.id} item={item} dim />
            ))}
          </ul>
        </Surface>
      )}
    </div>
  );
}