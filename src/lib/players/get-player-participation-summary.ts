import type { MetricStripItem } from "@/components/touchline/widget/metric-strip";

/**
 * Player detail "participation summary strip" (Touchline Design Atlas,
 * `07_ROUTE_COMPOSITION_PLAYERS_INSIGHTS.md §B`, item 3) — a compact headline preview of the
 * same all-time stats already shown in full in `PlayerStatsSummaryTable` further down the page
 * (the existing, unchanged `getPlayerAllTimeStats()` result). No new query, no new aggregation.
 */
export interface PlayerParticipationSummaryInput {
  actualAppearances: number;
  goals: number;
  assists: number;
  plannedButAbsent: number;
}

export function buildPlayerParticipationSummary(stats: PlayerParticipationSummaryInput): MetricStripItem[] {
  return [
    { id: "played", label: "Played", value: String(stats.actualAppearances) },
    { id: "goals", label: "Goals", value: String(stats.goals) },
    { id: "assists", label: "Assists", value: String(stats.assists) },
    { id: "planned-absent", label: "Planned absent", value: String(stats.plannedButAbsent) },
  ];
}
