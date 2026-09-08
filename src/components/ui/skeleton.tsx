import { cn } from "@/lib/cn";

/**
 * Skeleton — a single muted placeholder block. Decorative (`aria-hidden`); the parent
 * container owns the accessible "loading" status. The pulse is an opacity animation, so the
 * global `prefers-reduced-motion` rule freezes it to a static block — still a valid loading
 * affordance, never a frozen spinner.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-[var(--surface-muted)]", className)}
    />
  );
}

/**
 * PageSkeleton — a layout-preserving loading fallback for a primary surface: a title block
 * followed by a few content rows, at the same width/rhythm as real content, so there is no
 * jarring spinner→content jump that moves the primary action (ADR-0124 §18). Use it as the
 * `loading.tsx` for App Router routes and as the first-load fallback in client surfaces.
 */
export function PageSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={cn("flex flex-col gap-4", className)}>
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
