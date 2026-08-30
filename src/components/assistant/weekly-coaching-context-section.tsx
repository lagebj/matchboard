"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { CoachingSituation } from "@/lib/situational/situation-types";
import type {
  WeeklyCoachingContextResult,
  WeeklyContextStatus,
} from "@/lib/weekly/weekly-coaching-context-types";
import { isWeeklyCoachingContextEmpty } from "@/lib/weekly/weekly-coaching-context-types";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import {
  Activity,
  ArrowLeftRight,
  CalendarCheck,
  ClipboardList,
  FileClock,
  UserRoundX,
} from "lucide-react";

/**
 * Weekly Coaching Context (ADR-0108, docs/domain/weekly-coaching-context.md). A single derived
 * read model, presented differently depending on the caller's already-computed situation:
 *
 * - MATCHDAY: not rendered at all (returns null) -- a live/imminent match is the whole story.
 * - NEXT: framed as "carries forward into next round" -- opportunity, plan-vs-actual, movement,
 *   and incomplete reports the coach should settle before planning the next round.
 * - LONG_TERM: framed as a broader "weekly pulse" review of the same facts.
 *
 * Every player/match reference here is resolved via the result's display maps -- this component
 * never derives a name, a link, or a fact itself.
 */

const STATUS_LABEL: Record<WeeklyContextStatus, string> = {
  IN_PROGRESS: "In progress",
  PROVISIONAL: "Provisional",
  COMPLETE: "Complete",
};

function PlayerList({
  playerIds,
  playerDisplayById,
}: {
  playerIds: string[];
  playerDisplayById: WeeklyCoachingContextResult["playerDisplayById"];
}) {
  const orgUrl = useOrgUrl();
  if (playerIds.length === 0) return null;
  const VISIBLE = 3;
  const visible = playerIds.slice(0, VISIBLE);
  const rest = playerIds.slice(VISIBLE);

  const renderPlayer = (playerId: string) => {
    const display = playerDisplayById[playerId];
    if (!display) return null;
    return (
      <Link
        key={playerId}
        href={orgUrl(display.href)}
        className="text-[var(--text-soft)] underline decoration-dotted underline-offset-2 hover:text-zinc-100"
      >
        {display.displayName}
      </Link>
    );
  };

  if (rest.length === 0) {
    return (
      <span className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs">
        {visible.map((id, i) => (
          <span key={id} className="flex items-center gap-1.5">
            {renderPlayer(id)}
            {i < visible.length - 1 && <span className="text-[var(--text-muted)]">·</span>}
          </span>
        ))}
      </span>
    );
  }

  return (
    <details className="text-xs">
      <summary className="cursor-pointer list-none text-[var(--text-muted)] marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap gap-x-1.5 gap-y-1">
          {visible.map((id, i) => (
            <span key={id} className="flex items-center gap-1.5">
              {renderPlayer(id)}
              {i < visible.length - 1 && <span className="text-[var(--text-muted)]">·</span>}
            </span>
          ))}
          <span className="underline decoration-dotted underline-offset-2">
            +{rest.length} more
          </span>
        </span>
      </summary>
      <span className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-1 pl-0">
        {rest.map((id, i) => (
          <span key={id} className="flex items-center gap-1.5">
            {renderPlayer(id)}
            {i < rest.length - 1 && <span className="text-[var(--text-muted)]">·</span>}
          </span>
        ))}
      </span>
    </details>
  );
}

function WeeklyFactRow({
  icon: Icon,
  label,
  detail,
  playerIds,
  playerDisplayById,
}: {
  icon: typeof Activity;
  label: string;
  detail: string;
  playerIds: string[];
  playerDisplayById: WeeklyCoachingContextResult["playerDisplayById"];
}) {
  return (
    <li className="flex flex-col gap-1 py-2 px-3 -mx-3 rounded-lg">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium text-zinc-100">{detail}</span>
      </div>
      <div className="pl-6 flex items-center gap-2">
        <span className="sr-only">{label}</span>
        <PlayerList playerIds={playerIds} playerDisplayById={playerDisplayById} />
      </div>
    </li>
  );
}

export function WeeklyCoachingContextSection({
  result,
  primarySituation,
}: {
  result: WeeklyCoachingContextResult | null;
  primarySituation: CoachingSituation;
}) {
  if (primarySituation === "MATCHDAY") return null;
  if (!result) return null;

  const { context, playerDisplayById } = result;
  if (isWeeklyCoachingContextEmpty(context)) return null;

  const isNext = primarySituation === "NEXT";
  const title = isNext ? "Carries into next round" : "Weekly pulse";
  const description = isNext
    ? `From ${context.weekLabel} -- worth a look before planning the next round.`
    : `A quick read on ${context.weekLabel}.`;

  const rows: ReactNode[] = [];

  if (context.opportunity.availableWithoutPlannedLeagueOpportunityPlayerIds.length > 0) {
    const ids = context.opportunity.availableWithoutPlannedLeagueOpportunityPlayerIds;
    rows.push(
      <WeeklyFactRow
        key="opportunity"
        icon={ClipboardList}
        label="Opportunity"
        detail={`${ids.length} available player${ids.length === 1 ? "" : "s"} had no planned opportunity`}
        playerIds={ids}
        playerDisplayById={playerDisplayById}
      />,
    );
  }

  if (context.planActual.plannedButAbsent.length > 0) {
    const ids = [...new Set(context.planActual.plannedButAbsent.map((p) => p.playerId))];
    rows.push(
      <WeeklyFactRow
        key="planned-absent"
        icon={UserRoundX}
        label="Planned but absent"
        detail={`${ids.length} player${ids.length === 1 ? "" : "s"} planned but did not play`}
        playerIds={ids}
        playerDisplayById={playerDisplayById}
      />,
    );
  }

  if (context.planActual.unplannedAppearances.length > 0) {
    const ids = [...new Set(context.planActual.unplannedAppearances.map((p) => p.playerId))];
    rows.push(
      <WeeklyFactRow
        key="unplanned"
        icon={ArrowLeftRight}
        label="Unplanned appearances"
        detail={`${ids.length} player${ids.length === 1 ? "" : "s"} played without a planned selection`}
        playerIds={ids}
        playerDisplayById={playerDisplayById}
      />,
    );
  }

  if (context.movement.supportAppearances.length > 0) {
    const ids = [...new Set(context.movement.supportAppearances.map((p) => p.playerId))];
    rows.push(
      <WeeklyFactRow
        key="movement"
        icon={ArrowLeftRight}
        label="Movement"
        detail={`${ids.length} player${ids.length === 1 ? "" : "s"} moved as support`}
        playerIds={ids}
        playerDisplayById={playerDisplayById}
      />,
    );
  }

  if (context.noRecordedAppearance && context.noRecordedAppearance.playerIds.length > 0) {
    const ids = context.noRecordedAppearance.playerIds;
    rows.push(
      <WeeklyFactRow
        key="no-appearance"
        icon={CalendarCheck}
        label="No recorded appearance"
        detail={`${ids.length} player${ids.length === 1 ? "" : "s"} on a team that played had no recorded appearance`}
        playerIds={ids}
        playerDisplayById={playerDisplayById}
      />,
    );
  }

  const incompleteCount =
    context.reporting.incompleteLeagueMatchIds.length + context.reporting.incompleteEventMatchIds.length;
  if (incompleteCount > 0) {
    rows.push(
      <li key="reporting" className="flex items-center gap-2 py-2 px-3 -mx-3 rounded-lg">
        <FileClock className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium text-zinc-100">
          {incompleteCount} report{incompleteCount === 1 ? "" : "s"} still incomplete for this week
        </span>
      </li>,
    );
  }

  if (rows.length === 0) return null;

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader
        title={title}
        description={description}
        actions={
          <StatusPill variant="neutral" size="sm" icon={Activity}>
            {STATUS_LABEL[context.status]}
          </StatusPill>
        }
      />
      <ul className="flex flex-col">{rows}</ul>
    </Surface>
  );
}
