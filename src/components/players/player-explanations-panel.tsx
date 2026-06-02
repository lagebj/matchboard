import Link from "next/link";
import { formatDate } from "@/lib/date-utils";
import { formatExplanationLines } from "@/lib/player-explanations";
import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";

const ROLE_LABELS: Record<string, string> = {
  CORE: "Core",
  SUPPORT: "Support",
  DEVELOPMENT: "Development",
  BACKFILL: "Squad repair",
};

type ExplanationEntry = {
  id: string;
  role: string;
  explanation: string | null;
  overrideReason: string | null;
  matchDate: Date;
  matchId: string;
  teamName: string;
  opponent: string;
};

type PlayerExplanationsPanelProps = {
  explanations: ExplanationEntry[];
  maxItems?: number;
};

export function PlayerExplanationsPanel({ explanations, maxItems = 6 }: PlayerExplanationsPanelProps) {
  if (explanations.length === 0) {
    return null;
  }

  const displayed = explanations.slice(0, maxItems);

  return (
    <TacticalSurface variant="default" padding="md">
      <SectionHeader title="Why this happened" />
      <div className="mt-2 flex flex-col gap-2">
        {displayed.map((entry) => {
          const lines = entry.explanation
            ? formatExplanationLines(entry.explanation)
            : [];
          return (
            <div key={entry.id} className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/matches/${entry.matchId}`}
                  className="text-xs font-medium text-zinc-100 hover:text-[var(--accent-strong)] transition-colors"
                >
                  {entry.teamName} vs {entry.opponent}
                </Link>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusPill variant="neutral" size="sm">{ROLE_LABELS[entry.role] ?? entry.role}</StatusPill>
                  {entry.overrideReason && <StatusPill variant="warning" size="sm">Override</StatusPill>}
                </div>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{formatDate(entry.matchDate)}</p>
              {lines.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {lines.map((line, i) => (
                    <p key={i} className="text-xs text-[var(--text-soft)]">{line}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </TacticalSurface>
  );
}