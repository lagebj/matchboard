import { Shirt } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * PitchPlayerToken (Touchline Finish & Visual Convergence follow-up,
 * `06_TACTICS_LINEUP_AND_PITCH.md §3`; jersey silhouette added by Touchline
 * Design Atlas feedback, `docs/domain/touchline-atlas-provenance.md`) — the
 * canonical pitch player representation for lineup/tactics. A CSS/SVG
 * shirt-shaped token (`lucide-react`'s `Shirt` icon, already an app
 * dependency — no new icon pack, no generated image asset), not an external
 * image; shows a shirt number when known, otherwise initials. Name below the
 * token, exact target role below the name in muted text.
 *
 * No role-colour rainbow: the only state colours are the shared Touchline
 * accent (selected) and status tones (attention / unavailable). No team-kit
 * colour is inferred unless a canonical stored field already exists — the
 * one exception is `kit="goalkeeper"` (Touchline Design Atlas feedback),
 * which is not an invented per-team colour but the same real
 * goalkeeper/outfield distinction that already exists as canonical data
 * (`FormationSlotRoleType.GOALKEEPER`).
 */
export type PitchPlayerTokenStatus = "normal" | "attention" | "unavailable";
export type PitchPlayerTokenKit = "outfield" | "goalkeeper";

type Props = {
  name: string;
  /** Exact target role code shown under the name, e.g. "LW". */
  role?: string;
  number?: string | number | null;
  selected?: boolean;
  locked?: boolean;
  status?: PitchPlayerTokenStatus;
  /** Goalkeeper vs outfield — the one non-arbitrary colour distinction (see above). Default "outfield". */
  kit?: PitchPlayerTokenKit;
  onClick?: () => void;
  compact?: boolean;
  /** Hide the name/role text below the token — used where a caller renders its own identity block. */
  showLabel?: boolean;
  className?: string;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PitchPlayerToken({
  name,
  role,
  number,
  selected = false,
  locked = false,
  status = "normal",
  kit = "outfield",
  onClick,
  compact = false,
  showLabel = true,
  className,
}: Props) {
  const Tag = onClick ? "button" : "div";
  const sizeClass = compact ? "h-10 w-10" : "h-12 w-12 medium:h-14 medium:w-14";
  const label = number != null && number !== "" ? String(number) : initialsFor(name);
  const fillColor = selected ? "var(--accent-subtle)" : kit === "goalkeeper" ? "var(--warning-subtle)" : "var(--tl-c-surface-strong)";
  const strokeColor = selected
    ? "var(--accent)"
    : status === "attention"
      ? "var(--warning)"
      : kit === "goalkeeper"
        ? "var(--warning)"
        : "var(--tl-widget-border)";

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
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative flex items-center justify-center transition-transform duration-[var(--tl-c-motion-state)]",
          sizeClass,
          onClick && "group-hover:scale-105",
        )}
      >
        <Shirt
          aria-hidden="true"
          className="absolute inset-0 h-full w-full drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={selected ? 2 : 1.5}
        />
        <span
          className={cn(
            "relative z-[1] mt-[15%] font-[700] tabular-nums text-[var(--foreground)]",
            compact ? "text-[12px]" : "text-[14px]",
          )}
        >
          {label}
        </span>
        {locked ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 z-[1] flex h-4 w-4 items-center justify-center rounded-full bg-[var(--tl-c-canvas-raised)] text-[9px] text-[var(--accent)] ring-1 ring-[var(--border-strong)]"
          >
            ●
          </span>
        ) : null}
      </span>
      {showLabel ? (
        <>
          <span className="max-w-[72px] truncate text-[11px] font-[600] leading-tight text-[var(--foreground)]">
            {name}
          </span>
          {role ? (
            <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">
              {role}
            </span>
          ) : null}
        </>
      ) : null}
    </Tag>
  );
}

/**
 * PitchEmptySlot — a dashed, unfilled formation slot. Shows the exact target
 * role code; a plus icon only when editable. No saturated role background.
 */
type EmptySlotProps = {
  role: string;
  editable?: boolean;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
};

export function PitchEmptySlot({ role, editable = false, onClick, compact = false, className }: EmptySlotProps) {
  const Tag = editable && onClick ? "button" : "div";
  const sizeClass = compact ? "h-10 w-10" : "h-12 w-12 medium:h-14 medium:w-14";
  return (
    <Tag
      {...(editable && onClick ? { type: "button" as const, onClick } : {})}
      aria-label={`${role}: empty${editable ? ", tap to assign" : ""}`}
      className={cn("group flex flex-col items-center gap-1 text-center", editable && onClick && "cursor-pointer", className)}
    >
      <span aria-hidden="true" className={cn("relative flex items-center justify-center", sizeClass)}>
        <Shirt
          aria-hidden="true"
          className={cn(
            "absolute inset-0 h-full w-full transition-colors duration-[var(--tl-c-motion-state)]",
            editable && onClick && "group-hover:[stroke:var(--accent)]",
          )}
          fill="none"
          stroke="var(--tl-pitch-border)"
          strokeWidth={1.5}
          strokeDasharray="3 2.5"
        />
        <span
          className={cn(
            "relative z-[1] mt-[15%] text-[11px] font-[700] uppercase tracking-[0.04em] text-[var(--text-muted)] transition-colors duration-[var(--tl-c-motion-state)]",
            editable && onClick && "group-hover:text-[var(--accent)]",
          )}
        >
          {role}
        </span>
        {editable ? (
          <span className="absolute -bottom-1 -right-1 z-[1] flex h-4 w-4 items-center justify-center rounded-full bg-[var(--tl-c-canvas-raised)] text-[10px] leading-none text-[var(--text-muted)] ring-1 ring-[var(--tl-pitch-border)]">
            +
          </span>
        ) : null}
      </span>
    </Tag>
  );
}
