export type { GameFormat } from "@/generated/prisma/client";

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
} from "./types";

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
  GAME_FORMAT_PLAYERS,
  formatGameFormatLabel,
  formatGameFormatShort,
  isValidGridX,
  isValidGridY,
  getGridPositionPercent,
} from "./types";

export { suggestSlotDefaults } from "./slot-defaults";
export { SYSTEM_FORMATIONS, getSystemFormationsForFormat } from "./system-formations";
export { seedSystemFormations } from "./seed";

export {
  validateFormationForMatchUse,
  isValidSlotInFormat,
  isValidRoleType,
} from "./validate";

export type { FormationValidationIssue, FormationValidationResult } from "./validate";

export {
  mapExistingPositionToBroad,
  getPlayerSlotCompatibility,
  sortPlayersBySlotCompatibility,
  getPlayersForLineup,
} from "./lineup-compatibility";

export type { PlayerPositionInfo, CompatibilityResult } from "./lineup-compatibility";

export { createFormationSnapshot } from "./snapshot";

export {
  suggestFormationForMatch,
  suggestLineupForFormation,
  preserveAssignmentsOnChange,
} from "./suggest";

export type {
  FormationSuggestion,
  SuggestFormationInput,
  LineupSuggestion,
  SuggestLineupInput,
  AssignmentMigration,
} from "./suggest";

export {
  getBoardPositionPercent,
  getBoardAspectRatio,
} from "./board-projection";

export type {
  BoardOrientation,
  AttackingDirection,
  BoardProjectionOptions,
  BoardPosition,
} from "./board-projection";