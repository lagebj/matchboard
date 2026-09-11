import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { cn } from "@/lib/cn";

/**
 * PlanningReadinessWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * Lineup/tactics/rotation readiness and safe-fit warnings — only states deterministically mapped
 * from existing planning states (no invented "percentage complete";
 * `docs/domain/touchline-atlas-provenance.md §0.14`).
 */
export type PlanningReadinessCheck = {
  key: string;
  label: string;
  complete: boolean;
};

export type PlanningReadinessWarning = {
  id: string;
  text: string; // reuse the domain's own diagnostic string verbatim (e.g. "No safe replacement for LW at 22 min")
};

export type PlanningReadinessWidgetProps = {
  checks: PlanningReadinessCheck[];
  warnings: PlanningReadinessWarning[];
  className?: string;
};

export function PlanningReadinessWidget({ checks, warnings, className }: PlanningReadinessWidgetProps) {
  const completeCount = checks.filter((c) => c.complete).length;

  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Planning readiness" title={`${completeCount}/${checks.length} complete`} />
      <ul className="mt-3 flex flex-col gap-2">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center gap-2.5 text-[13px]">
            <span
              aria-hidden="true"
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                c.complete ? "border-transparent bg-[var(--accent)]" : "border-[var(--border-strong)]",
              )}
            >
              {c.complete ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--tl-c-accent-on-fill)]" /> : null}
            </span>
            <span className={c.complete ? "text-[var(--foreground)]" : "text-[var(--text-muted)]"}>{c.label}</span>
          </li>
        ))}
      </ul>
      {warnings.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2 border-t border-[var(--border-soft)] pt-3">
          {warnings.map((w) => (
            <li key={w.id} className="rounded-[var(--tl-c-radius-control)] bg-[var(--warning-subtle)] px-3 py-2 text-[13px] text-[var(--warning)]">
              {w.text}
            </li>
          ))}
        </ul>
      ) : null}
    </TouchlineWidget>
  );
}
