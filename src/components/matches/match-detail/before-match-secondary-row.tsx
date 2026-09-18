import Link from "next/link";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { TouchlineButton } from "@/components/touchline";
import { MatchNotesEditor } from "@/components/matches/match-detail/match-notes-editor";

/**
 * "Secondary row" (`03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md`): Rotation plan / Opponent context /
 * Team notes. "Each must have one clear next action when empty and a concise summary when
 * populated."
 */
export function BeforeMatchSecondaryRow({
  matchId,
  notes,
  rotationChangeCount,
  rotationsTabHref,
  opponentEncounterCount,
  opponentHasProfile,
  opponentTabHref,
}: {
  matchId: string;
  notes: string | null;
  rotationChangeCount: number;
  rotationsTabHref: string;
  opponentEncounterCount: number;
  opponentHasProfile: boolean;
  opponentTabHref: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <TouchlineWidget>
        <WidgetHeader eyebrow="Rotation plan" title={rotationChangeCount > 0 ? `${rotationChangeCount} planned` : "Not planned"} />
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">
          {rotationChangeCount > 0
            ? "Planned substitutions and position changes for this match."
            : "Plan expected substitutions and position changes. This is optional."}
        </p>
        <TouchlineButton as={Link} href={rotationsTabHref} variant="ghost" size="sm" className="mt-3">
          {rotationChangeCount > 0 ? "View rotation plan" : "Create rotation plan"}
        </TouchlineButton>
      </TouchlineWidget>

      <TouchlineWidget>
        <WidgetHeader eyebrow="Opponent context" title={opponentHasProfile ? `${opponentEncounterCount} previous encounter${opponentEncounterCount === 1 ? "" : "s"}` : "No profile linked"} />
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">
          {opponentHasProfile
            ? "Known information about style, strengths and weaknesses."
            : "No opponent analysis yet."}
        </p>
        <TouchlineButton as={Link} href={opponentTabHref} variant="ghost" size="sm" className="mt-3">
          {opponentHasProfile ? "View opponent context" : "Add opponent notes"}
        </TouchlineButton>
      </TouchlineWidget>

      <TouchlineWidget>
        <WidgetHeader eyebrow="Team notes" title={notes ? "Recorded" : "No notes yet"} />
        <div className="mt-2">
          <MatchNotesEditor matchId={matchId} notes={notes} />
        </div>
      </TouchlineWidget>
    </div>
  );
}
