import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * TouchlineInspector (bundle `09_WORKBENCH_GRAMMAR.md §3`,
 * `10_RESPONSIVE_AND_TOUCH_CONTRACT.md §9`, `12_COMPONENT_CONTRACTS.md §13`).
 *
 * Expanded-layout contextual secondary panel — shown only when the current
 * selection has meaningful inspectable content. 320–360 px, a lightly raised
 * opaque content surface (not glass unless literally floating over content).
 */
type Props = {
  /** Selection title, e.g. a player name. */
  title: string;
  /** One accent line — e.g. an exact positional fit ("Natural LW"). */
  headline?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function TouchlineInspector({ title, headline, children, className }: Props) {
  return (
    <aside
      aria-label="Inspector"
      className={cn(
        "flex w-[320px] shrink-0 flex-col gap-3 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Inspector
      </p>
      <div>
        <p className="text-[18px] font-[620] text-[var(--foreground)]">{title}</p>
        {headline ? <p className="mt-0.5 text-[13px] font-medium text-[var(--accent)]">{headline}</p> : null}
      </div>
      {children ? (
        <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] pt-3">{children}</div>
      ) : null}
    </aside>
  );
}

/** A labelled fact inside the inspector. */
export function InspectorFact({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: ReactNode;
  tone?: "neutral" | "evidence";
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-[14px] font-[600]",
          tone === "evidence" ? "text-[var(--tl-c-evidence)]" : "text-[var(--foreground)]",
        )}
      >
        {children}
      </p>
    </div>
  );
}
