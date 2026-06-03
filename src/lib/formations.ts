import { GAME_FORMAT_PLAYERS } from "./formations/types";
import { formatGameFormatShort } from "./formations/types";

export type LegacyFormationSlot = {
  slot: string;
  row: number;
  col: number;
};

export type LegacyFormation = {
  id: string;
  label: string;
  gameFormat: string;
  slots: LegacyFormationSlot[];
  cols: number;
};

const FORMATIONS: LegacyFormation[] = [
  {
    id: "7v7-1-2-3-1",
    label: "7v7 · 1-2-3-1",
    gameFormat: "SEVEN_A_SIDE",
    cols: 3,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "CB1", row: 1, col: 0 },
      { slot: "CB2", row: 1, col: 2 },
      { slot: "CM", row: 2, col: 1 },
      { slot: "RM", row: 2, col: 2 },
      { slot: "LM", row: 2, col: 0 },
      { slot: "ST", row: 3, col: 1 },
    ],
  },
  {
    id: "7v7-1-3-2-1",
    label: "7v7 · 1-3-2-1",
    gameFormat: "SEVEN_A_SIDE",
    cols: 3,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "CB", row: 1, col: 1 },
      { slot: "RM", row: 1, col: 2 },
      { slot: "LM", row: 1, col: 0 },
      { slot: "CM1", row: 2, col: 0 },
      { slot: "CM2", row: 2, col: 2 },
      { slot: "ST", row: 3, col: 1 },
    ],
  },
  {
    id: "9v9-1-3-3-2",
    label: "9v9 · 1-3-3-2",
    gameFormat: "NINE_A_SIDE",
    cols: 3,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "CB1", row: 1, col: 0 },
      { slot: "CB2", row: 1, col: 1 },
      { slot: "CB3", row: 1, col: 2 },
      { slot: "RM", row: 2, col: 2 },
      { slot: "CM1", row: 2, col: 1 },
      { slot: "LM", row: 2, col: 0 },
      { slot: "ST1", row: 3, col: 0 },
      { slot: "ST2", row: 3, col: 2 },
    ],
  },
  {
    id: "9v9-1-3-2-3",
    label: "9v9 · 1-3-2-3",
    gameFormat: "NINE_A_SIDE",
    cols: 3,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "CB1", row: 1, col: 0 },
      { slot: "CB2", row: 1, col: 1 },
      { slot: "CB3", row: 1, col: 2 },
      { slot: "CM1", row: 2, col: 0 },
      { slot: "CM2", row: 2, col: 2 },
      { slot: "RW", row: 3, col: 2 },
      { slot: "ST", row: 3, col: 1 },
      { slot: "LW", row: 3, col: 0 },
    ],
  },
  {
    id: "11v11-4-3-3",
    label: "11v11 · 4-3-3",
    gameFormat: "ELEVEN_A_SIDE",
    cols: 3,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "RB", row: 1, col: 2 },
      { slot: "CB1", row: 1, col: 1 },
      { slot: "CB2", row: 1, col: 0 },
      { slot: "LB", row: 1, col: 0 },
      { slot: "CM1", row: 2, col: 0 },
      { slot: "CM2", row: 2, col: 1 },
      { slot: "CM3", row: 2, col: 2 },
      { slot: "RW", row: 3, col: 2 },
      { slot: "ST", row: 3, col: 1 },
      { slot: "LW", row: 3, col: 0 },
    ],
  },
  {
    id: "11v11-4-4-2",
    label: "11v11 · 4-4-2",
    gameFormat: "ELEVEN_A_SIDE",
    cols: 4,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "RB", row: 1, col: 3 },
      { slot: "CB1", row: 1, col: 2 },
      { slot: "CB2", row: 1, col: 1 },
      { slot: "LB", row: 1, col: 0 },
      { slot: "RM", row: 2, col: 3 },
      { slot: "CM1", row: 2, col: 2 },
      { slot: "CM2", row: 2, col: 1 },
      { slot: "LM", row: 2, col: 0 },
      { slot: "ST1", row: 3, col: 2 },
      { slot: "ST2", row: 3, col: 1 },
    ],
  },
];

export function getFormationsForFormat(gameFormat: string): LegacyFormation[] {
  return FORMATIONS.filter((f) => f.gameFormat === gameFormat);
}

export function getDefaultFormation(gameFormat: string): LegacyFormation {
  const formations = getFormationsForFormat(gameFormat);
  return formations[0] ?? FORMATIONS[0];
}

export function getFormationById(id: string): LegacyFormation | undefined {
  return FORMATIONS.find((f) => f.id === id);
}

export { GAME_FORMAT_PLAYERS, formatGameFormatShort };

export {
  WIDTH_LANES,
  DEPTH_LANES,
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_X_PERCENT,
  GRID_Y_PERCENT,
  WIDTH_LANE_LABELS,
  DEPTH_LANE_LABELS,
  BROAD_POSITIONS,
  BROAD_POSITION_LABELS,
  ROLE_TYPE_LABELS,
  formatGameFormatLabel,
  isValidGridX,
  isValidGridY,
  suggestSlotDefaults,
  SYSTEM_FORMATIONS,
  getSystemFormationsForFormat,
  seedSystemFormations,
  validateFormationForMatchUse,
  isValidSlotInFormat,
  isValidRoleType,
  mapExistingPositionToBroad,
  getPlayerSlotCompatibility,
  sortPlayersBySlotCompatibility,
  getPlayersForLineup,
  createFormationSnapshot,
} from "./formations/index";

export type {
  GridCoordinate,
  WidthLane,
  DepthLane,
  FormationSlotRoleType,
  FormationSource,
  FormationSlotData,
  FormationData,
  FormationSnapshot,
  BroadPosition,
  FormationValidationIssue,
  FormationValidationResult,
  PlayerPositionInfo,
  CompatibilityResult,
} from "./formations/index";