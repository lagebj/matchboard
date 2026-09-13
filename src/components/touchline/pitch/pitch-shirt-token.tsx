import { cn } from "@/lib/cn";
import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import type { PitchShirtTokenStatus } from "./types";

/**
 * `PitchShirtToken` (Atlas Follow-up, `06_CANONICAL_PITCH_RENDERING_CONTRACT.md §6`,
 * `08_VIEW_MODELS_AND_COMPONENT_CONTRACTS.md §8`). Composes `TeamKitMark` — one geometry, not a
 * second shirt SVG — for placement on `TouchlinePlanningPitch`. The "alignment" the contract asks
 * for comes from consistent projected position + scale + grounding shadow + spacing, not from
 * rotating the shirt art itself into a fake 3D angle.
 */
export type PitchShirtTokenProps = {
  name: string;
  /** Exact target role code shown under the name, e.g. "LW". */
  role?: string;
  number?: string | number | null;
  /** Resolved kit-colour hex (see `resolveKitColorSwatch()`), or `null` for the neutral shirt. */
  kitColor?: string | null;
  selected?: boolean;
  locked?: boolean;
  status?: PitchShirtTokenStatus;
  isGoalkeeper?: boolean;
  /** 0..1+ depth scale from the pitch projection — near-goal tokens render slightly larger. */
  perspectiveScale?: number;
  onClick?: () => void;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
};

export function PitchShirtToken({
  name,
  role,
  number,
  kitColor,
  selected = false,
  locked = false,
  status = "normal",
  isGoalkeeper = false,
  perspectiveScale = 1,
  onClick,
  compact = false,
  showLabel = true,
  className,
}: PitchShirtTokenProps) {
  const Tag = onClick ? "button" : "div";
  const markSize = compact ? "sm" : "md";
  const color = isGoalkeeper && !kitColor ? "var(--tl-gk-kit)" : kitColor;

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      aria-label={role ? `${name} — ${role}` : name}
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        "group flex flex-col items-center gap-1 text-center",
        onClick && "cursor-pointer",
        status === "unavailable" && "opacity-45",
        className,
      )}
      style={{ transform: `scale(${perspectiveScale})`, transformOrigin: "50% 100%" }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative drop-shadow-[0_6px_8px_rgba(0,0,0,0.35)] transition-transform duration-[var(--tl-c-motion-state)]",
          onClick && "group-hover:scale-105",
        )}
      >
        <TeamKitMark
          color={color}
          number={number}
          size={markSize}
          selected={selected}
          muted={status === "unavailable"}
        />
        {locked ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 z-[1] flex h-4 w-4 items-center justify-center rounded-full bg-[var(--tl-c-canvas-raised)] text-[9px] text-[var(--accent)] ring-1 ring-[var(--border-strong)]"
          >
            ●
          </span>
        ) : null}
        {status === "attention" ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 z-[1] h-2.5 w-2.5 rounded-full bg-[var(--warning)] ring-2 ring-[var(--tl-pitch)]"
          />
        ) : null}
      </span>
      {showLabel ? (
        <>
          <span className="max-w-[72px] truncate text-[11px] font-[600] leading-tight text-[var(--tl-foreground)]">
            {name}
          </span>
          {role ? (
            <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--tl-text-muted)]">
              {role}
            </span>
          ) : null}
        </>
      ) : null}
    </Tag>
  );
}

/**
 * An unfilled formation slot on `TouchlinePlanningPitch`. Dashed, no saturated fill.
 */
export function PitchEmptySlot({
  role,
  editable = false,
  onClick,
  compact = false,
  className,
  ariaLabel,
}: {
  role: string;
  editable?: boolean;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
  /** Overrides the default "Empty slot: {role}" phrasing — for a non-assignment use of the same
   * dashed-circle visual, e.g. the Formations editor's "add a slot here" grid cell. */
  ariaLabel?: string;
}) {
  const Tag = onClick ? "button" : "div";
  const size = compact ? "h-9 w-9" : "h-11 w-11";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      aria-label={ariaLabel ?? (editable ? `Empty slot: ${role}. Assign a player.` : `Empty slot: ${role}`)}
      className={cn(
        "flex flex-col items-center gap-1 text-center",
        editable && "cursor-pointer group",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-full border border-dashed border-[var(--tl-pitch-border)] text-[10px] font-semibold text-[var(--tl-text-muted)] transition-colors",
          editable && "group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]",
          size,
        )}
      >
        {role}
      </span>
    </Tag>
  );
}
