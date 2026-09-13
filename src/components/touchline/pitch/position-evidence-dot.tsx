import { cn } from "@/lib/cn";

/**
 * `PositionEvidenceDot` (Atlas Follow-up, `06_CANONICAL_PITCH_RENDERING_CONTRACT.md §9/§10`,
 * `07_EVOLVING_PLAYER_POSITION_MODEL.md §13`). Renders on `TouchlinePositionMap` only where the
 * unified effective-position model has legitimate support — a caller that has nothing to render
 * for a position should not render this component at all (§8: "no dot = no evidence... do not
 * display placeholder dots").
 *
 * Three visual channels, layered on top of each other, never conflated:
 * - hue (`supportBand`) — relative current positional support within this player's own profile.
 *   Always green (`--tl-position-support-*`), spread across the green spectrum for genuine
 *   distinguishability, not just lightness steps of one hue.
 * - size — also driven by `supportBand`; a **fixed pixel diameter**, not a percentage of the
 *   pitch-surface box, so a dot stays a true circle regardless of the container's aspect ratio
 *   (human review feedback, 2026-09-13: percentage-sized dots rendered as ellipses on the
 *   non-square pitch surface).
 * - a glow (`box-shadow`), matching the support-band hue and scaled to the same strength —
 *   reinforces the hue/size signal, still representing support, not a fourth independent channel.
 * - opacity/outline (`confidence`) — evidence certainty/sample size, kept strictly separate from
 *   support.
 *
 * No position code or other text is rendered inside the dot — identification is via the
 * accessible name (`aria-label`/`sr-only`) and, for a sighted user, the caller's own
 * label/legend, not text crammed into the mark itself.
 */
export type PositionSupportBand = "LIMITED" | "ESTABLISHED" | "STRONG" | "STRONGEST";
export type PositionEvidenceConfidence = "LOW" | "MEDIUM" | "HIGH";

export type PositionEvidenceDotProps = {
  /** The position code this dot represents, e.g. "CB". Not rendered as visible text (exposed only as `data-position-code`, for tests/tooling) — identification is via the accessible name below. */
  positionCode: string;
  positionLabel: string;
  rank: 1 | 2 | 3 | null;
  supportBand: PositionSupportBand;
  confidence: PositionEvidenceConfidence;
  /** Screen position, already projected, as percentages of the pitch-surface box. */
  xPct: number;
  yPct: number;
  /** Depth scale from the shared planning-pitch projection (near-goal dots render slightly larger). Default 1. */
  perspectiveScale?: number;
  selected?: boolean;
  onSelect?: () => void;
};

const SUPPORT_BAND_COLOR: Record<PositionSupportBand, string> = {
  STRONGEST: "var(--tl-position-support-strongest)",
  STRONG: "var(--tl-position-support-strong)",
  ESTABLISHED: "var(--tl-position-support-established)",
  LIMITED: "var(--tl-position-support-limited)",
};

const SUPPORT_BAND_GLOW: Record<PositionSupportBand, string> = {
  STRONGEST: "var(--tl-position-support-strongest-glow)",
  STRONG: "var(--tl-position-support-strong-glow)",
  ESTABLISHED: "var(--tl-position-support-established-glow)",
  LIMITED: "var(--tl-position-support-limited-glow)",
};

/** Fixed pixel diameter per support band — always a true circle, independent of container aspect ratio. */
const SUPPORT_BAND_DIAMETER_PX: Record<PositionSupportBand, number> = {
  STRONGEST: 22,
  STRONG: 17,
  ESTABLISHED: 13,
  LIMITED: 10,
};

/** Glow blur radius (px) per support band — the glow's strength visually matches support strength. */
const SUPPORT_BAND_GLOW_BLUR_PX: Record<PositionSupportBand, number> = {
  STRONGEST: 16,
  STRONG: 11,
  ESTABLISHED: 6,
  LIMITED: 3,
};

const CONFIDENCE_OPACITY: Record<PositionEvidenceConfidence, number> = {
  HIGH: 1,
  MEDIUM: 0.75,
  LOW: 0.55,
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
  perspectiveScale = 1,
  selected = false,
  onSelect,
}: PositionEvidenceDotProps) {
  const diameter = SUPPORT_BAND_DIAMETER_PX[supportBand] * perspectiveScale;
  const glowBlur = SUPPORT_BAND_GLOW_BLUR_PX[supportBand] * perspectiveScale;
  const color = SUPPORT_BAND_COLOR[supportBand];
  const glow = SUPPORT_BAND_GLOW[supportBand];
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
      data-position-code={positionCode}
      aria-label={ariaLabel}
      aria-pressed={onSelect ? selected : undefined}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform",
        onSelect && "cursor-pointer hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
      )}
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        width: diameter,
        height: diameter,
        backgroundColor: color,
        opacity,
        boxShadow: `0 0 ${glowBlur}px ${glowBlur * 0.4}px ${glow}`,
        outline: selected
          ? "2px solid var(--accent)"
          : confidence === "HIGH"
            ? "1px solid rgba(255,255,255,0.35)"
            : "1px dashed rgba(255,255,255,0.28)",
        outlineOffset: 2,
      }}
    >
      <span className="sr-only">{ariaLabel}</span>
    </Tag>
  );
}
