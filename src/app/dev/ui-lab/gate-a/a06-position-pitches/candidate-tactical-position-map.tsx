import { cn } from "@/lib/cn";
import { PlanningPitchMarkings } from "@/components/touchline/pitch/pitch-markings";
import { projectPlanningPitchPoint, gridToNormalizedPoint } from "@/components/touchline/pitch/projection";
import { PositionEvidenceDot, type PositionSupportBand, type PositionEvidenceConfidence } from "@/components/touchline/pitch/position-evidence-dot";
import { candidateDisplayCellFor } from "./candidate-position-grid";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";

/**
 * `CandidateTacticalPositionMap` — A06 UI Lab candidate only (owner visual feedback, 2026-10-09).
 *
 * This is the "proposed 24-point presentation" with `LW`/`RW` moved to the attacking-midfield
 * line — it is explicitly NOT the unmodified production coordinate placement (that remains the
 * real `TouchlinePositionMap`, untouched, still used elsewhere e.g.
 * `/dev/ui-lab/atlas-followup/position-map`). Reuses the exact same shared pieces that component
 * does — the same `PlanningPitchMarkings` perspective pitch, the same `projectPlanningPitchPoint`
 * projection, the same `PositionEvidenceDot` atom — read-only, unmodified. The only difference is
 * the coordinate lookup: `candidateDisplayCellFor` instead of production's
 * `positionCodeToPoint`/`primaryDisplayCellFor`-for-`LW`/`RW`.
 */
export type CandidateTacticalPositionMapEntry = {
  positionCode: CanonicalTacticalPosition;
  positionLabel: string;
  rank: 1 | 2 | 3 | null;
  supportBand: PositionSupportBand;
  confidence: PositionEvidenceConfidence;
};

type Props = {
  positions: CandidateTacticalPositionMapEntry[];
  selectedPositionCode?: string | null;
  onSelectPosition?: (positionCode: string) => void;
  className?: string;
};

export function CandidateTacticalPositionMap({ positions, selectedPositionCode, onSelectPosition, className }: Props) {
  const resolved = positions.map((entry) => {
    const cell = candidateDisplayCellFor(entry.positionCode);
    const point = gridToNormalizedPoint(cell.gridX, cell.gridY);
    const screen = projectPlanningPitchPoint(point);
    return { entry, screen };
  });

  const textEquivalent =
    resolved.length > 0
      ? resolved
          .map(({ entry }) => `${entry.positionLabel}: ${entry.supportBand.toLowerCase()} support, ${entry.confidence.toLowerCase()} confidence`)
          .join("; ")
      : "No position evidence recorded yet";

  return (
    <figure
      data-testid="candidate-tactical-position-map"
      className={cn("tl-pitch-surface relative w-full overflow-hidden aspect-[4/5]", className)}
    >
      <PlanningPitchMarkings />
      {resolved.map(({ entry, screen }) => (
        <PositionEvidenceDot
          key={entry.positionCode}
          positionCode={entry.positionCode}
          positionLabel={entry.positionLabel}
          rank={entry.rank}
          supportBand={entry.supportBand}
          confidence={entry.confidence}
          xPct={screen.xPct}
          yPct={screen.yPct}
          perspectiveScale={screen.perspectiveScale}
          selected={selectedPositionCode === entry.positionCode}
          onSelect={onSelectPosition ? () => onSelectPosition(entry.positionCode) : undefined}
        />
      ))}
      <figcaption className="sr-only">{textEquivalent}</figcaption>
    </figure>
  );
}
