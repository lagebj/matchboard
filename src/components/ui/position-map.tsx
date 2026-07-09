"use client";

import { cn } from "@/lib/cn";
import {
  TacticsBoard,
  type TacticsBoardPositionMarker,
} from "@/components/formations/tactics-board";
import { getBoardPositionPercent } from "@/lib/formations/board-projection";

type PositionMapProps = {
  primaryPosition?: string | null;
  secondaryPositions?: string[];
  size?: "sm" | "md" | "lg";
  className?: string;
};

const POSITION_GRID: Record<string, { gridX: number; gridY: number }> = {
  GK: { gridX: 2, gridY: 5 },
  CB: { gridX: 2, gridY: 4 },
  LB: { gridX: 0, gridY: 4 },
  RB: { gridX: 4, gridY: 4 },
  CM: { gridX: 2, gridY: 2 },
  DM: { gridX: 2, gridY: 3 },
  AM: { gridX: 2, gridY: 1 },
  LM: { gridX: 0, gridY: 2 },
  WM: { gridX: 1, gridY: 1 },
  LW: { gridX: 0, gridY: 0 },
  RW: { gridX: 4, gridY: 0 },
  RM: { gridX: 4, gridY: 2 },
  W: { gridX: 1, gridY: 0 },
  ST: { gridX: 2, gridY: 0 },
  CF: { gridX: 2, gridY: 0 },
};

const SIZE_MAP: Record<string, "compact" | "standard" | "wide"> = {
  sm: "compact",
  md: "standard",
  lg: "wide",
};

export function PositionMap({
  primaryPosition,
  secondaryPositions = [],
  size = "md",
  className,
}: PositionMapProps) {
  const boardSize = SIZE_MAP[size] ?? "standard";

  const markers: TacticsBoardPositionMarker[] = [];

  for (const pos of secondaryPositions) {
    if (pos === primaryPosition) continue;
    const coords = POSITION_GRID[pos];
    if (!coords) continue;
    const { x, y } = getBoardPositionPercent(coords.gridX, coords.gridY, {
      orientation: "horizontal",
      attackingDirection: "left-to-right",
    });
    markers.push({ pos, x, y, isPrimary: false });
  }

  if (primaryPosition) {
    const coords = POSITION_GRID[primaryPosition];
    if (coords) {
      const { x, y } = getBoardPositionPercent(coords.gridX, coords.gridY, {
        orientation: "horizontal",
        attackingDirection: "left-to-right",
      });
      markers.push({ pos: primaryPosition, x, y, isPrimary: true });
    }
  }

  return (
    <TacticsBoard
      mode="position-profile"
      orientation="horizontal"
      attackingDirection="left-to-right"
      size={boardSize}
      markers={markers}
      className={cn(className)}
    />
  );
}