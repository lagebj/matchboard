import type { SelectionRole } from "@/components/ui/role-badge";

export type PlayerInMatch = {
  playerId: string;
  playerName: string;
  coreTeamName: string;
  selectionCategory: SelectionRole | "REDUCED_MATCH_LOAD_DROP" | "CORE_MATCH_DROP" | "UNAVAILABLE";
  selectionReason: string;
  explanations: Array<{ code: string; summary: string; details?: string; hardRule?: boolean }>;
  priorityScore: number | null;
  manualOverride: boolean;
  playerPosition: string;
};