export type SelectionCategory = "CORE" | "SUPPORT" | "DEVELOPMENT" | "BACKFILL" | "CONFIDENCE_REBUILD" | "MANUAL";
export type AutomaticSelectionCategory = Exclude<SelectionCategory, "MANUAL">;

export type ExplanationRecord = {
  code: string;
  summary: string;
  details?: string;
  hardRule?: boolean;
};

export type SelectionWarning = {
  code: string;
  message: string;
  playerId?: string;
  matchId?: string;
  teamId?: string;
};

type SelectionPlayerBase = {
  autoSelected: boolean;
  coreTeamId: string;
  coreTeamName: string;
  eligibility: boolean;
  explanations: ExplanationRecord[];
  finalSelected: boolean;
  manualOverride: boolean;
  playerId: string;
  playerName: string;
  playerPosition: string;
  priorityScore: number | null;
};

export type SelectedPlayer = SelectionPlayerBase & {
  chosenPosition?: string;
  selectionCategory: SelectionCategory;
  selectionReason: string;
};

export type ExcludedPlayer = SelectionPlayerBase & {
  automaticSelectionCategory: AutomaticSelectionCategory | null;
  exclusionReason: string;
  selectionCategory: "EXCLUDED";
};

export type GeneratedSelection = {
  excludedPlayers: ExcludedPlayer[];
  generatedAt: Date;
  matchDate: Date;
  matchId: string;
  matchRoundId: string;
  opponent: string;
  selectedPlayers: SelectedPlayer[];
  teamName: string;
  warnings: SelectionWarning[];
};

export type GenerationSummary = {
  supportNeeds: Array<{
    teamName: string;
    supportPriority: number;
    targetSupportCount: number;
    minSupportCount: number;
    filledCount: number;
  }>;
  routedCoreMatchDrops: Array<{
    playerName: string;
    fromTeamName: string;
    toTeamName: string;
    role: string;
  }>;
  unroutedExclusions: Array<{
    playerName: string;
    coreTeamName: string;
    reason: string;
  }>;
};

export type GeneratedRound = {
  generatedAt: Date;
  generationSummary: GenerationSummary;
  matchRoundId: string;
  matchResults: GeneratedSelection[];
  roundWarnings: SelectionWarning[];
};

export type CoreMatchDropCandidate = {
  playerId: string;
  playerName: string;
  coreTeamId: string;
  coreTeamName: string;
  playerPosition: string;
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  fromMatchId: string;
};

export type RolePriority = typeof ROLE_PRIORITY_ORDER[number];

export const ROLE_PRIORITY_ORDER = ["SUPPORT", "DEVELOPMENT", "BACKFILL", "CONFIDENCE_REBUILD", "CORE"] as const;