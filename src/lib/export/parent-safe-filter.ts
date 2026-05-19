import {
  type CoachingIntentCategory,
  type MatchdayResponsibilityType,
  PARENT_SAFE_INTENT_MAP,
  PARENT_SAFE_RESPONSIBILITY_MAP,
} from "@/lib/coaching/types";

type SelectionExportRow = {
  round?: string;
  date?: string;
  team?: string;
  homeAway?: string;
  opponent?: string;
  playerName?: string;
  playerCode?: number;
  sourceTeam?: string;
  role?: string;
  position?: string;
  overrideReasonCategory?: string;
  overrideReasonDetail?: string;
  explanation?: unknown;
  matchdayResponsibility?: MatchdayResponsibilityType | null;
  coachingIntentCategory?: CoachingIntentCategory | null;
  controlledDoubleLoad?: boolean;
  [key: string]: unknown;
};

type MovementExportRow = {
  round?: string;
  date?: string;
  playerName?: string;
  playerCode?: number;
  fromTeam?: string;
  toTeam?: string;
  role?: string;
  [key: string]: unknown;
};

type PlayerStatsExportRow = {
  player?: string;
  playerCode?: number;
  team?: string;
  roundsPlayed?: number;
  coreMatches?: number;
  supportMatches?: number;
  developmentMatches?: number;
  squadRepairMatches?: number;
  doubleLoadRounds?: number;
  readinessSignals?: unknown;
  feedback?: unknown;
  coachingIntent?: unknown;
  [key: string]: unknown;
};

const COACH_ONLY_FIELDS = [
  "sourceTeam",
  "role",
  "controlledDoubleLoad",
  "overrideReasonCategory",
  "overrideReasonDetail",
  "explanation",
  "matchdayResponsibility",
  "coachingIntentCategory",
] as const;

const PARENT_SAFE_REPLACEMENTS: Record<string, string> = {
  CORE: "selected",
  SUPPORT: "rotation",
  DEVELOPMENT: "development opportunity",
  BACKFILL: "squad adjustment",
  CONFIDENCE_REBUILD: "development opportunity",
};

export function sanitizeSelectionForParent(row: SelectionExportRow): Omit<SelectionExportRow, typeof COACH_ONLY_FIELDS[number]> & Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (COACH_ONLY_FIELDS.includes(key as typeof COACH_ONLY_FIELDS[number])) {
      continue;
    }

    if (key === "role" && typeof value === "string") {
      sanitized[key] = PARENT_SAFE_REPLACEMENTS[value] ?? value;
      continue;
    }

    sanitized[key] = value;
  }

  if (row.matchdayResponsibility) {
    sanitized.roleContext = PARENT_SAFE_RESPONSIBILITY_MAP[row.matchdayResponsibility] ?? "team role";
  }

  if (row.coachingIntentCategory) {
    sanitized.intentContext = PARENT_SAFE_INTENT_MAP[row.coachingIntentCategory] ?? "match planning";
  }

  return sanitized;
}

export function sanitizeMovementForParent(row: MovementExportRow): Omit<MovementExportRow, "fromTeam" | "toTeam" | "role"> & Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (key === "fromTeam" || key === "toTeam" || key === "role") {
      continue;
    }
    sanitized[key] = value;
  }

  sanitized.movementDirection = "rotation";

  return sanitized;
}

export function sanitizePlayerStatsForParent(row: PlayerStatsExportRow): Omit<PlayerStatsExportRow, "supportMatches" | "developmentMatches" | "squadRepairMatches" | "doubleLoadRounds" | "readinessSignals" | "feedback" | "coachingIntent"> & Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (
      key === "supportMatches" ||
      key === "developmentMatches" ||
      key === "squadRepairMatches" ||
      key === "doubleLoadRounds" ||
      key === "readinessSignals" ||
      key === "feedback" ||
      key === "coachingIntent" ||
      key === "coreMatches"
    ) {
      if (key === "coreMatches" && typeof value === "number") {
        sanitized.matchesStarted = value;
      }
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export function sanitizeForParentExport(data: {
  selections?: SelectionExportRow[];
  movements?: MovementExportRow[];
  playerStats?: PlayerStatsExportRow[];
}): {
  selections?: Record<string, unknown>[];
  movements?: Record<string, unknown>[];
  playerStats?: Record<string, unknown>[];
} {
  return {
    ...(data.selections && { selections: data.selections.map(sanitizeSelectionForParent) }),
    ...(data.movements && { movements: data.movements.map(sanitizeMovementForParent) }),
    ...(data.playerStats && { playerStats: data.playerStats.map(sanitizePlayerStatsForParent) }),
  };
}