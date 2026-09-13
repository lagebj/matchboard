import { cn } from "@/lib/cn";
import { PlanningPitchMarkings } from "./pitch-markings";
import { projectPlanningPitchPoint } from "./projection";
import { positionCodeToPoint } from "./position-coordinates";
import { PositionEvidenceDot, type PositionSupportBand, type PositionEvidenceConfidence } from "./position-evidence-dot";

/**
 * `TouchlinePositionMap` — the one canonical analytical position-exposure renderer (Atlas
 * Follow-up, `06_CANONICAL_PITCH_RENDERING_CONTRACT.md §7`). Used for Player Detail position
 * exposure and any future analytical position visualization with the same semantics.
 *
 * Shares the same pitch surface, markings and perspective projection as `TouchlinePlanningPitch`
 * (human review feedback, 2026-09-13: keep one consistent pitch graphic across both canonical
 * renderers, rather than a separate flat/top-down treatment). What still makes this an
 * *analytical* renderer, distinct from the planning pitch: no shirts, no slot/assignment concept
 * — only `PositionEvidenceDot`s, sized/coloured by support and confidence, never player identity.
 *
 * Consumes an already-resolved list of positions with support/confidence — it does not compute
 * evidence itself (`08_VIEW_MODELS_AND_COMPONENT_CONTRACTS.md §6`: "The component renders. It
 * does not decide what the player's positions are."). Callers pass
 * `effectivePositionProfile.positions` (see `07_EVOLVING_PLAYER_POSITION_MODEL.md §10`), filtered
 * to positions with legitimate support — a position with no support must not appear in this list
 * at all (contract §8: "no dot = no evidence... do not display placeholder dots").
 */
export type TouchlinePositionMapEntry = {
  positionCode: string;
  positionLabel: string;
  rank: 1 | 2 | 3 | null;
  supportBand: PositionSupportBand;
  confidence: PositionEvidenceConfidence;
};

export type TouchlinePositionMapProps = {
  positions: TouchlinePositionMapEntry[];
  selectedPositionCode?: string | null;
  onSelectPosition?: (positionCode: string) => void;
  className?: string;
};

export function TouchlinePositionMap({
  positions,
  selectedPositionCode,
  onSelectPosition,
  className,
}: TouchlinePositionMapProps) {
  const resolved = positions
    .map((entry) => {
      const point = positionCodeToPoint(entry.positionCode);
      if (!point) return null;
      const screen = projectPlanningPitchPoint(point);
      return { entry, screen };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const textEquivalent =
    resolved.length > 0
      ? resolved
          .map(({ entry }) => `${entry.positionLabel}: ${entry.supportBand.toLowerCase()} support, ${entry.confidence.toLowerCase()} confidence`)
          .join("; ")
      : "No position evidence recorded yet";

  return (
    <figure
      data-testid="touchline-position-map"
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
