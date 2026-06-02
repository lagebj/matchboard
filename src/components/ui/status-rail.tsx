import { cn } from "@/lib/cn";

/**
 * StatusRail — small visual state marker.
 *
 * Always includes text or accessible label. Not color-only.
 * For match cards, report states, round states.
 */
type StatusRailProps = {
  status:
    | "draft"
    | "finalized"
    | "locked"
    | "blocked"
    | "decision"
    | "missingReport"
    | "complete"
    | "neutral";
  label?: string;
  orientation?: "vertical" | "horizontal";
  className?: string;
};

const statusConfig: Record<
  StatusRailProps["status"],
  { text: string; dotClass: string; textClass: string }
> = {
  draft: {
    text: "Draft",
    dotClass: "bg-[var(--warning)]",
    textClass: "text-[var(--warning)]",
  },
  finalized: {
    text: "Finalized",
    dotClass: "bg-[var(--accent)]",
    textClass: "text-[var(--accent-strong)]",
  },
  locked: {
    text: "Locked",
    dotClass: "bg-[var(--locked)]",
    textClass: "text-[var(--locked)]",
  },
  blocked: {
    text: "Blocked",
    dotClass: "bg-[var(--danger)]",
    textClass: "text-[var(--danger)]",
  },
  decision: {
    text: "Decision",
    dotClass: "bg-[var(--warning)]",
    textClass: "text-[var(--warning)]",
  },
  missingReport: {
    text: "Report needed",
    dotClass: "bg-[var(--warning)]",
    textClass: "text-[var(--warning)]",
  },
  complete: {
    text: "Complete",
    dotClass: "bg-[var(--success)]",
    textClass: "text-[var(--success)]",
  },
  neutral: {
    text: "",
    dotClass: "",
    textClass: "",
  },
};

export function StatusRail({
  status,
  label,
  orientation = "horizontal",
  className,
}: StatusRailProps) {
  if (status === "neutral") return null;

  const config = statusConfig[status];
  const displayLabel = label ?? config.text;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5",
        orientation === "vertical" && "flex-col",
        className,
      )}
      aria-label={displayLabel}
      title={displayLabel}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full shrink-0",
          config.dotClass,
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider leading-none",
          config.textClass,
        )}
      >
        {displayLabel}
      </span>
    </div>
  );
}