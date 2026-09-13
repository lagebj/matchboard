import { cn } from "@/lib/cn";

/**
 * `PositionEvidenceDot` (Atlas Follow-up, `06_CANONICAL_PITCH_RENDERING_CONTRACT.md §9/§10`,
 * `07_EVOLVING_PLAYER_POSITION_MODEL.md §13`). Renders on `TouchlinePositionMap` only where the
 * unified effective-position model has legitimate support — a caller that has nothing to render
 * for a position should not render this component at all (§8: "no dot = no evidence... do not
 * display placeholder dots").
 *
 * Two independent visual channels, per §9 — never conflated:
 * - hue/lightness (`supportBand`) — relative current positional support within this player's
 *   own profile. Always green (`--tl-position-support-*`).
 * - opacity/outline (`confidence`) — evidence certainty/sample size, separate from support.
 */
export type PositionSupportBand = "LIMITED" | "ESTABLISHED" | "STRONG" | "STRONGEST";
export type PositionEvidenceConfidence = "LOW" | "MEDIUM" | "HIGH";

export type PositionEvidenceDotProps = {
  /** The position code this dot represents, e.g. "CB". Never rendered directly — used for the accessible name. */
  positionCode: string;
  positionLabel: string;
  rank: 1 | 2 | 3 | null;
  supportBand: PositionSupportBand;
  confidence: PositionEvidenceConfidence;
  /** Screen position, already projected (e.g. via `projectFlatPitchPoint`), as percentages. */
  xPct: number;
  yPct: number;
  selected?: boolean;
  onSelect?: () => void;
};

const SUPPORT_BAND_COLOR: Record<PositionSupportBand, string> = {
  STRONGEST: "var(--tl-position-support-strongest)",
  STRONG: "var(--tl-position-support-strong)",
  ESTABLISHED: "var(--tl-position-support-established)",
  LIMITED: "var(--tl-position-support-limited)",
};

/** Radius, in percentage points of the pitch-surface box, per support band — larger = stronger. */
const SUPPORT_BAND_RADIUS: Record<PositionSupportBand, number> = {
  STRONGEST: 3.2,
  STRONG: 2.6,
  ESTABLISHED: 2.1,
  LIMITED: 1.6,
};

const CONFIDENCE_OPACITY: Record<PositionEvidenceConfidence, number> = {
  HIGH: 1,
  MEDIUM: 0.75,
  LOW: 0.5,
};

const RANK_LABEL: Record<1 | 2 | 3, string> = {
  1: "Primary",
  2: "Secondary",
  3: "Tertiary",
};

const SUPPORT_BAND_LABEL: Record<PositionSupportBand, string> = {
  STRONGEST: "strongest support",
  STRONG: "strong support",
  ESTABLISHED: "established support",
  LIMITED: "limited but real support",
};

const CONFIDENCE_LABEL: Record<PositionEvidenceConfidence, string> = {
  HIGH: "high confidence",
  MEDIUM: "medium confidence",
  LOW: "low confidence",
};

export function PositionEvidenceDot({
  positionCode,
  positionLabel,
  rank,
  supportBand,
  confidence,
  xPct,
  yPct,
  selected = false,
  onSelect,
}: PositionEvidenceDotProps) {
  const radius = SUPPORT_BAND_RADIUS[supportBand];
  const color = SUPPORT_BAND_COLOR[supportBand];
  const opacity = CONFIDENCE_OPACITY[confidence];
  const Tag = onSelect ? "button" : "span";

  const ariaLabel = [
    positionLabel,
    rank ? RANK_LABEL[rank] : null,
    SUPPORT_BAND_LABEL[supportBand],
    CONFIDENCE_LABEL[confidence],
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Tag
      {...(onSelect ? { type: "button" as const, onClick: onSelect } : {})}
      aria-label={ariaLabel}
      aria-pressed={onSelect ? selected : undefined}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform",
        onSelect && "cursor-pointer hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
      )}
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        width: `${radius * 2}%`,
        height: `${radius * 2}%`,
        backgroundColor: color,
        opacity,
        outline: selected ? "2px solid var(--accent)" : confidence === "HIGH" ? "1px solid rgba(255,255,255,0.35)" : "1px dashed rgba(255,255,255,0.28)",
        outlineOffset: 2,
      }}
    >
      <span className="sr-only">{ariaLabel}</span>
      {rank === 1 ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center text-[9px] font-[700] text-[var(--tl-c-surface-strong)]"
        >
          {positionCode}
        </span>
      ) : null}
    </Tag>
  );
}
