import { cn } from "@/lib/cn";

/**
 * IssueMarker — compact blocker/decision/note marker.
 *
 * Blocked = hard stop (red).
 * Decision = coach judgement needed (amber).
 * Note = information (slate).
 *
 * Does not render long warning paragraphs by default.
 * Use tooltip/popover for expanded detail.
 */
type IssueMarkerType = "blocked" | "decision" | "note";

type IssueMarkerProps = {
  type: IssueMarkerType;
  label: string;
  description?: string | null;
  count?: number;
  className?: string;
};

const typeConfig: Record<IssueMarkerType, { dotClass: string; textClass: string; bgClass: string }> = {
  blocked: {
    dotClass: "bg-[var(--danger)]",
    textClass: "text-[var(--danger)]",
    bgClass: "bg-[var(--danger-subtle)] border-[var(--danger)]/25",
  },
  decision: {
    dotClass: "bg-[var(--warning)]",
    textClass: "text-[var(--warning)]",
    bgClass: "bg-[var(--warning-subtle)] border-[var(--warning)]/25",
  },
  note: {
    dotClass: "bg-[var(--locked)]",
    textClass: "text-[var(--text-soft)]",
    bgClass: "bg-[var(--surface-muted)]/40 border-[var(--border-soft)]",
  },
};

export function IssueMarker({
  type,
  label,
  description,
  count,
  className,
}: IssueMarkerProps) {
  const config = typeConfig[type];

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-1.5",
        config.bgClass,
        className,
      )}
      role={type === "blocked" ? "alert" : "status"}
      title={description ?? label}
    >
      <span
        className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", config.dotClass)}
        aria-hidden="true"
      />
      <span className={cn("text-xs font-medium", config.textClass)}>
        {label}
      </span>
      {count != null && count > 1 && (
        <span className="ml-auto text-[10px] font-semibold tabular-nums text-[var(--text-muted)]">
          {count}
        </span>
      )}
    </div>
  );
}