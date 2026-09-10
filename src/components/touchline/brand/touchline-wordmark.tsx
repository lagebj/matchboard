import { cn } from "@/lib/cn";
import { TouchlineMark } from "./touchline-mark";

/**
 * TouchlineWordmark — the "MATCHBOARD" identity lockup used in the desktop
 * sidebar and the sign-in shell (golden: league-desktop, round-board-desktop).
 * Geist, letter-spaced caps — never condensed type for the product name.
 */
export function TouchlineWordmark({
  className,
  showMark = true,
}: {
  className?: string;
  showMark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[var(--foreground)]", className)}>
      {showMark ? <TouchlineMark className="h-[18px] w-[18px] text-[var(--accent)]" /> : null}
      <span className="text-[13px] font-semibold uppercase tracking-[0.22em]">Matchboard</span>
    </span>
  );
}
