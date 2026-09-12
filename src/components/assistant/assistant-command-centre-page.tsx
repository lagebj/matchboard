"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { formatKickoffTime } from "@/lib/date-utils";
import type { AssistantCommandCentre, AssistantWorkItem, TodayMatch } from "@/lib/assistant/types";
import { todayMatchPresentation, resolveFeaturedUpcomingMatch } from "@/lib/matches/today-match-presentation";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import {
  TouchlinePageHeader,
  TouchlineButton,
  ScorebookMatchRow,
  TouchlineTimeline as OperationalTimeline,
  TimelineItem,
} from "@/components/touchline";
import {
  NextMatchHero,
  SquadReadinessWidget,
  RecentFootballWidget,
} from "@/components/touchline/widgets";
import type { TodaySquadStatus } from "@/lib/touchline/presentation/today-view-model";
import type { TimelineNodeState } from "@/components/touchline/timeline/touchline-timeline";
import type {
  CoachSituationProjection,
  CoachSituationProjectionStatus,
  SituationContext,
} from "@/lib/situational/situation-types";
import type { WeeklyCoachingContextResult } from "@/lib/weekly/weekly-coaching-context-types";
import { WeeklyCoachingContextSection } from "@/components/assistant/weekly-coaching-context-section";
import { DueDecisionReviewSection } from "@/components/assistant/due-decision-review-section";
import { workItemIdFromCandidateId } from "@/lib/situational/providers/assistant-candidate-provider";
import { SectionHeader } from "@/components/ui/section-header";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { MetricTile } from "@/components/ui/metric-tile";
import { IssueMarker } from "@/components/ui/issue-marker";
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
  Timer,
} from "lucide-react";

/**
 * AssistantCommandCentrePage — the Today operational surface, Touchline
 * editorial + temporal grammar (ADR-0134 §7, bundle
 * `07_TEMPORAL_AND_EVENT_GRAMMAR.md §11`).
 *
 * Order: editorial page header → matchday now-anchor → the dominant Next Action
 * object → the chronological `OperationalTimeline` of today's football →
 * next-round readiness + grouped work → the "At a glance" tile row (a
 * deliberate unfiltered summary, kept below the operational flow) → weekly
 * context → upcoming. No pitch-line texture, no decorative sketch, no metric
 * grid ahead of the flow. Red/amber only for a real blocker/decision.
 *
 * All work-item derivation, the situational projection wiring, grouping, and
 * every link/action are unchanged — this is a presentation migration only
 * (`17_FUNCTIONAL_FREEZE.md`). Rendered inside a theme-aware (no longer dark-pinned) `.touchline`
 * island during the phased rollout.
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
    label: "Peer reviews",
    description: "Pending peer review requests and changes requested.",
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
    <div className="flex flex-col gap-4 rounded-[var(--tl-c-radius-feature)] border border-[var(--border-strong)] bg-[var(--tl-c-surface-strong)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          {heroPillLabel(status)}
        </p>
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {config?.label ?? "Action"}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[20px] font-[620] leading-snug text-[var(--foreground)]">{item.title}</h2>
        {item.summary && (
          <p className="text-[13px] leading-snug text-[var(--text-soft)]">{item.summary}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <ItemCounts item={item} />
        <TouchlineButton
          as={Link}
          href={item.primaryActionHref}
          variant="primary"
          trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          {item.primaryActionLabel}
        </TouchlineButton>
      </div>
    </div>
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
    <div className="flex items-center justify-between gap-3 rounded-[var(--tl-c-radius-object)] border border-[var(--border-strong)] bg-[var(--tl-c-surface-strong)] px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
            isLive ? "text-[var(--tl-c-live)]" : "text-[var(--accent)]"
          }`}
        >
          {isLive ? (
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--tl-c-live)]" aria-hidden="true" />
          ) : (
            <Timer className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {statusLabel}
        </span>
        <span className="min-w-0 truncate text-[14px] font-[600] text-[var(--foreground)]">
          {match.teamName} {match.homeAway === "HOME" ? "vs" : "@"} {match.opponent}
        </span>
      </div>
      <TouchlineButton
        as={Link}
        href={orgUrl(isLive ? `/matches/${match.matchId}/live/follow` : `/matches/${match.matchId}`)}
        variant="primary"
        size="sm"
        trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
      >
        {isLive ? "Follow live" : "Open match"}
      </TouchlineButton>
    </div>
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
                <span className="text-sm font-medium text-[var(--foreground)] truncate">{roundName}</span>
                <span className="text-xs text-[var(--text-muted)]">{parts.join(" · ")}</span>
              </div>
              <TouchlineButton
                as={Link}
                href={orgUrl(`/rounds/${integrity.matchRoundId}`)}
                variant="secondary"
                size="sm"
                trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
              >
                Open Round Board
              </TouchlineButton>
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
          className={`text-sm font-medium ${dim ? "text-[var(--text-muted)]" : "text-[var(--foreground)]"} truncate`}
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
        <TouchlineButton
          as={Link}
          href={item.primaryActionHref}
          variant="ghost"
          size="sm"
          trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
        >
          {item.primaryActionLabel}
        </TouchlineButton>
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

/**
 * Today's operational timeline (ADR-0125). One chronological rail: today's
 * matches as `MatchRow` items with now/next/later treatment. A match that
 * has been played but still needs its report becomes an `attention` node with an
 * inline "Complete report" action — it is never quietened while the follow-up is
 * open. Reports for older matches stay in the grouped "Post-match reports"
 * section rather than being duplicated here.
 */
function TodayOperationalTimeline({
  matches,
  orgUrl,
}: {
  matches: TodayMatch[];
  orgUrl: (path: string) => string;
}) {
  const sorted = [...matches].sort((a, b) => {
    const av = a.startsAt ? Date.parse(a.startsAt) : Number.MAX_SAFE_INTEGER;
    const bv = b.startsAt ? Date.parse(b.startsAt) : Number.MAX_SAFE_INTEGER;
    return av - bv;
  });

  if (sorted.length === 0) return null;

  // First still-upcoming (not live, not played) match is NEXT; the rest LATER. Same selection
  // the Today Atlas hero features (`resolveFeaturedUpcomingMatch()`).
  const firstUpcomingId = resolveFeaturedUpcomingMatch(matches)?.matchId;

  const liveCount = matches.filter((m) => m.hasActiveLiveSession).length;
  const rows: ReactNode[] = [];
  const lastIndex = sorted.length - 1;

  sorted.forEach((match, idx) => {
    const needsReport =
      match.lifecycleStatus === "played" || match.lifecycleStatus === "report_incomplete";
    const state: TimelineNodeState =
      match.lifecycleStatus === "live"
        ? "live"
        : needsReport
          ? "current"
          : match.lifecycleStatus === "done"
            ? "done"
            : match.matchId === firstUpcomingId
              ? "next"
              : "later";
    const kicker =
      state === "live"
        ? "LIVE"
        : needsReport
          ? "FOLLOW-UP"
          : state === "next"
            ? "NEXT"
            : state === "done"
              ? null
              : "LATER";
    const href =
      match.squadStatus === "not_generated"
        ? orgUrl(`/fixtures`)
        : orgUrl(`/matches/${match.matchId}`);

    rows.push(
      <TimelineItem
        key={match.matchId}
        timeLabel={match.startsAt ? formatKickoffTime(new Date(match.startsAt)) : null}
        state={state}
        kicker={kicker}
        isLast={idx === lastIndex}
      >
        <ScorebookMatchRow presentation={todayMatchPresentation(match, href)} />
        {match.hasActiveLiveSession ? (
          <TouchlineButton
            as={Link}
            href={orgUrl(`/matches/${match.matchId}/live/follow`)}
            variant="primary"
            size="sm"
            className="mt-1"
          >
            Follow live
          </TouchlineButton>
        ) : needsReport ? (
          <TouchlineButton
            as={Link}
            href={orgUrl(`/matches/${match.matchId}`)}
            variant="ghost"
            size="sm"
            className="mt-1"
            trailingIcon={<FileText className="h-3 w-3" aria-hidden="true" />}
          >
            Complete report
          </TouchlineButton>
        ) : null}
      </TimelineItem>,
    );
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-[620] text-[var(--foreground)]">Matchday</h2>
          <p className="text-[13px] text-[var(--text-muted)]">Today&rsquo;s football, in order.</p>
        </div>
        <span className="text-[12px] text-[var(--text-muted)]">
          {liveCount > 0 ? `${liveCount} live · ` : ""}
          {matches.length} {matches.length === 1 ? "match" : "matches"}
        </span>
      </div>
      <OperationalTimeline aria-label="Today's operational timeline">{rows}</OperationalTimeline>
    </section>
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
  recentMatches,
  squadStatus,
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
  /** Touchline Design Atlas additions (ADR-0136, `docs/domain/touchline-atlas-provenance.md`) —
   * genuinely new content the previous page never showed, not a replacement for anything above.
   * All optional so the component remains usable without them (e.g. existing tests). No
   * `evidenceSpotlight` prop — that addition was deliberately dropped before shipping; see
   * `today/page.tsx`'s own comment and `docs/domain/touchline-atlas-provenance.md` §14. */
  recentMatches?: MatchPresentation[];
  squadStatus?: TodaySquadStatus | null;
}) {
  const orgUrl = useOrgUrl();
  const { items, leagueSeasonName } = commandCentre;
  const actionable = items.filter(isActionable);
  const upcoming = items.filter((i) => i.category === "upcoming_round");
  const nextAction = resolveNextAction(actionable, projection);
  const deferredWorkItemIds = computeDeferredWorkItemIds(actionable, projection);
  const readyState = readyStateCopy(projection?.status);
  // Touchline Design Atlas hero (ADR-0136): when there is no decision urgent enough to force-
  // feature (nextAction undefined), the upcoming match becomes the hero instead of a bare empty
  // state — the same match `TodayOperationalTimeline` marks NEXT, never a second, competing
  // selection. Still falls back to the plain empty state when there's genuinely no match either.
  const featuredMatch = !nextAction ? resolveFeaturedUpcomingMatch(commandCentre.todayMatches) : undefined;
  const featuredMatchHref = featuredMatch
    ? featuredMatch.squadStatus === "not_generated"
      ? orgUrl("/fixtures")
      : orgUrl(`/matches/${featuredMatch.matchId}`)
    : undefined;

  // Metric aggregates
  const blockedCount = actionable.reduce((sum, i) => sum + (i.blockedCount ?? 0), 0);
  const decisionCount = actionable.reduce((sum, i) => sum + (i.decisionRequiredCount ?? 0), 0);
  const reviewCount = actionable.filter((i) => i.category === "review_assigned" || i.category === "review_changes_requested").length;
  const reportCount = actionable.filter((i) => i.category === "post_match_report").length;
  const upcomingCount = upcoming.length;

  return (
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134).
    // Phase 10 hoists `.touchline` to the app shell and removes this wrapper.
    <div className="touchline flex flex-col gap-6">
      <TouchlinePageHeader
        title="Today"
        context={leagueSeasonName ?? "What needs attention before the next matches."}
      />

      {/*
       * Compact composition order (ADR-0124 §6 / ADR-0125 / adaptive-interaction-design.md §7):
       *   1. title/context (above)
       *   2. matchday "now" anchor
       *   3. dominant Next Action
       *   4. OperationalTimeline — today's matches on one chronological rail
       *   5. next-round readiness + grouped work
       *   6. objective totals (demoted below the operational flow — never leads the page)
       *   7. secondary coaching context (weekly)
       *   8. distant/upcoming
       *   9. non-operational (PWA install)
       */}

      {projection && (
        <MatchdayContextBanner projection={projection} todayMatches={commandCentre.todayMatches} orgUrl={orgUrl} />
      )}

      {/* Next action hero — dominant, before any detached metrics */}
      {nextAction ? (
        <NextActionCard item={nextAction} status={projection?.status} />
      ) : featuredMatch ? (
        <NextMatchHero
          presentation={todayMatchPresentation(featuredMatch, featuredMatchHref!)}
          contextLabel={leagueSeasonName ?? undefined}
          contextLine={featuredMatch.matchRoundName}
          primaryAction={
            <TouchlineButton
              as={Link}
              href={featuredMatchHref!}
              variant="primary"
              trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Match details
            </TouchlineButton>
          }
        />
      ) : (
        <EmptyState
          tone="info"
          title={readyState.title}
          description={readyState.description}
          illustration="matchdayPrepSketch"
          action={
            <TouchlineButton
              as={Link}
              href={orgUrl("/fixtures")}
              variant="primary"
              trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Open Fixtures
            </TouchlineButton>
          }
        />
      )}

      {/* Recent football + squad status — new Touchline Design Atlas content (ADR-0136), never
          shown when the data doesn't exist (no invented sample). Rendered here, unconditionally
          of which hero branch is active above — squad status is standing org-wide context, not
          only relevant when there's no other decision to feature (a real placement gap found
          and fixed while capturing verification screenshots: `nextAction` is the *more* common
          case for an active coach, so squad status previously almost never rendered). An
          evidence-spotlight companion was deliberately dropped before shipping — see this
          component's own prop doc comment above. */}
      {(recentMatches && recentMatches.length > 0) || squadStatus ? (
        <div className="grid grid-cols-1 gap-5 expanded:grid-cols-12">
          {recentMatches && recentMatches.length > 0 ? (
            <div className="expanded:col-span-7">
              <RecentFootballWidget matches={recentMatches} viewAllHref={orgUrl("/fixtures")} />
            </div>
          ) : null}
          {squadStatus ? (
            <div className="expanded:col-span-5">
              <SquadReadinessWidget
                available={squadStatus.available}
                doubtful={squadStatus.doubtful}
                unavailable={squadStatus.unavailable}
                exceptions={squadStatus.notAvailable}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Operational timeline — today's football in order, directly after Next Action */}
      <TodayOperationalTimeline matches={commandCentre.todayMatches} orgUrl={orgUrl} />

      {projection && (
        <NextRoundReadinessSection
          situation={projection.situation}
          roundPlanIntegrities={commandCentre.roundPlanIntegrities}
          todayMatches={commandCentre.todayMatches}
          orgUrl={orgUrl}
        />
      )}

      {/* Due Decision reviews — attention, after immediate live/matchday items (ADR-0132) */}
      <DueDecisionReviewSection reviews={commandCentre.dueDecisionReviews} />

      {/* Review/attention link */}
      {reviewCount > 0 && (
        <div className="flex items-center justify-end">
          <TouchlineButton
            as={Link}
            href={orgUrl("/reviews")}
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
          >
            View peer reviews
          </TouchlineButton>
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

      {/* Objective totals — a deliberate unfiltered summary (see situational-decision-support
          notes in AGENTS.md), demoted below the next action so it never leads the page. */}
      <div>
        <p className="mb-2 text-[var(--text-meta)] font-medium text-[var(--text-muted)]">At a glance</p>
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
            label="Peer reviews"
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
      </div>

      {projection && (
        <WeeklyCoachingContextSection
          result={weeklyContext ?? null}
          primarySituation={projection.situation.primarySituation}
        />
      )}

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

      <InstallPwaCard dismissible />
    </div>
  );
}