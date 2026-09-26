/**
 * Today "Live Now" section (ADR-0141) — a durable, database-backed summary rendered as ordinary
 * server-rendered content. Deliberately not a realtime widget: no socket, no polling, no Durable
 * Object read. The full-fidelity realtime experience remains Live Reporting/Follow Live; this is
 * only a glanceable summary for the Today surface.
 */

import Link from "next/link";
import { Radio } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { StatusPill } from "@/components/ui/status-pill";
import { TouchlineButton } from "@/components/touchline";
import type { TodayLiveMatchSummary } from "@/lib/live-match/get-today-live-match-summaries";
import { describeLiveReportingEntryPointLabel } from "@/lib/live-match/live-reporting-primary-action";

export function TodayLiveNow({
  primary,
  otherLiveCount,
  matchHref,
  reportHref,
}: {
  primary: TodayLiveMatchSummary | null;
  otherLiveCount: number;
  matchHref: (matchId: string) => string;
  /** ADR-0152 §2/§11: the editable Live Reporting page — the resolver-driven primary CTA below
   * goes here, distinct from `matchHref`'s read-only Follow Live destination. */
  reportHref: (matchId: string) => string;
}) {
  if (!primary) return null;

  return (
    <Surface variant="active" padding="md" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusPill variant="danger" size="sm" icon={Radio}>
            Live
          </StatusPill>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {primary.teamName} vs {primary.opponentName}
          </p>
        </div>
        {otherLiveCount > 0 && (
          <span className="text-xs text-[var(--text-muted)]">+{otherLiveCount} live</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="font-mono text-base font-semibold text-[var(--foreground)]">
          {primary.goalsFor} - {primary.goalsAgainst}
        </span>
        <span className="text-[var(--text-muted)]">
          {primary.periodLabel}
          {primary.elapsedLabel ? ` · ${primary.elapsedLabel}` : ""}
          {!primary.isRunning ? " · paused" : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <TouchlineButton as={Link} href={reportHref(primary.matchId)} variant="primary" size="sm">
          {describeLiveReportingEntryPointLabel(primary.primaryAction)}
        </TouchlineButton>
        <TouchlineButton as={Link} href={matchHref(primary.matchId)} variant="secondary" size="sm">
          Follow live
        </TouchlineButton>
      </div>
    </Surface>
  );
}
