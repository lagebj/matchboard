import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import type { RoundBoardPlayerAssignmentContext, RoundBoardAssignmentSuggestion } from "@/lib/touchline/presentation/round-board-view-model";

/**
 * `PlayerAssignmentInspector` (Atlas Follow-up, `02_ROUND_BOARD_CONTRACT.md §5`). Selecting a
 * player never requires navigation away. Suggestions come from existing canonical planning logic
 * — reasons are passed in, never invented here (contract's own "Do not invent 'AI reasons'").
 * Shared content body for both the desktop inspector column and the mobile
 * `PlayerAssignmentSheet` — one rendering, not two divergent copies.
 */
export type PlayerAssignmentInspectorProps = {
  context: RoundBoardPlayerAssignmentContext | null;
  onAssign: (suggestion: RoundBoardAssignmentSuggestion) => void;
  onClose?: () => void;
  className?: string;
};

function SuggestionCard({
  suggestion,
  onAssign,
}: {
  suggestion: RoundBoardAssignmentSuggestion;
  onAssign: (s: RoundBoardAssignmentSuggestion) => void;
}) {
  if (suggestion.isRecommended) {
    return (
      <div className="rounded-lg border border-[var(--accent)] bg-[var(--accent-subtle)] p-3">
        <div className="flex items-center gap-2">
          <TeamKitMark color={suggestion.teamKitColor} size="xs" ariaLabel={`${suggestion.teamName} shirt`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-[700] text-[var(--foreground)]">{suggestion.teamName}</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {suggestion.resultingSquadCount} / {suggestion.targetCount} players
            </p>
          </div>
        </div>
        <ul className="mt-2 flex flex-col gap-0.5">
          {suggestion.reasons.map((r) => (
            <li key={r} className="text-[11px] text-[var(--text-soft)]">
              ✓ {r}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => onAssign(suggestion)}
          className="mt-2 w-full rounded-lg bg-[var(--accent)] py-2 text-[13px] font-[700] text-[var(--tl-accent-on-fill)]"
        >
          Assign player
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onAssign(suggestion)}
      className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-soft)] p-3 text-left hover:border-[var(--border-strong)]"
    >
      <TeamKitMark color={suggestion.teamKitColor} size="xs" ariaLabel={`${suggestion.teamName} shirt`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-[600] text-[var(--foreground)]">{suggestion.teamName}</p>
        <p className="text-[11px] text-[var(--text-muted)]">
          {suggestion.resultingSquadCount} / {suggestion.targetCount} players
        </p>
      </div>
      <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border-strong)]" />
    </button>
  );
}

export function PlayerAssignmentInspector({ context, onAssign, onClose, className }: PlayerAssignmentInspectorProps) {
  if (!context) {
    return (
      <TouchlineWidget className={className}>
        <p className="text-[13px] text-[var(--text-muted)]">Select a player to see suggested assignments.</p>
      </TouchlineWidget>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <TouchlineWidget>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <TeamKitMark color={context.kitColor} number={context.shirtNumber} size="md" ariaLabel={`${context.displayName}'s shirt`} />
            <div>
              <p className="text-[14px] font-[700] text-[var(--foreground)]">{context.displayName}</p>
              <p className="text-[11px] text-[var(--text-muted)]">{context.positions.join(" · ") || "No position"}</p>
            </div>
          </div>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--text-muted)] hover:text-[var(--foreground)]">
              ×
            </button>
          ) : null}
        </div>
        {context.attentionSummary ? (
          <p className="mt-3 rounded-lg bg-[var(--warning-subtle)] px-3 py-2 text-[12px] text-[var(--warning)]">{context.attentionSummary}</p>
        ) : null}
      </TouchlineWidget>

      {context.suggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Suggested assignments</p>
          {context.suggestions.map((s) => (
            <SuggestionCard key={s.matchId} suggestion={s} onAssign={onAssign} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
