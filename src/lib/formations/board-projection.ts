import { GRID_X_PERCENT, GRID_Y_PERCENT } from "./types";

export type BoardOrientation = "horizontal" | "vertical";
export type AttackingDirection = "left-to-right" | "right-to-left";

export const PITCH_WIDTH = 105;
export const PITCH_HEIGHT = 68;

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
  if (options?.orientation === "vertical") return PITCH_HEIGHT / PITCH_WIDTH;
  return PITCH_WIDTH / PITCH_HEIGHT;
}

export function getBoardViewBox(options?: BoardProjectionOptions): string {
  if (options?.orientation === "vertical") {
    return `0 0 ${PITCH_HEIGHT} ${PITCH_WIDTH}`;
  }
  return `0 0 ${PITCH_WIDTH} ${PITCH_HEIGHT}`;
}