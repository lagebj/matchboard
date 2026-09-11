"use client";

import { useState } from "react";
import { MoreHorizontal, Goal, Footprints } from "lucide-react";
import { TouchlineWidget, WidgetHeader, MetricStrip } from "@/components/touchline";
import { PositionMap } from "@/components/ui/position-map";
import { TrendSpark, MetricStory } from "@/components/viz";
import {
  playerDetailIdentity,
  playerDetailParticipation,
  playerDetailOpportunity,
  playerDetailPositionExposure,
  playerDetailObservation,
  playerDetailRecentFootball,
} from "../fixtures";

const TABS = ["Overview", "Matches", "Development", "Evidence"] as const;

/**
 * Golden: player-detail-mobile (390×844). Touchline Finish & Visual
 * Convergence follow-up (`08_PLAYER_EVENT_INSIGHTS_AND_OVERVIEWS.md §1`).
 *
 * The golden reference shows a generated child photo — Matchboard has no
 * player-photo feature and must not fabricate one (`00_EXECUTION_CONTRACT.md
 * §5`/`AGENTS.md` "Player attribute ratings" boundary). A large identity
 * field (initials/number) replaces it. Position exposure reuses the existing
 * `PositionMap` mini-pitch renderer — never a second hard-coded position map.
 */
export function PlayerDetailContent() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const initials = playerDetailIdentity.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-[12px] text-[var(--text-muted)]">
            {playerDetailIdentity.team} · {playerDetailIdentity.group}
          </p>
        </div>
        <button type="button" aria-label="More actions" className="shrink-0 text-[var(--text-muted)]">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget-strong)] text-[22px] font-[700] tabular-nums text-[var(--foreground)]"
        >
          {playerDetailIdentity.number ?? initials}
        </span>
        <div className="min-w-0">
          <h1 className="text-[24px] font-[650] leading-tight text-[var(--foreground)]">
            {playerDetailIdentity.name}
          </h1>
          <p className="mt-0.5 text-[13px] font-medium text-[var(--accent)]">
            #{playerDetailIdentity.number} · {playerDetailIdentity.role}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-5 border-b border-[var(--border-soft)]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              "relative pb-2.5 text-[14px] font-[600] " +
              (tab === t ? "text-[var(--foreground)]" : "text-[var(--text-muted)]")
            }
          >
            {t}
            {tab === t ? (
              <span aria-hidden="true" className="absolute bottom-0 left-0 h-[2px] w-full bg-[var(--accent)]" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <TouchlineWidget>
          <WidgetHeader
            eyebrow="Participation"
            title="This season"
            action={<span className="text-[13px] text-[var(--text-muted)]">This season</span>}
          />
          <div className="mt-3">
            <MetricStrip items={playerDetailParticipation} />
          </div>
        </TouchlineWidget>

        <div className="grid grid-cols-1 gap-4 medium:grid-cols-2">
          <MetricStory
            question="How has this player's planned opportunity changed recently?"
            label="Opportunity"
            value="1 / 1"
            unit="this week"
            visual={
              <TrendSpark
                question="Recent opportunity by round"
                values={playerDetailOpportunity.map((w) => w.value)}
                periodLabels={playerDetailOpportunity.map((w) => w.weekLabel)}
              />
            }
            interpretation="Consistent involvement with increasing responsibility."
            sampleContext={playerDetailOpportunity.map((w) => w.weekLabel).join(" · ")}
          />

          <MetricStory
            question="Which positions has this player actually appeared in?"
            label="Position exposure"
            value=""
            visual={<PositionMap primaryPosition="LW" secondaryPositions={["LM", "ST"]} size="sm" />}
            interpretation={playerDetailPositionExposure
              .map((p) => `${p.code} ${p.pct}%`)
              .join(" · ")}
          />
        </div>

        <TouchlineWidget>
          <WidgetHeader eyebrow="Recent observation" title="Coach observation" description={`Recorded ${playerDetailObservation.dateLabel}`} />
          <blockquote className="mt-3 border-l-2 border-[var(--accent)] pl-3 text-[14px] leading-snug text-[var(--text-soft)]">
            {playerDetailObservation.text}
          </blockquote>
          <div className="mt-3 flex flex-wrap gap-2">
            {playerDetailObservation.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border-soft)] px-2.5 py-1 text-[12px] text-[var(--text-soft)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </TouchlineWidget>

        <TouchlineWidget>
          <WidgetHeader title="Recent football" action={<span className="text-[13px] font-medium text-[var(--accent)]">View all</span>} />
          <ul className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
            {playerDetailRecentFootball.map((m) => (
              <li key={`${m.date}-${m.label}`} className="flex items-center gap-3 py-2.5">
                <span className="w-11 shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]">{m.date}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-[600] text-[var(--foreground)]">{m.label}</span>
                  <span className="block text-[12px] text-[var(--text-muted)]">{m.context}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[12px] text-[var(--text-muted)]">
                  {m.goals ? (
                    <span className="inline-flex items-center gap-1">
                      <Goal className="h-3.5 w-3.5" aria-hidden="true" />
                      {m.goals}
                    </span>
                  ) : null}
                  {m.assists ? (
                    <span className="inline-flex items-center gap-1">
                      <Footprints className="h-3.5 w-3.5" aria-hidden="true" />
                      {m.assists}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </TouchlineWidget>
      </div>
    </>
  );
}
