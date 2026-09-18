import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchPreparationWidget } from "@/components/matches/match-detail/match-preparation-widget";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import {
  BeforeMatchPlanningArea,
  type BeforeMatchLineupSummary,
  type BeforeMatchSquadRow,
} from "@/components/matches/match-detail/before-match-planning-area";
import { BeforeMatchSecondaryRow } from "@/components/matches/match-detail/before-match-secondary-row";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import type { MatchPreparationInput } from "@/lib/matches/match-detail-view-model";
import { formatMatchType, formatGameFormat, formatVenue, formatMatchFit } from "@/lib/matches/match-detail-format";

/**
 * Match Details BEFORE-match Overview tab
 * (`03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md`, golden: `references/golden/crops/
 * 03_match_details_before_planned_desktop.png`). Composition order matches the golden exactly:
 * identity card + preparation, facts strip, planned lineup + squad, rotation/opponent/notes.
 */
export function BeforeMatchOverview({
  presentation,
  ownKitColor,
  preparationInput,
  venue,
  matchType,
  gameFormat,
  matchFit,
  lineupSummary,
  squadRows,
  matchId,
  notes,
  rotationChangeCount,
  opponentEncounterCount,
  opponentHasProfile,
  tabHref,
}: {
  presentation: MatchPresentation;
  ownKitColor: string | null;
  preparationInput: MatchPreparationInput;
  venue: string;
  matchType: string;
  gameFormat: string;
  matchFit: string;
  lineupSummary: BeforeMatchLineupSummary;
  squadRows: BeforeMatchSquadRow[];
  matchId: string;
  notes: string | null;
  rotationChangeCount: number;
  opponentEncounterCount: number;
  opponentHasProfile: boolean;
  tabHref: (tab: string) => string;
}) {
  const factsItems: MetricStripItem[] = [
    { id: "format", label: "Format", value: formatGameFormat(gameFormat) },
    { id: "venue", label: "Venue", value: formatVenue(venue) },
    { id: "type", label: "Type", value: formatMatchType(matchType) },
  ];
  if (matchFit !== "UNKNOWN") {
    factsItems.push({ id: "fit", label: "Match fit", value: formatMatchFit(matchFit) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
          <MatchIdentityCard presentation={presentation} ownKitColor={ownKitColor} />
        </div>
        <MatchPreparationWidget input={preparationInput} />
      </div>

      <MetricStrip items={factsItems} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4" />

      <BeforeMatchPlanningArea
        lineupSummary={lineupSummary}
        squadRows={squadRows}
        lineupTabHref={tabHref("lineup")}
      />

      <BeforeMatchSecondaryRow
        matchId={matchId}
        notes={notes}
        rotationChangeCount={rotationChangeCount}
        rotationsTabHref={tabHref("rotations")}
        opponentEncounterCount={opponentEncounterCount}
        opponentHasProfile={opponentHasProfile}
        opponentTabHref={tabHref("opponent-context")}
      />
    </div>
  );
}
