"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarRange,
  Eye,
  GitCompare,
  ShieldAlert,
  Table2,
  ListChecks,
  TrendingDown,
  Repeat,
  Users2,
  Shuffle,
  Activity,
  Clock,
  Route,
  type LucideIcon,
} from "lucide-react";
import type { InsightOverview } from "@/lib/insights/insights-types";
import {
  INSIGHT_CARDS,
  groupInsightCards,
  getGroupSpotlightValue,
  type InsightCardMeta,
} from "@/lib/insights/get-insights-hub-groups";
import { EvidenceSpotlightWidget } from "@/components/touchline/widgets";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type InsightsOverviewClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
};

type OverviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: InsightOverview }
  | { status: "error"; message: string };

/**
 * Icon per card id — kept here (not in the pure `get-insights-hub-groups.ts` module) since a
 * lucide component isn't plain data. Card label/description/href/grouping are the single source
 * of truth in that module; this is presentation-only.
 */
const CARD_ICONS: Record<string, LucideIcon> = {
  opportunity: Table2,
  "opportunity-quality": ListChecks,
  "opportunity-gap": TrendingDown,
  load: BarChart3,
  coverage: ShieldAlert,
  "position-exposure": Repeat,
  "player-pathways": Route,
  continuity: Shuffle,
  "match-phase-patterns": Clock,
  "player-combinations": Users2,
  "planned-vs-actual": GitCompare,
  "policy-warnings": Eye,
  conflicts: CalendarRange,
  "operational-health": Activity,
};

function isNumericOverview(data: unknown): data is InsightOverview {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  const numericFields: (keyof InsightOverview)[] = [
    "totalPlayers",
    "playersWithNoOpportunity",
    "playersWithHighLoad",
    "matchesWithMissingReports",
    "matchesWithCoverageWarnings",
    "policyWarningsCount",
    "plannedActualDeltasCount",
    "conflictsCount",
  ];
  return numericFields.every((field) => typeof obj[field] === "number" && Number.isFinite(obj[field] as number));
}

export function InsightsOverviewClient({
  leagueSeasons,
  activeLeagueSeasonId,
}: InsightsOverviewClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [overviewState, setOverviewState] = useState<OverviewState>({ status: "idle" });
  const [retryKey, setRetryKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!selectedPeriodId) return;

    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    const loadOverview = async () => {
      setOverviewState({ status: "loading" });

      try {
        const res = await fetch(
          `/api/insights/overview?leagueSeasonId=${selectedPeriodId}`,
          { signal: controller.signal },
        );

        if (cancelled) return;

        if (res.status === 401) {
          setOverviewState({ status: "error", message: "You are not authorized to view insights." });
          return;
        }

        if (!res.ok) {
          setOverviewState({ status: "error", message: "Failed to load insights overview. Try again." });
          return;
        }

        const data = await res.json();

        if (cancelled) return;

        if (!isNumericOverview(data)) {
          setOverviewState({
            status: "error",
            message: "Received an invalid response from the server. Please try again.",
          });
          return;
        }

        setOverviewState({ status: "success", data });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (cancelled) return;
        setOverviewState({ status: "error", message: "Failed to load insights overview. Try again." });
      }
    };

    void loadOverview();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedPeriodId, retryKey]);

  const handleRetry = () => {
    setRetryKey((k) => k + 1);
  };

  return (
    // Touchline island (dark-pinned during the phased migration — ADR-0134).
    <div className="touchline flex flex-col gap-6" data-theme="dark">
      <div>
        <h1 className="text-[28px] font-[650] leading-tight text-[var(--foreground)]">Insights</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Authored evidence and coaching-insight surfaces.
        </p>
      </div>

      {leagueSeasons.length > 1 && (
        <div className="flex items-center gap-3">
          <label htmlFor="league-season-select" className="text-[13px] text-[var(--text-muted)]">
            League season
          </label>
          <select
            id="league-season-select"
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="min-h-[44px] rounded-[var(--tl-c-radius-control)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-3 py-1.5 text-[16px] text-[var(--foreground)] medium:min-h-9 medium:text-[14px]"
          >
            {leagueSeasons.map((ls) => (
              <option key={ls.id} value={ls.id}>
                {ls.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {overviewState.status === "loading" && (
        <p className="text-[13px] text-[var(--text-muted)]">Loading insights…</p>
      )}

      {overviewState.status === "error" && (
        <div className="rounded-[var(--tl-c-radius-object)] border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] px-4 py-3">
          <p className="text-[13px] text-[var(--danger)]">{overviewState.message}</p>
          <button
            onClick={handleRetry}
            className="mt-2 rounded-[var(--tl-c-radius-control)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-3 py-1.5 text-[13px] text-[var(--foreground)] hover:bg-[var(--tl-c-surface-hover)]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Four narrative groups (Touchline Design Atlas, ADR-0136) — "Do not create a metrics
          dashboard of equal cards." Replaces the previous flat 13-card list + a separate flat
          4-tile metric grid (itself the exact anti-pattern the spec warns against) with grouped
          sections, each carrying at most one already-fetched headline number. */}
      <div className="flex flex-col gap-6">
        {groupInsightCards(INSIGHT_CARDS).map((group) => {
          const spotlight =
            overviewState.status === "success" ? getGroupSpotlightValue(group.id, overviewState.data) : null;
          return (
            <section key={group.id} className="flex flex-col gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {group.title}
              </h2>
              {spotlight ? (
                <EvidenceSpotlightWidget
                  question={spotlight.label}
                  label={spotlight.label}
                  title={spotlight.title}
                  value={spotlight.value}
                />
              ) : null}
              <div className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
                {group.cards.map((card) => (
                  <InsightCardLink key={card.id} card={card} periodId={selectedPeriodId} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function InsightCardLink({ card, periodId }: { card: InsightCardMeta; periodId: string }) {
  const Icon = CARD_ICONS[card.id];
  return (
    <Link
      href={`${card.href}?leagueSeasonId=${encodeURIComponent(periodId)}`}
      className="group flex items-start gap-3 py-3.5 no-underline transition-colors hover:bg-[var(--tl-c-surface-hover)]"
    >
      <Icon
        strokeWidth={1.75}
        className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent)]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <h3 className="text-[15px] font-[600] text-[var(--foreground)]">{card.label}</h3>
        <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{card.description}</p>
      </div>
    </Link>
  );
}