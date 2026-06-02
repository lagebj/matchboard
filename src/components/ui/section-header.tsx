import type { ReactNode } from "react";

/**
 * SectionHeader — quiet, consistent section title.
 *
 * Per ADR 0007: hierarchy is created with type weight, not boxes. Uppercase is
 * reserved for small metadata eyebrows.
 */
type SectionHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
};

export function SectionHeader({
  title,
  description,
  eyebrow,
  actions,
}: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0 flex flex-col gap-0.5">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {description && (
          <p className="text-xs text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
      )}
    </div>
  );
}
