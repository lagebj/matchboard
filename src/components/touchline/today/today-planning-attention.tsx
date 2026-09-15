"use client";

/**
 * Today "Planning attention" section (ADR-0142 `02_PRODUCTION_COMPOSITION_CONTRACT.md`). Renders
 * each real plan-integrity signal not already represented by Selection decisions or the primary
 * action directly — never a generic `3 blocked` / `2 decisions required` aggregate. Blockers are
 * visually stronger (IssueMarker `blocked`) and never dismissible.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { IssueMarker } from "@/components/ui/issue-marker";
import { TouchlineButton } from "@/components/touchline";
import type { PlanIntegritySignal } from "@/lib/selection/compute-plan-integrity";

export function TodayPlanningAttention({
  signals,
  orgUrl,
}: {
  signals: PlanIntegritySignal[];
  orgUrl: (path: string) => string;
}) {
  if (signals.length === 0) return null;

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader
        title="Planning attention"
        description="Real plan-integrity signals still needing resolution this round."
        eyebrow={`${signals.length} signal${signals.length === 1 ? "" : "s"}`}
      />
      <ul className="flex flex-col">
        {signals.map((signal) => (
          <li
            key={signal.idempotencyKey}
            className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <IssueMarker
                type={signal.kind === "BLOCKED" ? "blocked" : "decision"}
                label={signal.title}
                description={signal.currentState}
              />
              <span className="text-xs text-[var(--text-muted)]">{signal.consequence}</span>
            </div>
            <TouchlineButton
              as={Link}
              href={orgUrl(signal.primaryActionTarget)}
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
            >
              {signal.primaryActionLabel}
            </TouchlineButton>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
