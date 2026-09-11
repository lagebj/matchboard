import { cn } from "@/lib/cn";
import { TouchlineBrandTile } from "./touchline-brand-tile";

/**
 * TouchlineWordmark — the "MATCHBOARD" identity lockup used in the desktop
 * sidebar and the sign-in shell (golden: shell-light-desktop,
 * round-board-desktop). Geist, letter-spaced caps — never condensed type for
 * the product name. Uses the compact `TouchlineBrandTile` identity tile
 * (Touchline Finish follow-up 03 §C) rather than a bare mark.
 */
export function TouchlineWordmark({
  className,
  showMark = true,
}: {
  className?: string;
  showMark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-[var(--foreground)]", className)}>
      {showMark ? <TouchlineBrandTile size={30} /> : null}
      <span className="text-[13px] font-semibold uppercase tracking-[0.22em]">Matchboard</span>
    </span>
  );
}
