import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";
import { MatchFormatOverrideControls } from "@/components/matches/match-format-override-controls";
import type { BeforeMatchLineupSummary } from "@/components/matches/match-detail/before-match-planning-area";

/**
 * "Tactics" tab, distinct from "Lineup" (`03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md`). No golden
 * tab-content authority distinguishes the two beyond their rail labels (only the tab list itself
 * is visible in the canonical image) — a disclosed, reasoned split: "Lineup" owns the editable
 * pitch/assignment surface (`MatchTacticsPanel`, unchanged); "Tactics" owns coaching intent and
 * match-format reasoning, which previously had no dedicated home on Match Details at all (they
 * lived in the general meta card). Does not fork or re-render the pitch.
 */
type MatchFormatSnapshot = { numberOfPeriods: number; periodDurationMinutes: number; breakDurationMinutes: number };

export function BeforeMatchTacticsTab({
  matchId,
  coachingIntent,
  coachingIntentId,
  lineupSummary,
  matchFormatState,
}: {
  matchId: string;
  coachingIntent?: string;
  coachingIntentId?: string;
  lineupSummary: BeforeMatchLineupSummary;
  matchFormatState?: {
    matchOverride: MatchFormatSnapshot | null;
    inheritedFormat: MatchFormatSnapshot | null;
    liveReportingStarted: boolean;
    frozenFormat: MatchFormatSnapshot | null;
  };
}) {
  return (
    <div className="flex flex-col gap-4">
      <Surface padding="md">
        <SectionHeader
          title="Formation"
          description={lineupSummary ? `${lineupSummary.formationName} · ${lineupSummary.filledCount}/${lineupSummary.totalSlots} slots filled` : "No formation chosen yet — set one from the Lineup tab."}
        />
      </Surface>
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
  );
}
