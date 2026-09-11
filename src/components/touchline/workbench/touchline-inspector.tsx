import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PlayerContextHeader } from "./player-context-header";

/**
 * TouchlineInspector (bundle `09_WORKBENCH_GRAMMAR.md §3`,
 * `10_RESPONSIVE_AND_TOUCH_CONTRACT.md §9`, `12_COMPONENT_CONTRACTS.md §13`;
 * widened and re-anatomised by the Touchline Finish follow-up
 * `03_CODE_CHANGE_MAP.md §H`).
 *
 * Expanded-layout contextual secondary panel — shown only when the current
 * selection has meaningful inspectable content. 336–360 px, widget
 * background/border/shadow (not glass unless literally floating over
 * content), a stronger `PlayerContextHeader` identity block, and structured
 * sections rather than a generic vertical dump. No nested cards inside.
 */
type Props = {
  /** Selection title, e.g. a player name. */
  title: string;
  /** One accent line — e.g. an exact positional fit ("Natural LW"). */
  headline?: ReactNode;
  /** Optional identity token — shirt number, initials fallback. */
  number?: string | number | null;
  children?: ReactNode;
  className?: string;
};

export function TouchlineInspector({ title, headline, number, children, className }: Props) {
  return (
    <aside
      aria-label="Inspector"
      className={cn(
        "flex w-[352px] shrink-0 flex-col gap-4 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4 shadow-[var(--tl-widget-shadow)]",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Inspector
      </p>
      <PlayerContextHeader name={title} role={typeof headline === "string" ? headline : undefined} number={number} />
      {children ? (
        <div className="flex flex-col gap-4 border-t border-[var(--border-soft)] pt-4">{children}</div>
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
