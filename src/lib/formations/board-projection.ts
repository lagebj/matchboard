import { GRID_X_PERCENT, GRID_Y_PERCENT } from "./types";

export type BoardOrientation = "horizontal" | "vertical";
export type AttackingDirection = "left-to-right" | "right-to-left";

export type BoardProjectionOptions = {
  orientation?: BoardOrientation;
  attackingDirection?: AttackingDirection;
};

export type BoardPosition = {
  x: number;
  y: number;
};

export function getBoardPositionPercent(
  gridX: number,
  gridY: number,
  options?: BoardProjectionOptions,
): BoardPosition {
  const orientation = options?.orientation ?? "horizontal";
  const attackingDirection = options?.attackingDirection ?? "left-to-right";

  const modelX = GRID_X_PERCENT[gridX] ?? 50;
  const modelY = GRID_Y_PERCENT[gridY] ?? 50;

  if (orientation === "vertical") {
    return { x: modelX, y: modelY };
  }

  if (attackingDirection === "left-to-right") {
    return { x: 100 - modelY, y: modelX };
  }

  return { x: modelY, y: 100 - modelX };
}

export function getBoardAspectRatio(options?: BoardProjectionOptions): number {
  return options?.orientation === "vertical" ? 5 / 7 : 3 / 2;
}

export function getBoardViewBox(_options?: BoardProjectionOptions): string {
  return "0 0 100 100";
}