import { cn } from "@/lib/cn";
import { PositionEvidenceDot, type PositionSupportBand, type PositionEvidenceConfidence } from "@/components/touchline/pitch/position-evidence-dot";
import { profilePositionToFlatPoint, type ProfilePosition } from "../shared/profile-position-model";
import { FlatProfilePitchMarkings } from "./flat-profile-pitch-markings";

/**
 * `FlatProfilePositionMap` — A06 UI Lab candidate only (`13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md`
 * XR-P02: "flat 3×6, GK bottom, attack top, no shirts, no dot for missing evidence"). Reuses the
 * real, shared `PositionEvidenceDot` atom (same visual language as the production
 * `TouchlinePositionMap`) but places it with plain flat percentages — no perspective projection,
 * no shirts, no slots. An isolated presentation candidate, not a change to the production
 * perspective renderer (BLK-02).
 */
export type FlatProfilePositionMapEntry = {
  position: ProfilePosition;
  positionLabel: string;
  rank: 1 | 2 | 3 | null;
  supportBand: PositionSupportBand;
  confidence: PositionEvidenceConfidence;
};

type Props = {
  entries: FlatProfilePositionMapEntry[];
  selectedPosition?: ProfilePosition | null;
  onSelectPosition?: (position: ProfilePosition) => void;
  className?: string;
};

export function FlatProfilePositionMap({ entries, selectedPosition, onSelectPosition, className }: Props) {
  const textEquivalent =
    entries.length > 0
      ? entries
          .map((e) => `${e.positionLabel}: ${e.supportBand.toLowerCase()} support, ${e.confidence.toLowerCase()} confidence`)
          .join("; ")
      : "No position evidence recorded yet";

  return (
    <figure
      data-testid="flat-profile-position-map"
      className={cn("tl-pitch-surface relative w-full overflow-hidden aspect-[3/5]", className)}
    >
      <FlatProfilePitchMarkings />
      {entries.map((e) => {
        const { xPct, yPct } = profilePositionToFlatPoint(e.position);
        return (
          <PositionEvidenceDot
            key={e.position}
            positionCode={e.position}
            positionLabel={e.positionLabel}
            rank={e.rank}
            supportBand={e.supportBand}
            confidence={e.confidence}
            xPct={xPct}
            yPct={yPct}
            perspectiveScale={1}
            selected={selectedPosition === e.position}
            onSelect={onSelectPosition ? () => onSelectPosition(e.position) : undefined}
          />
        );
      })}
      <figcaption className="sr-only">{textEquivalent}</figcaption>
    </figure>
  );
}
