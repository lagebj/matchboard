import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricStory, TrendSpark, DistributionBar } from "@/components/viz";
import type { PlayerRecentOpportunity } from "@/lib/players/get-player-recent-opportunity";

/**
 * Player evidence stories (ADR-0125) — the two lead evidence stories on player
 * detail: recent match opportunity (MetricStory + TrendSpark) and position
 * exposure (MetricStory + DistributionBar). Factual and correlational only; no
 * ranking, no overall rating, no good/bad wording. Each story has an explicit
 * insufficient-evidence state.
 */
type Props = {
  playerName: string;
  recentOpportunity: PlayerRecentOpportunity | null;
  realisedPositionCounts: Record<string, number>;
  exposureSampleSize: number;
  leagueSeasonLabel: string | null;
  opportunityDetailHref?: string;
  exposureDetailHref?: string;
};

function opportunityInterpretation(o: PlayerRecentOpportunity): string {
  if (o.previousCount == null || o.previousTotal == null || o.recentTotal === 0) {
    return "Not enough recent rounds to show a trend.";
  }
  const recentRate = o.recentCount / o.recentTotal;
  const prevRate = o.previousCount / o.previousTotal;
  if (recentRate > prevRate + 0.15) return "Opportunity has increased recently.";
  if (recentRate < prevRate - 0.15) return "Opportunity has been less frequent recently.";
  return "Regular recent opportunity.";
}

function exposureInterpretation(
  segments: { label: string; value: number }[],
  total: number,
): string {
  if (total === 0) return "No position exposure recorded yet.";
  const nonZero = segments.filter((s) => s.value > 0);
  if (nonZero.length === 1) {
    return `Exposure so far has been in ${nonZero[0].label.toLowerCase()}.`;
  }
  const top = nonZero.reduce((a, b) => (a.value >= b.value ? a : b));
  if (top.value * 2 > total) {
    return `Most exposure has been in ${top.label.toLowerCase()}.`;
  }
  return `Experience is spread across ${nonZero.length} roles.`;
}

export function PlayerEvidenceStoriesPanel({
  playerName,
  recentOpportunity,
  realisedPositionCounts,
  exposureSampleSize,
  leagueSeasonLabel,
  opportunityDetailHref,
  exposureDetailHref,
}: Props) {
  const segments = Object.entries(realisedPositionCounts)
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label, value }));
  const exposureTotal = segments.reduce((s, seg) => s + seg.value, 0);

  const hasOpportunity = recentOpportunity != null;
  const hasExposure = exposureSampleSize >= 2 && segments.length > 0;

  if (!hasOpportunity && !hasExposure && exposureSampleSize === 0) return null;

  const seasonSuffix = leagueSeasonLabel ? ` · ${leagueSeasonLabel}` : "";

  return (
    <TacticalSurface padding="md" className="flex flex-col gap-5">
      <SectionHeader title="Evidence" description="What the record shows so far." />

      {hasOpportunity ? (
        (() => {
          const o = recentOpportunity!;
          const sparkValues = o.perRound.map((e) => (e.hadOpportunity ? 1 : 0));
          const enoughForSpark = o.perRound.length >= 2 && o.recentTotal > 0;
          return (
            <MetricStory
              question={`Has ${playerName} had regular recent match opportunity?`}
              label="Recent match opportunity"
              value={`${o.recentCount} of ${o.recentTotal}`}
              comparator={
                o.previousCount != null
                  ? `${o.previousCount} of ${o.previousTotal} in the previous ${o.previousTotal}`
                  : undefined
              }
              visual={
                enoughForSpark ? (
                  <TrendSpark
                    question={`Recent match opportunity for ${playerName}`}
                    values={sparkValues}
                    periodLabels={o.perRound.map((e) => e.roundLabel)}
                    formatValue={(v) => (v >= 1 ? "planned" : "no plan")}
                  />
                ) : undefined
              }
              interpretation={opportunityInterpretation(o)}
              sampleContext={`Eligible rounds only${seasonSuffix}`}
              detailHref={opportunityDetailHref}
              detailLabel="View pathways"
            />
          );
        })()
      ) : null}

      {hasExposure ? (
        <MetricStory
          question={`Which positions has ${playerName} actually experienced?`}
          label="Position exposure"
          value={`${segments.length} role${segments.length === 1 ? "" : "s"}`}
          comparator={`${exposureTotal} realised appearance${exposureTotal === 1 ? "" : "s"}`}
          visual={
            <DistributionBar
              question={`Realised position exposure for ${playerName}`}
              segments={segments}
            />
          }
          interpretation={exposureInterpretation(segments, exposureTotal)}
          sampleContext={`Realised positions${seasonSuffix}`}
          detailHref={exposureDetailHref}
          detailLabel="View exposure"
        />
      ) : exposureSampleSize > 0 ? (
        <MetricStory
          question={`Which positions has ${playerName} actually experienced?`}
          label="Position exposure"
          value={`${exposureSampleSize}`}
          interpretation={
            exposureSampleSize === 1
              ? "Observed in 1 match — more match data is needed before a pattern can be shown."
              : "More match data is needed before a pattern can be shown."
          }
          sampleContext={`Realised positions${seasonSuffix}`}
        />
      ) : null}
    </TacticalSurface>
  );
}
