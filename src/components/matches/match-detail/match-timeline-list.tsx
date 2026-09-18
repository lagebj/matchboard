import { cn } from "@/lib/cn";
import type { MatchTimelineItem } from "@/lib/matches/match-detail-view-model";

/**
 * Dense chronological timeline row list — shared by Match Details' "Events" tab/Overview "Key
 * events" preview and the Post-Match Report "Timeline" tab
 * (`04_MATCH_DETAILS_AFTER_MATCH_SPEC.md` "Key events", `05_POST_MATCH_DRAFT_SPEC.md`
 * "Timeline (goals)"). One source of truth for the truth-rule-governed `MatchTimelineItem[]`
 * shape — never re-derives scorer/assist pairing itself.
 */
export function MatchTimelineList({
  items,
  ownTeamName,
  opponentName,
  limit,
}: {
  items: MatchTimelineItem[];
  ownTeamName: string;
  opponentName: string;
  limit?: number;
}) {
  const shown = limit ? items.slice(0, limit) : items;

  if (shown.length === 0) {
    return <p className="text-[13px] text-[var(--text-muted)]">No recorded events yet.</p>;
  }

  return (
    <ol className="flex flex-col divide-y divide-[var(--border-soft)]">
      {shown.map((item) => (
        <li key={item.id} className="flex items-start gap-3 py-2 text-[13px]">
          <span className="w-9 shrink-0 pt-0.5 text-right text-[12px] tabular-nums text-[var(--text-muted)]">
            {item.minuteLabel ?? "—"}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
              item.kind === "GOAL_FOR" ? "bg-[var(--accent)]" : "bg-[var(--text-muted)]",
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[var(--foreground)]">{describeTimelineItem(item, ownTeamName, opponentName)}</p>
            {describeTimelineSubdetail(item) && (
              <p className="text-[12px] text-[var(--text-muted)]">{describeTimelineSubdetail(item)}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function describeTimelineItem(item: MatchTimelineItem, ownTeamName: string, opponentName: string): string {
  switch (item.kind) {
    case "GOAL_FOR":
      return `Goal · ${ownTeamName}`;
    case "GOAL_AGAINST":
      return `Goal · ${opponentName}`;
    case "ROTATION":
      return "Rotation";
    case "PERIOD_BOUNDARY":
      return "Period boundary";
    case "FAIR_PLAY_POSITIVE":
      return "Fair play — positive";
    case "FAIR_PLAY_CONCERN":
      return "Fair play — concern";
    case "MATCH_END":
      return "Full time";
    default:
      return item.kind;
  }
}

function describeTimelineSubdetail(item: MatchTimelineItem): string | null {
  if (item.kind === "GOAL_FOR" || item.kind === "GOAL_AGAINST") {
    if (!item.playerName) return "Unattributed";
    return item.assistPlayerName ? `${item.playerName} · Assist: ${item.assistPlayerName}` : item.playerName;
  }
  if (item.kind === "ROTATION") {
    const inLabel = item.playerName ?? "Unknown";
    const outLabel = item.secondaryPlayerName ?? "Unknown";
    return `${inLabel} on · ${outLabel} off`;
  }
  if (item.kind === "FAIR_PLAY_POSITIVE" || item.kind === "FAIR_PLAY_CONCERN") {
    return item.playerName;
  }
  return null;
}
