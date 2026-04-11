export type SelectionCategory = "CORE" | "FLOAT" | "SUPPORT" | "DEVELOPMENT" | "MANUAL";

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
};

type SelectionPlayerBase = {
  autoSelected: boolean;
  coreMatchDropAllowed: boolean;
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
  exclusionReason: string;
  selectionCategory: "EXCLUDED";
};

export type GeneratedSelection = {
  excludedPlayers: ExcludedPlayer[];
  generatedAt: Date;
  matchDate: Date;
  matchId: string;
  opponent: string;
  selectedPlayers: SelectedPlayer[];
  teamName: string;
  warnings: SelectionWarning[];
};
