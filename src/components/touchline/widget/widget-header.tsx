import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * WidgetHeader (`04_WIDGET_AND_CONTENT_GRAMMAR.md §3`) — the header row inside
 * a `TouchlineWidget`: an optional uppercase eyebrow, a title, an optional
 * description, and at most one trailing action.
 */
type Props = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function WidgetHeader({ eyebrow, title, description, action, className }: Props) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h3 className={cn("text-[18px] font-[620] leading-snug text-[var(--foreground)]", eyebrow && "mt-0.5")}>
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-snug text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
