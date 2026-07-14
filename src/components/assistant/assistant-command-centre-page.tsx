import Link from "next/link";
import type { AssistantCommandCentre, AssistantWorkItem } from "@/lib/assistant/types";
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
import {
  OctagonAlert,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  CalendarRange,
  CalendarDays,
  ArrowRight,
  ShieldAlert,
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

type GroupKey = "blockers" | "decisions" | "setup" | "events" | "ready" | "reports";

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
    description: "Hard problems preventing finalize.",
    categories: ["blocked_round"],
    icon: OctagonAlert,
    variant: "danger",
  },
  {
    key: "decisions",
    label: "Decisions",
    description: "Coach judgement required before finalize.",
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
    categories: ["event_setup_missing", "event_squads_missing", "event_squads_draft_review", "event_lineup_missing", "event_helpers_missing", "event_report_needed", "event_report_incomplete"],
    icon: CalendarDays,
    variant: "info",
  },
  {
    key: "ready",
    label: "Ready to finalize",
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
  const { items, leagueSeasonName } = commandCentre;
  const actionable = items.filter(isActionable);
  const upcoming = items.filter((i) => i.category === "upcoming_round");
  const nextAction = actionable[0];

  // Metric aggregates
  const blockedCount = actionable.reduce((sum, i) => sum + (i.blockedCount ?? 0), 0);
  const decisionCount = actionable.reduce((sum, i) => sum + (i.decisionRequiredCount ?? 0), 0);
  const reportCount = actionable.filter((i) => i.category === "post_match_report").length;
  const upcomingCount = upcoming.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <PageHeader
            title="Assistant"
            description="What needs attention before the next matches."
            context={leagueSeasonName ? <span>{leagueSeasonName}</span> : null}
          />
        </div>
        {actionable.length > 0 && (
          <BrandIllustration
            name="matchdayPrepSketch"
            decorative
            className="hidden md:block h-16 lg:h-20 w-auto opacity-60 dark:opacity-50 shrink-0"
          />
        )}
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              href="/fixtures"
              variant="primary"
              trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Open Fixtures
            </Button>
          }
        />
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