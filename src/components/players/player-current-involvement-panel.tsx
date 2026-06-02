import Link from "next/link";
import { formatDate } from "@/lib/date-utils";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";

const ROLE_LABELS: Record<string, string> = {
  CORE: "Core",
  SUPPORT: "Support",
  DEVELOPMENT: "Development",
  BACKFILL: "Squad repair",
};

type InvolvementEntry = {
  matchId: string;
  matchStartsAt: Date;
  teamName: string;
  opponent: string;
  role: string;
  status: string;
};

type PlayerCurrentInvolvementPanelProps = {
  involvement: InvolvementEntry[];
  maxItems?: number;
};

export function PlayerCurrentInvolvementPanel({ involvement, maxItems = 8 }: PlayerCurrentInvolvementPanelProps) {
  if (involvement.length === 0) {
    return null;
  }

  const displayed = involvement.slice(0, maxItems);

  return (
    <TacticalSurface variant="default" padding="md">
      <SectionHeader title="Current involvement" />
      <div className="mt-2 flex flex-col gap-1.5">
        {displayed.map((entry, i) => (
          <div key={`${entry.matchId}-${entry.role}-${i}`} className="flex items-center justify-between gap-2">
            <Link
              href={`/matches/${entry.matchId}`}
              className="text-xs text-zinc-100 hover:text-[var(--accent-strong)] transition-colors truncate"
            >
              {formatDate(entry.matchStartsAt)} · {entry.teamName}
              {entry.opponent ? ` vs ${entry.opponent}` : ""}
            </Link>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-[var(--text-muted)]">{ROLE_LABELS[entry.role] ?? entry.role}</span>
              <StatusPill
                variant={entry.status === "FINALIZED" ? "success" : "warning"}
                size="sm"
              >
                {entry.status === "FINALIZED" ? "F" : "D"}
              </StatusPill>
            </div>
          </div>
        ))}
      </div>
    </TacticalSurface>
  );
}