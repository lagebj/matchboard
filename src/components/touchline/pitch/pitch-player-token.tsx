import { cn } from "@/lib/cn";

/**
 * PitchPlayerToken (Touchline Finish & Visual Convergence follow-up,
 * `06_TACTICS_LINEUP_AND_PITCH.md §3`) — the canonical pitch player
 * representation for lineup/tactics. A simple CSS/SVG shirt-like token, not
 * an external image; shows a shirt number when known, otherwise initials.
 * Name below the token, exact target role below the name in muted text.
 *
 * No role-colour rainbow: the only state colours are the shared Touchline
 * accent (selected) and status tones (attention / unavailable). No team-kit
 * colour is inferred unless a canonical stored field already exists.
 */
export type PitchPlayerTokenStatus = "normal" | "attention" | "unavailable";

type Props = {
  name: string;
  /** Exact target role code shown under the name, e.g. "LW". */
  role?: string;
  number?: string | number | null;
  selected?: boolean;
  locked?: boolean;
  status?: PitchPlayerTokenStatus;
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
  onClick,
  compact = false,
  showLabel = true,
  className,
}: Props) {
  const Tag = onClick ? "button" : "div";
  const sizeClass = compact ? "h-10 w-10" : "h-12 w-12 medium:h-14 medium:w-14";
  const label = number != null && number !== "" ? String(number) : initialsFor(name);

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
          "relative flex items-center justify-center rounded-[10px] border font-[700] tabular-nums shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform duration-[var(--tl-c-motion-state)]",
          sizeClass,
          compact ? "text-[13px]" : "text-[15px]",
          selected
            ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--foreground)] ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--tl-pitch)]"
            : "border-[var(--tl-c-surface-strong)] bg-[var(--tl-c-surface-strong)] text-[var(--foreground)]",
          status === "attention" && !selected && "border-[var(--warning)]",
          onClick && "group-hover:scale-105",
        )}
      >
        {label}
        {locked ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--tl-c-canvas-raised)] text-[9px] text-[var(--accent)] ring-1 ring-[var(--border-strong)]"
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
      className={cn("flex flex-col items-center gap-1 text-center", editable && onClick && "cursor-pointer", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative flex items-center justify-center rounded-[10px] border-2 border-dashed border-[var(--tl-pitch-border)] bg-transparent text-[11px] font-[700] uppercase tracking-[0.04em] text-[var(--text-muted)] transition-colors duration-[var(--tl-c-motion-state)]",
          sizeClass,
          editable && onClick && "hover:border-[var(--accent)] hover:text-[var(--accent)]",
        )}
      >
        {role}
        {editable ? (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--tl-c-canvas-raised)] text-[10px] leading-none text-[var(--text-muted)] ring-1 ring-[var(--tl-pitch-border)]">
            +
          </span>
        ) : null}
      </span>
    </Tag>
  );
}
