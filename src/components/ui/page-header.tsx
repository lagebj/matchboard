import type { ReactNode } from "react";

/**
 * PageHeader — standard page-level title, description, context, and primary action.
 *
 * Per ADR 0007: page title is visually dominant; context is quiet; primary action
 * is right-aligned and used sparingly. Avoid large empty hero blocks.
 */
type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  context?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  eyebrow,
  description,
  context,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0 flex flex-col gap-1">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--text-muted)] max-w-2xl">
            {description}
          </p>
        )}
        {context && (
          <div className="text-xs text-[var(--text-muted)] mt-0.5">{context}</div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}
