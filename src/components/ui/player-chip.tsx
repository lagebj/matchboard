import { ArrowRightLeft, GripVertical, XCircle, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

/**
 * PlayerChip — single player display primitive.
 *
 * Per ADR 0007:
 * - Default chip shows name + small position + role marker.
 * - Verbose metadata (team, status, responsibility, readiness) belongs in
 *   selected state, tooltip, expanded row, or inspector — not on the default chip.
 * - Role colours are subtle and never visually imply permanent ranking.
 *
 * The chip is intentionally low-chrome: a soft surface, hairline border, small
 * type. Availability state (injured/sick/away) tints the chip border lightly.
 * Manual override / responsibility / negative readiness become small icons or
 * tiny markers — never large or saturated.
 */
export type PlayerChipAvailability = "OK" | "INJURED" | "SICK" | "AWAY";

export type PlayerChipRoleHint =
  | "CORE"
  | "SUPPORT"
  | "BACKFILL"
  | "DEVELOPMENT"
  | "CONFIDENCE_REBUILD"
  | "REDUCED_MATCH_LOAD_DROP"
  | "CORE_MATCH_DROP"
  | "DROPPED"
  | "UNAVAILABLE"
  | "MANUAL"
  | "MANUAL_OVERRIDE";

type PlayerChipMarker = {
  /** Short label (1-3 chars), e.g. "OVR", "CR", "CH". */
  label: string;
  /** Optional icon shown before label. */
  icon?: LucideIcon;
  /** Tooltip text. Provide a meaningful explanation. */
  title: string;
  /** Tone: 'neutral' (default), 'warning', 'info', 'danger', 'subtle'. */
  tone?: "neutral" | "warning" | "info" | "danger" | "subtle";
};

type PlayerChipProps = {
  name: string;
  position?: string | null;
  /**
   * The role-derived tone of the chip. Affects the left accent only — not
   * the entire chip — so the surface remains calm.
   */
  role?: PlayerChipRoleHint | null;
  availability?: PlayerChipAvailability | null;
  /** Small markers (manual override, responsibility, readiness signal). */
  markers?: PlayerChipMarker[];
  /** When true, the chip shows a drag handle and the grab cursor. */
  draggable?: boolean;
  /** Optional onRemove handler — renders an inline remove button on hover. */
  onRemove?: () => void;
  /**
   * Optional onMove handler — renders an explicit "Move to..." button. This is
   * the non-drag alternative to drag/drop (PROGRAMME.md §50): the caller opens
   * a destination picker rather than this component knowing about targets.
   */
  onMove?: () => void;
  /** Disable interactive controls (e.g., when round is finalized). */
  disabled?: boolean;
  /** Pending state (e.g., a server action is mid-flight). */
  pending?: boolean;
  /** Dim the chip while it's being touch-dragged. */
  isTouchDragging?: boolean;
  /** Tooltip on the player name. Defaults to `name`. */
  title?: string;
  /** Native drag handlers; passed through when draggable. */
  onDragStart?: (e: React.DragEvent) => void;
  onTouchStart?: () => void;
  className?: string;
  style?: CSSProperties;
};

const availabilityClasses: Record<PlayerChipAvailability, string> = {
  OK: "",
  INJURED: "border-[var(--danger)]/35 bg-[var(--danger-subtle)]",
  SICK: "border-[var(--warning)]/30 bg-[var(--warning-subtle)]",
  AWAY: "border-[var(--border-strong)] bg-[var(--surface-muted)]/60",
};

const roleAccentClasses: Partial<Record<PlayerChipRoleHint, string>> = {
  SUPPORT: "before:bg-[var(--info)]",
  BACKFILL: "before:bg-[var(--warning)]",
  DEVELOPMENT: "before:bg-[var(--dev)]",
  CONFIDENCE_REBUILD: "before:bg-[var(--info)]",
  REDUCED_MATCH_LOAD_DROP: "before:bg-[var(--warning)]",
  CORE_MATCH_DROP: "before:bg-[var(--danger)]",
  DROPPED: "before:bg-[var(--danger)]",
  CORE: "before:bg-[var(--accent)]/70",
  MANUAL: "before:bg-[var(--text-muted)]",
  MANUAL_OVERRIDE: "before:bg-[var(--warning)]",
};

const markerToneClasses: Record<NonNullable<PlayerChipMarker["tone"]>, string> = {
  neutral: "text-[var(--text-soft)]",
  warning: "text-[var(--warning)]",
  info: "text-[var(--info)]",
  danger: "text-[var(--danger)]",
  subtle: "text-[var(--text-muted)]",
};

const AVAILABILITY_LABEL: Record<PlayerChipAvailability, string> = {
  OK: "",
  INJURED: "unavailable",
  SICK: "sick",
  AWAY: "away",
};

export function PlayerChip({
  name,
  position,
  role,
  availability = "OK",
  markers = [],
  draggable = false,
  onRemove,
  onMove,
  disabled = false,
  pending = false,
  isTouchDragging = false,
  title,
  onDragStart,
  onTouchStart,
  className = "",
  style,
}: PlayerChipProps) {
  const accentClass = role ? roleAccentClasses[role] ?? "" : "";
  const isInteractive = draggable && !disabled;

  return (
    <div
      draggable={isInteractive}
      onDragStart={isInteractive && onDragStart ? onDragStart : undefined}
      onTouchStart={isInteractive && onTouchStart ? onTouchStart : undefined}
      title={title ?? name}
      style={style}
      className={[
        "group relative flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
        "border-[var(--border-soft)] bg-[var(--surface-muted)]/55",
        accentClass
          ? `before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r ${accentClass}`
          : "",
        accentClass ? "pl-2.5" : "",
        isInteractive
          ? "cursor-grab hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] active:cursor-grabbing"
          : "",
        availability && availability !== "OK" ? availabilityClasses[availability] : "",
        isTouchDragging ? "opacity-30" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isInteractive && (
        <GripVertical
          className="h-3 w-3 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden="true"
        />
      )}
      <span className="truncate text-zinc-100">{name}</span>
      {position && (
        <span
          className="shrink-0 text-[9px] uppercase tracking-wider text-[var(--text-muted)]"
          aria-label={`Position ${position}`}
        >
          {position}
        </span>
      )}
      {markers.map((marker, i) => {
        const Icon = marker.icon;
        const tone = marker.tone ?? "subtle";
        return (
          <span
            key={`${marker.label}-${i}`}
            className={`shrink-0 inline-flex items-center gap-0.5 text-[9px] font-medium uppercase tracking-wider ${markerToneClasses[tone]}`}
            title={marker.title}
          >
            {Icon && <Icon className="h-2.5 w-2.5" aria-hidden="true" />}
            {marker.label}
          </span>
        );
      })}
      {availability && availability !== "OK" && (
        <span
          className="shrink-0 text-[9px] uppercase tracking-wider text-[var(--text-muted)]"
          aria-label={AVAILABILITY_LABEL[availability]}
        >
          {AVAILABILITY_LABEL[availability]}
        </span>
      )}
      {onMove && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMove();
          }}
          disabled={pending}
          aria-label={`Move ${name} to...`}
          className={[
            "shrink-0 text-[var(--text-muted)] hover:text-[var(--accent-strong)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]/55 rounded-full",
            onRemove ? "" : "ml-auto",
          ].join(" ")}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
        </button>
      )}
      {onRemove && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          disabled={pending}
          aria-label={`Remove ${name}`}
          className={[
            "shrink-0 text-[var(--text-muted)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]/55 rounded-full",
            onMove ? "" : "ml-auto",
          ].join(" ")}
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
