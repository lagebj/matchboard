import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchPreparationWidget } from "@/components/matches/match-detail/match-preparation-widget";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { BeforeMatchSecondaryRow } from "@/components/matches/match-detail/before-match-secondary-row";
import { MatchTacticsPanel } from "@/components/matches/match-tactics-panel";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";
import { MatchFormatOverrideControls } from "@/components/matches/match-format-override-controls";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import type { MatchPreparationInput } from "@/lib/matches/match-detail-view-model";
import { formatMatchType, formatGameFormat, formatVenue, formatMatchFit } from "@/lib/matches/match-detail-format";

type SelectionRow = {
  playerId: string;
  playerName: string;
  role: string;
  primaryPosition: string;
  secondaryPosition: string | null;
  coreTeamName: string;
  absenceReason?: string | null;
  source?: "planned" | "helper" | "match_day_addition" | "guest";
};

type MatchFormatSnapshot = { numberOfPeriods: number; periodDurationMinutes: number; breakDurationMinutes: number };

/**
 * Match Details BEFORE-match Overview tab
 * (`03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md`, golden: `references/golden/crops/
 * 03_match_details_before_planned_desktop.png`). Composition order matches the golden.
 *
 * Post-launch correction (2026-09-18): the golden's "Planned lineup" region must show the real
 * pitch, not a formation-name/filled-count summary — a coach reported the original summary
 * widget as effectively showing no lineup at all. Fully absorbs the former "Lineup" tab
 * (`MatchTacticsPanel`, unchanged) and the former "Tactics" tab (coaching intent + match format)
 * directly into Overview at the requester's direction, removing both as separate tabs — there is
 * only one lineup/tactics surface now, not the same content reachable two ways.
 *
 * ADR-0149 (2026-09-22): the standalone Partnership Evidence list and the standalone "AI Advisor"
 * panel previously rendered here are both gone — `MatchTacticsPanel` now owns one unified Match
 * Insights surface (deterministic facts plus optional AI enrichment) inside its own pitch/sidebar
 * grid, self-fetched client-side rather than threaded down as a page-load-time prop, so it can
 * refresh live as the plan is edited. No separate Advisor rendering happens at this level anymore.
 */
export function BeforeMatchOverview({
  presentation,
  ownKitColor,
  preparationInput,
  venue,
  matchType,
  gameFormat,
  matchFit,
  matchId,
  teamId,
  teamName,
  selections,
  planningEditable,
  coachingIntent,
  coachingIntentId,
  matchFormatState,
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
  matchId: string;
  teamId: string;
  teamName: string;
  selections: SelectionRow[];
  planningEditable: boolean;
  coachingIntent?: string;
  coachingIntentId?: string;
  matchFormatState?: {
    matchOverride: MatchFormatSnapshot | null;
    inheritedFormat: MatchFormatSnapshot | null;
    liveReportingStarted: boolean;
    frozenFormat: MatchFormatSnapshot | null;
  };
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Surface padding="md">
          <SectionHeader title="Coaching intent" description="What this match's plan is optimising for." />
          <div className="mt-3">
            <CoachingIntentSelector
              scopeType="MATCH"
              scopeId={matchId}
              currentIntent={coachingIntent}
              currentIntentId={coachingIntentId}
            />
          </div>
        </Surface>
        {matchFormatState && (
          <Surface padding="md">
            <SectionHeader title="Match format" description="Periods and durations for this match." />
            <div className="mt-3">
              <MatchFormatOverrideControls
                matchId={matchId}
                matchOverride={matchFormatState.matchOverride}
                inheritedFormat={matchFormatState.inheritedFormat}
                liveReportingStarted={matchFormatState.liveReportingStarted}
                frozenFormat={matchFormatState.frozenFormat}
              />
            </div>
          </Surface>
        )}
      </div>

      <MatchTacticsPanel
        matchId={matchId}
        teamId={teamId}
        teamName={teamName}
        gameFormat={gameFormat}
        planningEditable={planningEditable}
        selections={selections}
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
