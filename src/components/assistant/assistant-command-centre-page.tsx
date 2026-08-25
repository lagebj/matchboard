"use client";

import Link from "next/link";
import type { AssistantCommandCentre, AssistantWorkItem, TodayMatch } from "@/lib/assistant/types";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Surface } from "@/components/ui/surface";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { MetricTile } from "@/components/ui/metric-tile";
import { IssueMarker } from "@/components/ui/issue-marker";
import { BrandIllustration } from "@/components/ui/brand-illustration";
import { InstallPwaCard } from "@/components/pwa/install-prompt-card";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import {
  OctagonAlert,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  CalendarRange,
  CalendarDays,
  ArrowRight,
  ShieldAlert,
  Eye,
  Radio,
  FileText,
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

type GroupKey = "blockers" | "decisions" | "setup" | "events" | "reviews" | "ready" | "reports";

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
    description: "Hard problems preventing finalise.",
    categories: ["blocked_round"],
    icon: OctagonAlert,
    variant: "danger",
  },
  {
    key: "decisions",
    label: "Decisions",
    description: "Coach judgement required before finalise.",
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
    categories: ["event_setup_missing", "event_squads_missing", "event_squads_draft", "event_lineup_missing", "event_helpers_missing", "event_report_needed", "event_report_incomplete"],
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
    key: "ready",
    label: "Ready to finalise",
    description: "Drafts that meet plan checks.",
    categories: ["ready_to_finalize"],
    icon: CheckCircle2,
    variant: "success",
  },
  {
    key: "reports",
    label: "Post-match reports",
    description: "Matches still missing a completed report.",
    categories: ["post_match_report"],
    icon: CalendarRange,
    variant: "info",
  },
];

function isActionable(item: AssistantWorkItem): boolean {
  return item.category !== "upcoming_round";
}


function NextActionCard({ item }: { item: AssistantWorkItem }) {
  const config = groupForCategory(item.category);
  return (
    <TacticalSurface variant="hero" padding="lg" pitch className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <StatusPill
          variant={config?.variant ?? "neutral"}
          icon={config?.icon}
          size="md"
        >
          Next action
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

function WorkRow({ item, dim = false }: { item: AssistantWorkItem; dim?: boolean }) {
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

function GroupedReports({ items }: { items: AssistantWorkItem[] }) {
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
        {items.map((item) => (
          <WorkRow key={item.id} item={item} />
        ))}
      </ul>
    </Surface>
  );
}

const SQUAD_STATUS_PILL: Record<string, { label: string; variant: "neutral" | "warning" | "danger" | "success" | "finalized" }> = {
  not_generated: { label: "Not generated", variant: "neutral" },
  draft: { label: "Draft", variant: "warning" },
  blocked: { label: "Blocked", variant: "danger" },
  ready: { label: "Ready", variant: "success" },
  finalized: { label: "Finalised", variant: "finalized" },
};

const REPORT_STATUS_LABEL: Record<string, string> = {
  none: "No report",
  draft: "Draft report",
  reported: "Reported",
  locked: "Complete",
};

function TodayMatchRow({ match, orgUrl }: { match: TodayMatch; orgUrl: (path: string) => string }) {
  const homeAway = match.homeAway === "HOME" ? "vs" : "@";
  const timeStr = match.startsAt
    ? new Date(match.startsAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "";
  const statusConfig = SQUAD_STATUS_PILL[match.squadStatus] ?? SQUAD_STATUS_PILL.not_generated;
  const squadHref = match.squadStatus === "not_generated"
    ? orgUrl(`/fixtures`)
    : orgUrl(`/matches/${match.matchId}`);

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
        {match.hasActiveLiveSession && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--success)]">
            <Radio className="h-3 w-3 animate-pulse" aria-hidden="true" />
            Live
          </span>
        )}
        <StatusPill variant={statusConfig.variant} size="sm">
          {statusConfig.label}
        </StatusPill>
        {match.reportStatus && match.reportStatus !== "none" && (
          <span className="text-[10px] text-[var(--text-muted)]">
            {REPORT_STATUS_LABEL[match.reportStatus] ?? match.reportStatus}
          </span>
        )}
        <Button as={Link} href={squadHref} variant="ghost" size="sm">
          View
        </Button>
        {match.hasActiveLiveSession && (
          <Button as={Link} href={orgUrl(`/matches/${match.matchId}/live`)} variant="primary" size="sm">
            Follow live
          </Button>
        )}
        {match.squadStatus === "finalized" && !match.hasActiveLiveSession && (
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
}: {
  group: GroupConfig;
  items: AssistantWorkItem[];
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
        {items.map((item) => (
          <WorkRow key={item.id} item={item} />
        ))}
      </ul>
    </Surface>
  );
}

export function AssistantCommandCentrePage({
  commandCentre,
}: {
  commandCentre: AssistantCommandCentre;
}) {
  const orgUrl = useOrgUrl();
  const { items, leagueSeasonName } = commandCentre;
  const actionable = items.filter(isActionable);
  const upcoming = items.filter((i) => i.category === "upcoming_round");
  const nextAction = actionable[0];

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
        <NextActionCard item={nextAction} />
      ) : (
        <EmptyState
          tone="info"
          title="Nothing urgent right now."
          description="Upcoming rounds are under control. Open Fixtures to plan ahead."
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
          return <GroupedReports key={group.key} items={filtered} />;
        }
        return <StandardGroup key={group.key} group={group} items={filtered} />;
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