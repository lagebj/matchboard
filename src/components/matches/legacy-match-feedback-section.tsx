import { FEEDBACK_CATEGORY_LABELS, type FeedbackCategory } from "@/lib/coaching/types";
import { formatFeedbackValue, formatNextAction } from "@/lib/match-utils";

type FeedbackEntry = {
  id: string;
  playerId: string;
  category: string;
  value: string;
  observableBehavior: string | null;
  nextAction: string;
  note: string | null;
};

type PlayerOption = {
  id: string;
  name: string;
};

type LegacyMatchFeedbackSectionProps = {
  feedback: FeedbackEntry[];
  players: PlayerOption[];
};

/**
 * Read-only historical display for "Post-match feedback" entries recorded before this concept
 * was consolidated into Football observations (the canonical player-development observation
 * concept — see docs/adr for the consolidation decision). No active write path remains: a match
 * with no legacy entries renders nothing, and existing entries can no longer be added to, edited,
 * or deleted here — they are preserved as historical record only.
 */
export function LegacyMatchFeedbackSection({ feedback, players }: LegacyMatchFeedbackSectionProps) {
  if (feedback.length === 0) return null;

  return (
    <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
      <h3 className="text-sm font-semibold text-zinc-200 mb-1">Post-match feedback (legacy)</h3>
      <p className="text-[10px] text-[var(--text-muted)] mb-3">
        Recorded before this was consolidated into Football observations below. Preserved as history; no longer editable here.
      </p>

      <div className="flex flex-col gap-2">
        {feedback.map((f) => {
          const player = players.find((p) => p.id === f.playerId);
          return (
            <div key={f.id} className="flex items-start gap-2 rounded-md border border-zinc-700/40 bg-zinc-800/20 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-200">
                  <span className="font-medium">{player?.name ?? f.playerId}</span>
                  <span className="text-zinc-500 mx-1">·</span>
                  <span className="text-[var(--text-muted)]">{FEEDBACK_CATEGORY_LABELS[f.category as FeedbackCategory] ?? f.category}</span>
                  <span className="text-zinc-500 mx-1">·</span>
                  <span className={f.value === "POSITIVE" ? "text-emerald-400" : f.value === "NEEDS_ATTENTION" ? "text-amber-400" : "text-zinc-300"}>
                    {formatFeedbackValue(f.value)}
                  </span>
                </p>
                {f.observableBehavior && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{f.observableBehavior}</p>
                )}
                {f.nextAction && f.nextAction !== "NO_ACTION" && (
                  <p className="text-[10px] text-blue-400 mt-0.5">Next: {formatNextAction(f.nextAction)}</p>
                )}
                {f.note && (
                  <p className="text-[10px] text-zinc-500 mt-0.5">{f.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
