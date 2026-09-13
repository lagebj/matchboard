import { Shirt } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * TeamKitMark (Atlas Follow-up, `05_SHIRT_IDENTITY_AND_TEAM_KIT_COLOR.md`).
 *
 * The one reusable, generated shirt-identity primitive for teams and players. One geometry
 * (`lucide-react`'s `Shirt` icon, already an app dependency — no external image, no per-colour
 * asset file, no generated portrait). Dynamic SVG fill from a resolved kit colour, with an
 * automatically-computed readable number colour — never a hardcoded light/dark assumption.
 *
 * `PitchShirtToken` (planning-pitch context) and the existing `PitchPlayerToken`
 * (`src/components/touchline/pitch/pitch-player-token.tsx`, pre-Atlas-Follow-up) both compose
 * this same geometry rather than maintaining a second shirt SVG — see
 * `08_VIEW_MODELS_AND_COMPONENT_CONTRACTS.md §8`. Migrating `PitchPlayerToken` onto this
 * primitive is Phase F2/F7 work, not done in this Phase F1 commit.
 *
 * Encodes ONLY the team kit colour and (when known) the shirt number. Position is never encoded
 * in shirt shape or colour (contract §5) — it stays textual wherever it's shown alongside.
 */
export type TeamKitMarkSize = "xs" | "sm" | "md" | "lg" | "hero";

export type TeamKitMarkProps = {
  /** A resolved CSS colour (hex/rgb) for the shirt fill — see `resolveKitColorSwatch()` in `src/lib/teams/kit-color.ts`. `null`/unset renders the neutral Touchline shirt. */
  color?: string | null;
  number?: string | number | null;
  size?: TeamKitMarkSize;
  /** Accent halo/outline, e.g. the currently-selected player/team in an inspector or roster row. */
  selected?: boolean;
  /** Reduced opacity — e.g. an unavailable/not-selected player. */
  muted?: boolean;
  ariaLabel?: string;
  className?: string;
};

const SIZE_PX: Record<TeamKitMarkSize, number> = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 56,
  hero: 96,
};

const NUMBER_TEXT_PX: Record<TeamKitMarkSize, number> = {
  xs: 8,
  sm: 10,
  md: 13,
  lg: 17,
  hero: 28,
};

const NEUTRAL_FILL = "var(--tl-c-surface-strong)";
const NEUTRAL_STROKE = "var(--tl-widget-border)";
const NEUTRAL_TEXT = "var(--foreground)";

/**
 * Relative-luminance contrast, not a fixed light/dark palette guess — works for any resolved
 * hex, present or future. Returns near-black or near-white, matched loosely to this app's own
 * dark/light foreground tones rather than pure `#000`/`#fff`.
 */
export function getReadableTextColor(hex: string): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "#ffffff";
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return luminance > 0.5 ? "#101014" : "#f5f5f5";
}

export function TeamKitMark({
  color,
  number,
  size = "md",
  selected = false,
  muted = false,
  ariaLabel,
  className,
}: TeamKitMarkProps) {
  const px = SIZE_PX[size];
  const fill = color ? color : NEUTRAL_FILL;
  const stroke = selected ? "var(--accent)" : color ? color : NEUTRAL_STROKE;
  const textColor = color ? getReadableTextColor(color) : NEUTRAL_TEXT;
  const label = number != null && number !== "" ? String(number) : null;
  const numberFontPx = NUMBER_TEXT_PX[size];

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? (label ? `Shirt, number ${label}` : "Shirt")}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        muted && "opacity-45",
        selected && "drop-shadow-[0_0_0_2px_var(--accent)]",
        className,
      )}
      style={{ width: px, height: px }}
    >
      <Shirt
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 2 : 1.5}
      />
      {label ? (
        <span
          aria-hidden="true"
          className="relative z-[1] mt-[15%] font-[700] tabular-nums"
          style={{ color: textColor, fontSize: numberFontPx }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
