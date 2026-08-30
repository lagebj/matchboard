"use client";

import Link from "next/link";
import type { WeeklyCoachingContextResult } from "@/lib/weekly/weekly-coaching-context-types";
import { isWeeklyCoachingContextEmpty } from "@/lib/weekly/weekly-coaching-context-types";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import { ArrowLeftRight, ClipboardList, FileClock, UserRoundX } from "lucide-react";

/**
 * Weekly Coaching Context, Round Board variant (ADR-0108,
 * docs/domain/weekly-coaching-context.md). Always shows the *previous* week's context (the round
 * being planned here is next), compact and read-only -- a nudge before planning, never another
 * place to act. Renders nothing when the previous week has nothing worth carrying forward.
 */
export function WeeklyCarryForwardPanel({ result }: { result: WeeklyCoachingContextResult | null }) {
  const orgUrl = useOrgUrl();
  if (!result) return null;
  const { context, playerDisplayById } = result;
  if (isWeeklyCoachingContextEmpty(context)) return null;

  const facts: { icon: typeof ClipboardList; text: string }[] = [];

  const opportunityCount = context.opportunity.availableWithoutPlannedLeagueOpportunityPlayerIds.length;
  if (opportunityCount > 0) {
    facts.push({
      icon: ClipboardList,
      text: `${opportunityCount} available player${opportunityCount === 1 ? "" : "s"} had no planned opportunity`,
    });
  }

  const absentCount = new Set(context.planActual.plannedButAbsent.map((p) => p.playerId)).size;
  if (absentCount > 0) {
    facts.push({
      icon: UserRoundX,
      text: `${absentCount} player${absentCount === 1 ? "" : "s"} planned but did not play`,
    });
  }

  const movementCount = new Set(context.movement.supportAppearances.map((p) => p.playerId)).size;
  if (movementCount > 0) {
    facts.push({
      icon: ArrowLeftRight,
      text: `${movementCount} player${movementCount === 1 ? "" : "s"} moved as support`,
    });
  }

  const incompleteCount =
    context.reporting.incompleteLeagueMatchIds.length + context.reporting.incompleteEventMatchIds.length;
  if (incompleteCount > 0) {
    facts.push({
      icon: FileClock,
      text: `${incompleteCount} report${incompleteCount === 1 ? "" : "s"} from that week still incomplete`,
    });
  }

  if (facts.length === 0) return null;

  const namedPlayerIds = [
    ...new Set([
      ...context.opportunity.availableWithoutPlannedLeagueOpportunityPlayerIds,
      ...context.planActual.plannedButAbsent.map((p) => p.playerId),
    ]),
  ].slice(0, 4);

  return (
    <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4 flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        From {context.weekLabel}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {facts.map((fact, i) => {
          const Icon = fact.icon;
          return (
            <li key={i} className="flex items-center gap-2 text-xs text-[var(--text-soft)]">
              <Icon className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
              {fact.text}
            </li>
          );
        })}
      </ul>
      {namedPlayerIds.length > 0 && (
        <p className="text-[11px] text-[var(--text-muted)]">
          {namedPlayerIds.map((id, i) => {
            const display = playerDisplayById[id];
            if (!display) return null;
            return (
              <span key={id}>
                {i > 0 && " · "}
                <Link href={orgUrl(display.href)} className="underline decoration-dotted underline-offset-2 hover:text-zinc-100">
                  {display.displayName}
                </Link>
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
