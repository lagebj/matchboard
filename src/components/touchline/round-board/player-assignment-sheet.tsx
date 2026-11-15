import { TouchlineBottomSheet } from "@/components/touchline/overlay/touchline-bottom-sheet";
import { PlayerAssignmentInspector } from "./player-assignment-inspector";
import type { RoundBoardPlayerAssignmentContext, RoundBoardAssignmentSuggestion } from "@/lib/touchline/presentation/round-board-view-model";

/**
 * `PlayerAssignmentSheet` (Atlas Follow-up, `02_ROUND_BOARD_CONTRACT.md §7`) — mobile's tap path
 * for assignment: select a player, the sheet shows suggested destinations, one explicit commit
 * action. Composes the existing `TouchlineBottomSheet` and the shared
 * `PlayerAssignmentInspector` body — no second suggestion-rendering implementation.
 */
export type PlayerAssignmentSheetProps = {
  isOpen: boolean;
  context: RoundBoardPlayerAssignmentContext | null;
  onAssign: (suggestion: RoundBoardAssignmentSuggestion) => void;
  onClose: () => void;
  /** See `PlayerAssignmentInspector`'s `closedNotice` — passed through unchanged. */
  closedNotice?: string | null;
  /** See `PlayerAssignmentInspector`'s `lineupHref` — passed through unchanged. */
  lineupHref?: string | null;
  /** See `PlayerAssignmentInspector`'s `errorNotice` — passed through unchanged. The sheet's own
   * `isOpen` is controlled by the caller, which only closes it on a real success (P1-05) — this
   * component does not need to decide that itself. */
  errorNotice?: string | null;
};

export function PlayerAssignmentSheet({ isOpen, context, onAssign, onClose, closedNotice, lineupHref, errorNotice }: PlayerAssignmentSheetProps) {
  const recommended = context?.suggestions.find((s) => s.isRecommended) ?? null;

  return (
    <TouchlineBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={context?.displayName ?? "Assign player"}
      tone="context"
      ariaLabel="Assign player"
      footer={
        recommended ? (
          <button
            type="button"
            onClick={() => onAssign(recommended)}
            className="w-full rounded-lg bg-[var(--accent)] py-3 text-[14px] font-[700] text-[var(--tl-accent-on-fill)]"
          >
            Assign to {recommended.teamName}
          </button>
        ) : undefined
      }
    >
      <PlayerAssignmentInspector context={context} onAssign={onAssign} closedNotice={closedNotice} lineupHref={lineupHref} errorNotice={errorNotice} />
    </TouchlineBottomSheet>
  );
}
