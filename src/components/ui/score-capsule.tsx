import { cn } from "@/lib/cn";

/**
 * ScoreCapsule — readable score and outcome display.
 *
 * Outcome always includes text, not color only.
 * Win/draw/loss styling is subtle — soft background tint, not saturated.
 */
export type ScoreCapsuleResult = "win" | "draw" | "loss" | "unknown";
export type ScoreCapsuleSize = "sm" | "md" | "lg";

type ScoreCapsuleProps = {
  homeScore?: number | null;
  awayScore?: number | null;
  result?: ScoreCapsuleResult;
  size?: ScoreCapsuleSize;
  className?: string;
};

const resultConfig: Record<
  ScoreCapsuleResult,
  { label: string; surfaceClass: string; textClass: string }
> = {
  win: {
    label: "W",
    surfaceClass: "bg-[var(--success-subtle)] border-[var(--success)]/25",
    textClass: "text-[var(--success)]",
  },
  draw: {
    label: "D",
    surfaceClass: "bg-[var(--surface-muted)]/50 border-[var(--border-soft)]",
    textClass: "text-[var(--text-soft)]",
  },
  loss: {
    label: "L",
    surfaceClass: "bg-[var(--danger-subtle)] border-[var(--danger)]/25",
    textClass: "text-[var(--danger)]",
  },
  unknown: {
    label: "",
    surfaceClass: "bg-[var(--surface-muted)]/30 border-[var(--border-soft)]",
    textClass: "text-[var(--text-muted)]",
  },
};

const sizeClasses: Record<ScoreCapsuleSize, string> = {
  sm: "text-[10px] px-2 py-0.5 gap-1.5",
  md: "text-xs px-3 py-1 gap-2",
  lg: "text-sm px-4 py-1.5 gap-3",
};

export function ScoreCapsule({
  homeScore,
  awayScore,
  result = "unknown",
  size = "md",
  className,
}: ScoreCapsuleProps) {
  const config = resultConfig[result];
  const hasScore = homeScore != null && awayScore != null;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border font-semibold tracking-wide",
        config.surfaceClass,
        sizeClasses[size],
        className,
      )}
    >
      {hasScore && (
        <span className="text-zinc-100 tabular-nums">
          {homeScore}–{awayScore}
        </span>
      )}
      {config.label && (
        <span className={cn("font-bold uppercase", config.textClass)}>
          {config.label}
        </span>
      )}
    </div>
  );
}