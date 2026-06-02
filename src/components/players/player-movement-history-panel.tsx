import Link from "next/link";
import { formatDate } from "@/lib/date-utils";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { MovementArrow } from "@/components/ui/movement-arrow";
import { StatusPill } from "@/components/ui/status-pill";

type MovementEntry = {
  id: string;
  fromTeamName: string;
  toTeamName: string;
  role: string;
  matchDate: Date;
  matchId: string;
  isDraft: boolean;
};

type PlayerMovementHistoryPanelProps = {
  movementHistory: MovementEntry[];
  maxItems?: number;
};

export function PlayerMovementHistoryPanel({ movementHistory, maxItems = 10 }: PlayerMovementHistoryPanelProps) {
  if (movementHistory.length === 0) {
    return (
      <TacticalSurface variant="default" padding="md">
        <SectionHeader title="Movement history" />
        <p className="mt-2 text-sm text-[var(--text-soft)]">No cross-team movement recorded yet.</p>
      </TacticalSurface>
    );
  }

  const displayed = movementHistory.slice(0, maxItems);

  return (
    <TacticalSurface variant="default" padding="md">
      <SectionHeader title="Movement history" />
      <div className="mt-2 flex flex-col gap-2">
        {displayed.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-2">
            <Link
              href={`/rounds/${entry.matchId}`}
              className="text-[10px] text-[var(--text-muted)] hover:text-zinc-50 transition-colors shrink-0"
            >
              {formatDate(entry.matchDate)}
            </Link>
            <MovementArrow
              fromTeam={entry.fromTeamName}
              toTeam={entry.toTeamName}
              role={
                entry.role === "SUPPORT" ? "support"
                  : entry.role === "DEVELOPMENT" ? "development"
                  : entry.role === "BACKFILL" ? "support"
                  : "core"
              }
              compact
            />
            {entry.isDraft && (
              <StatusPill variant="warning" size="sm">Draft</StatusPill>
            )}
          </div>
        ))}
      </div>
    </TacticalSurface>
  );
}