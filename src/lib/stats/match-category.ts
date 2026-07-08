export type MatchCategory = 'LEAGUE' | 'CUP' | 'OTHER';

export interface CategoryStatLine {
  category: MatchCategory;
  appearances: number;
  goals: number;
  assists: number;
}

export interface PlayerCategoryStats {
  playerId: string;
  league: CategoryStatLine;
  cup: CategoryStatLine;
  other: CategoryStatLine;
  total: CategoryStatLine;
}

export interface EntityMatchStats {
  entityType: 'LEAGUE_TEAM' | 'EVENT_SQUAD';
  entityId: string;
  category: MatchCategory;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  playerGoals: number;
  playerAssists: number;
}

export const MATCH_CATEGORY_LABELS: Record<MatchCategory, string> = {
  LEAGUE: 'League',
  CUP: 'Cup',
  OTHER: 'Other',
} as const;

export function getDefaultCategoryStatLine(category: MatchCategory): CategoryStatLine {
  return { category, appearances: 0, goals: 0, assists: 0 };
}

export function sumCategoryStatLines(...lines: CategoryStatLine[]): CategoryStatLine {
  return {
    category: 'LEAGUE',
    appearances: lines.reduce((s, l) => s + l.appearances, 0),
    goals: lines.reduce((s, l) => s + l.goals, 0),
    assists: lines.reduce((s, l) => s + l.assists, 0),
  };
}

export function getDefaultEventMatchCategory(eventType: string): MatchCategory {
  if (eventType === 'CUP' || eventType === 'TOURNAMENT') return 'CUP';
  return 'OTHER';
}