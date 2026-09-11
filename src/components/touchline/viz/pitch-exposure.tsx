import { cn } from "@/lib/cn";
import { POSITION_GRID } from "@/components/ui/position-map";
import { getBoardPositionPercent } from "@/lib/formations/board-projection";
import { PitchMarkings } from "@/components/formations/tactics-board";

/**
 * PitchExposure (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §3`,
 * `08_WIDGET...` position-exposure requirement).
 *
 * Football pitch mini-map showing recorded positional exposure — dot size/opacity reflects real
 * recorded share, never an inferred ability. Reuses the same `POSITION_GRID`/`getBoardPositionPercent`
 * coordinate lookup `PositionMap` (`src/components/ui/position-map.tsx`) already uses — this is
 * NOT a second hard-coded position map, only a second *rendering* of the same canonical grid.
 * Pitch-line markings (touchlines, halfway line, centre circle, penalty/goal areas) reuse
 * `TacticsBoard`'s own `PitchMarkings` — not a second, hand-drawn set of pitch lines.
 */
export type PitchExposureEntry = {
  code: string;
  sharePercent: number;
};

export type PitchExposureProps = {
  question: string;
  entries: PitchExposureEntry[];
  className?: string;
};

export function PitchExposure({ question, entries, className }: PitchExposureProps) {
  const known = entries.filter((e) => POSITION_GRID[e.code] != null);
  const maxShare = Math.max(1, ...known.map((e) => e.sharePercent));

  const textEquivalent =
    known.length > 0
      ? known.map((e) => `${e.code} ${e.sharePercent}%`).join(", ")
      : "No recorded position exposure yet";

  return (
    <figure className={cn("flex flex-col gap-2", className)} aria-label={question}>
      <div className="tl-pitch-surface relative aspect-[105/68] w-full overflow-hidden" aria-hidden="true">
        <PitchMarkings orientation="horizontal" />
        {known.map((e) => {
          const { gridX, gridY } = POSITION_GRID[e.code];
          const { x, y } = getBoardPositionPercent(gridX, gridY, {
            orientation: "horizontal",
            attackingDirection: "left-to-right",
          });
          const isDominant = e.sharePercent === maxShare;
          const size = 10 + (e.sharePercent / maxShare) * 14;
          return (
            <span
              key={e.code}
              title={`${e.code} ${e.sharePercent}%`}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
                isDominant ? "bg-[var(--accent)]" : "bg-[var(--accent)]/45",
              )}
              style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
            />
          );
        })}
      </div>
      <figcaption className="sr-only">{textEquivalent}</figcaption>
      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-hidden="true">
        {known.map((e) => (
          <li key={e.code} className="text-[12px] text-[var(--text-soft)]">
            <span className="font-[600] text-[var(--foreground)]">{e.code}</span> {e.sharePercent}%
          </li>
        ))}
      </ul>
    </figure>
  );
}
