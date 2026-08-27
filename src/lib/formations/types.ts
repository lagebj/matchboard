import type { GameFormat } from "@/generated/prisma/client";

export type GridCoordinate = {
  x: 0 | 1 | 2 | 3 | 4;
  y: 0 | 1 | 2 | 3 | 4 | 5;
};

export const WIDTH_LANES = ["left_wide", "left_half", "centre", "right_half", "right_wide"] as const;
export const DEPTH_LANES = ["attack", "attacking_midfield", "midfield", "defensive_midfield", "defence", "goalkeeper_or_deep"] as const;

export type WidthLane = (typeof WIDTH_LANES)[number];
export type DepthLane = (typeof DEPTH_LANES)[number];

export const GRID_WIDTH = 5;
export const GRID_HEIGHT = 6;

export const GRID_X_PERCENT: Record<number, number> = {
  0: 12,
  1: 31,
  2: 50,
  3: 69,
  4: 88,
};

export const GRID_Y_PERCENT: Record<number, number> = {
  0: 12,
  1: 27,
  2: 42,
  3: 58,
  4: 73,
  5: 88,
};

export const WIDTH_LANE_LABELS: Record<number, string> = {
  0: "Left wide",
  1: "Left half",
  2: "Centre",
  3: "Right half",
  4: "Right wide",
};

export const DEPTH_LANE_LABELS: Record<number, string> = {
  0: "Attack",
  1: "Attacking midfield",
  2: "Midfield",
  3: "Defensive midfield",
  4: "Defence",
  5: "Goalkeeper / Deep",
};

export type FormationSlotRoleType =
  | "GOALKEEPER"
  | "DEFENDER"
  | "DEFENSIVE_MIDFIELDER"
  | "MIDFIELDER"
  | "ATTACKING_MIDFIELDER"
  | "FORWARD"
  | "FREE";

export type FormationSource = "SYSTEM" | "CUSTOM";

export type FormationSlotData = {
  id?: string;
  gridX: number;
  gridY: number;
  label: string;
  shortLabel: string;
  roleType: FormationSlotRoleType;
  acceptedPositionIds: string[];
  sortOrder: number;
};

export type FormationData = {
  id?: string;
  name: string;
  gameFormat: GameFormat;
  source: FormationSource;
  teamId?: string | null;
  createdByUserId?: string | null;
  description?: string | null;
  isArchived: boolean;
  slots: FormationSlotData[];
};

export type FormationSnapshot = {
  formationId: string;
  formationName: string;
  gameFormat: GameFormat;
  slots: {
    slotId: string;
    gridX: number;
    gridY: number;
    label: string;
    shortLabel: string;
    roleType: FormationSlotRoleType;
    acceptedPositionIds: string[];
    sortOrder: number;
  }[];
};

export type BroadPosition = "goalkeeper" | "defender" | "midfielder" | "forward" | "flexible";

export const BROAD_POSITIONS: BroadPosition[] = ["goalkeeper", "defender", "midfielder", "forward", "flexible"];

export const BROAD_POSITION_LABELS: Record<BroadPosition, string> = {
  goalkeeper: "Goalkeeper",
  defender: "Defender",
  midfielder: "Midfielder",
  forward: "Forward",
  flexible: "Flexible",
};

export const ROLE_TYPE_LABELS: Record<FormationSlotRoleType, string> = {
  GOALKEEPER: "Goalkeeper",
  DEFENDER: "Defender",
  DEFENSIVE_MIDFIELDER: "Defensive midfielder",
  MIDFIELDER: "Midfielder",
  ATTACKING_MIDFIELDER: "Attacking midfielder",
  FORWARD: "Forward",
  FREE: "Free",
};

export const GAME_FORMAT_PLAYERS: Record<GameFormat, number> = {
  THREE_A_SIDE: 3,
  FIVE_A_SIDE: 5,
  SEVEN_A_SIDE: 7,
  NINE_A_SIDE: 9,
  ELEVEN_A_SIDE: 11,
};

export function formatGameFormatLabel(gameFormat: GameFormat | string): string {
  switch (gameFormat) {
    case "THREE_A_SIDE": return "3-a-side";
    case "FIVE_A_SIDE": return "5-a-side";
    case "SEVEN_A_SIDE": return "7-a-side";
    case "NINE_A_SIDE": return "9-a-side";
    case "ELEVEN_A_SIDE": return "11-a-side";
    default: return String(gameFormat);
  }
}

export function formatGameFormatShort(gameFormat: GameFormat | string): string {
  switch (gameFormat) {
    case "THREE_A_SIDE": return "3v3";
    case "FIVE_A_SIDE": return "5v5";
    case "SEVEN_A_SIDE": return "7v7";
    case "NINE_A_SIDE": return "9v9";
    case "ELEVEN_A_SIDE": return "11v11";
    default: return String(gameFormat);
  }
}

export function isValidGridX(x: number): boolean {
  return Number.isInteger(x) && x >= 0 && x <= 4;
}

export function isValidGridY(y: number): boolean {
  return Number.isInteger(y) && y >= 0 && y <= 5;
}

export function getGridPositionPercent(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: GRID_X_PERCENT[gridX] ?? 50,
    y: GRID_Y_PERCENT[gridY] ?? 50,
  };
}

/**
 * Football line classification (GK/DEF/MID/ATT), derived from a formation slot's role type.
 * Canonical source for combination-topology line/lane derivation (see COMBINATION_TOPOLOGY.md) —
 * do not re-derive line from a role-type or position-label string anywhere else.
 */
export type PositionLine = "GK" | "DEF" | "MID" | "ATT";

/**
 * FREE has no reliable line (used for flexible slots in custom formations) — mapping it to a
 * fixed line would manufacture structure that does not exist. Callers must treat `null` as
 * unknown, never as a missing case to guess at.
 */
export const ROLE_TYPE_TO_LINE: Record<FormationSlotRoleType, PositionLine | null> = {
  GOALKEEPER: "GK",
  DEFENDER: "DEF",
  DEFENSIVE_MIDFIELDER: "MID",
  MIDFIELDER: "MID",
  ATTACKING_MIDFIELDER: "MID",
  FORWARD: "ATT",
  FREE: null,
};

export type PositionLane = "LEFT" | "CENTRE" | "RIGHT";

/**
 * Lane classification from a formation slot's gridX (0-4, left to right). Lane is only
 * meaningful relative to a specific slot's horizontal grid position — never parse it from a
 * label/shortLabel string, which is free-form author-chosen text.
 */
export function laneFromGridX(gridX: number): PositionLane {
  if (gridX <= 1) return "LEFT";
  if (gridX >= 3) return "RIGHT";
  return "CENTRE";
}