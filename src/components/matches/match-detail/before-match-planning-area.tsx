import Link from "next/link";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { TouchlineButton } from "@/components/touchline";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/cn";

export type BeforeMatchLineupSummary = {
  formationName: string;
  filledCount: number;
  totalSlots: number;
} | null;

export type BeforeMatchSquadRow = {
  playerId: string;
  playerName: string;
  primaryPosition: string;
  secondaryPosition: string | null;
  absenceReason: string | null;
  /** `null` when no lineup exists yet at all — the Status column is hidden entirely rather than
   * showing a fabricated "Bench" for every row (`03` spec: "not permission to invent a
   * starting-status model if the current lineup does not provide it"). */
  lineupStatus: "STARTING" | "BENCH" | "NOT_IN_LINEUP" | null;
};

/**
 * "Planned lineup" + "Squad" (`03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md`). The pitch itself is not
 * re-rendered here — `MatchTacticsPanel` already owns the interactive pitch/formation/assignment
 * editor and is the dedicated `Lineup` tab's content; duplicating its stateful data-fetching here
 * would double-fetch the same lineup on every Overview render. This is a lightweight, real-data
 * summary with a link into the actual editor.
 */
export function BeforeMatchPlanningArea({
  lineupSummary,
  squadRows,
  lineupTabHref,
}: {
  lineupSummary: BeforeMatchLineupSummary;
  squadRows: BeforeMatchSquadRow[];
  lineupTabHref: string;
}) {
  const showStatusColumn = squadRows.some((r) => r.lineupStatus !== null);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <TouchlineWidget>
        <div className="flex items-center justify-between gap-3">
          <WidgetHeader
            eyebrow="Planned lineup"
            title={lineupSummary?.formationName ?? "No formation chosen"}
            description={lineupSummary ? `${lineupSummary.filledCount}/${lineupSummary.totalSlots} slots filled` : undefined}
          />
          <TouchlineButton as={Link} href={lineupTabHref} variant="secondary" size="sm">
            {lineupSummary ? "Edit lineup" : "Choose a formation"}
          </TouchlineButton>
        </div>
      </TouchlineWidget>

      <TouchlineWidget>
        <WidgetHeader eyebrow="Squad" title={`${squadRows.length} selected`} />
        {squadRows.length === 0 ? (
          <EmptyState
            className="mt-3"
            title="No squad selected yet."
            description="Generate or edit the squad in the round board to plan this match."
          />
        ) : (
          <ol className="mt-3 flex flex-col gap-1">
            {squadRows.map((row, i) => (
              <li
                key={row.playerId}
                className={cn(
                  "flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px]",
                  row.absenceReason && "opacity-60",
                )}
              >
                <span className="w-4 shrink-0 text-right text-[11px] text-[var(--text-muted)]">{i + 1}</span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    row.absenceReason ? "text-[var(--text-muted)] line-through" : "text-[var(--foreground)]",
                  )}
                >
                  {row.playerName}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                  {row.primaryPosition}
                  {row.secondaryPosition ? ` / ${row.secondaryPosition}` : ""}
                </span>
                {showStatusColumn && row.lineupStatus && (
                  <StatusPill
                    size="sm"
                    variant={row.lineupStatus === "STARTING" ? "success" : "neutral"}
                  >
                    {row.absenceReason
                      ? "Absent"
                      : row.lineupStatus === "STARTING"
                        ? "Starting"
                        : row.lineupStatus === "BENCH"
                          ? "Bench"
                          : "Not in lineup"}
                  </StatusPill>
                )}
              </li>
            ))}
          </ol>
        )}
      </TouchlineWidget>
    </div>
  );
}
