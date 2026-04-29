import { InboxIcon } from "lucide-react";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)]">
        {icon ?? <InboxIcon className="h-5 w-5 text-[var(--text-muted)]" />}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--foreground)]">
          {title}
        </p>
        {description && (
          <p className="text-xs text-[var(--text-muted)] max-w-[16rem]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}