import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BrandIllustration } from "@/components/ui/brand-illustration";
import type { brandIllustrations } from "@/lib/brand-illustrations";

type BrandIllustrationKey = keyof typeof brandIllustrations;

/**
 * EmptyState — explains why an area is empty and what to do next.
 *
 * Per ADR 0007: empty state copy must explain why the area is empty and what
 * must happen next. Vague text like "No data" is forbidden. Empty states must
 * not be visually heavier than real content.
 */
export type EmptyStateTone = "neutral" | "info";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: EmptyStateTone;
  illustration?: BrandIllustrationKey;
  className?: string;
};

const toneClasses: Record<EmptyStateTone, string> = {
  neutral:
    "bg-[var(--surface-muted)]/30 border-[var(--border-soft)] text-[var(--text-soft)]",
  info: "bg-[var(--info-subtle)] border-[var(--info)]/25 text-[var(--text-soft)]",
};

export function EmptyState({
  title,
  description,
  action,
  tone = "neutral",
  illustration,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={[
        "flex flex-col items-center gap-2 rounded-xl border px-6 py-8 text-center",
        toneClasses[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {illustration && (
        <BrandIllustration
          name={illustration}
          className="h-32 md:h-40 lg:h-48 w-auto opacity-85 dark:opacity-75"
        />
      )}
      <p className="text-sm font-medium text-zinc-100">{title}</p>
      {description && (
        <p className="text-xs text-[var(--text-muted)] max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
