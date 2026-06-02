import { cn } from "@/lib/cn";
import { Compass } from "lucide-react";

/**
 * IntentCard — make coaching intent visually central.
 *
 * Uses Compass icon. Feels like coaching intent, not system metadata.
 * Compact variant for fixture rows and round board columns.
 * Full variant for match detail and post-match report.
 */
type IntentCardProps = {
  title: string;
  focusAreas?: string[];
  note?: string | null;
  compact?: boolean;
  className?: string;
};

export function IntentCard({
  title,
  focusAreas = [],
  note,
  compact = false,
  className,
}: IntentCardProps) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-subtle)]/60",
        compact ? "px-2.5 py-1.5" : "px-3.5 py-2.5",
        className,
      )}
    >
      <Compass
        className={cn(
          "shrink-0 text-[var(--accent-strong)]",
          compact ? "h-3.5 w-3.5 mt-0.5" : "h-4 w-4 mt-0.5",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-medium text-zinc-100 leading-snug",
            compact ? "text-[11px]" : "text-sm",
          )}
        >
          {title}
        </p>
        {focusAreas.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {focusAreas.map((area) => (
              <span
                key={area}
                className="rounded-md border border-[var(--accent)]/20 bg-[var(--accent-subtle)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--accent-strong)]"
              >
                {area}
              </span>
            ))}
          </div>
        )}
        {note && !compact && (
          <p className="mt-1.5 text-xs text-[var(--text-soft)] leading-snug">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}