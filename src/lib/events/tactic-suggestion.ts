import type {
  PlayerAttributeProfile,
  BroadPosition,
  GameFormat,
  FormationSlotRequirement,
} from './event-types';
import { getPlayerBroadPositions, isGoalkeeperCapable, getPositionFitTier } from './event-types';

export type FormationInfo = {
  id: string;
  name: string;
  gameFormat: string;
  slots: FormationSlotRequirement[];
};

export type TacticSuggestion = {
  formationId: string | null;
  formationName: string | null;
  score: number;
  coverageSummary: {
    coveredSlots: number;
    totalSlots: number;
    primaryFits: number;
    secondaryFits: number;
    tertiaryFits: number;
    noFits: number;
    goalkeeperCovered: boolean;
  };
  notes: string[];
};

const PRIMARY_FIT_SCORE = 5;
const SECONDARY_FIT_SCORE = 3;
const TERTIARY_FIT_SCORE = 1;
const NO_FIT_PENALTY = -3;
const UNCOVERED_SLOT_PENALTY = -5;
const UNCOVERED_GOALKEEPER_PENALTY = -10;

export function suggestBestFormationForPlayers(input: {
  players: PlayerAttributeProfile[];
  formations: FormationInfo[];
  gameFormat: GameFormat;
}): TacticSuggestion {
  if (input.formations.length === 0) {
    return {
      formationId: null,
      formationName: null,
      score: 0,
      coverageSummary: {
        coveredSlots: 0,
        totalSlots: 0,
        primaryFits: 0,
        secondaryFits: 0,
        tertiaryFits: 0,
        noFits: 0,
        goalkeeperCovered: false,
      },
      notes: [`No formations available for ${formatGameFormatLabel(input.gameFormat)}.`],
    };
  }

  if (input.players.length === 0) {
    return {
      formationId: null,
      formationName: null,
      score: 0,
      coverageSummary: {
        coveredSlots: 0,
        totalSlots: 0,
        primaryFits: 0,
        secondaryFits: 0,
        tertiaryFits: 0,
        noFits: 0,
        goalkeeperCovered: false,
      },
      notes: ['No players available for tactic suggestion.'],
    };
  }

  let bestResult: TacticSuggestion | null = null;

  for (const formation of input.formations) {
    const result = scoreFormationForPlayers(input.players, formation);
    if (!bestResult || result.score > bestResult.score) {
      bestResult = result;
    }
  }

  return bestResult!;
}

function scoreFormationForPlayers(
  players: PlayerAttributeProfile[],
  formation: FormationInfo,
): TacticSuggestion {
  let score = 0;
  let primaryFits = 0;
  let secondaryFits = 0;
  let tertiaryFits = 0;
  let noFits = 0;
  let coveredSlots = 0;
  let goalkeeperCovered = false;
  const notes: string[] = [];

  const assigned = new Set<string>();

  for (const slot of formation.slots) {
    const bestPlayer = findBestFitForSlot(players, slot.acceptedPositions, assigned);

    if (bestPlayer) {
      const fitTier = getPositionFitTier(
        bestPlayer.primaryPosition,
        bestPlayer.secondaryPosition,
        bestPlayer.tertiaryPosition,
        slot.acceptedPositions,
      );

      switch (fitTier) {
        case 'PRIMARY': primaryFits++; score += PRIMARY_FIT_SCORE; break;
        case 'SECONDARY': secondaryFits++; score += SECONDARY_FIT_SCORE; break;
        case 'TERTIARY': tertiaryFits++; score += TERTIARY_FIT_SCORE; break;
        case 'NO_FIT': noFits++; score += NO_FIT_PENALTY; break;
      }

      coveredSlots++;
      assigned.add(bestPlayer.playerId);

      if (slot.acceptedPositions.includes('goalkeeper') && isGoalkeeperCapable(bestPlayer)) {
        goalkeeperCovered = true;
      }
    } else {
      score += UNCOVERED_SLOT_PENALTY;
      if (slot.acceptedPositions.includes('goalkeeper')) {
        score += UNCOVERED_GOALKEEPER_PENALTY;
        notes.push('No goalkeeper-capable player for goalkeeper slot.');
      }
    }
  }

  const totalSlots = formation.slots.length;
  const gkSlot = formation.slots.find((s) => s.acceptedPositions.includes('goalkeeper'));
  if (gkSlot && !goalkeeperCovered) {
    notes.push('No goalkeeper-capable player for goalkeeper slot.');
  }
  if (secondaryFits > primaryFits + 1) {
    notes.push('Formation fits most players in secondary positions.');
  }
  if (primaryFits >= totalSlots * 0.6) {
    notes.push('Formation fits most players in natural positions.');
  }

  return {
    formationId: formation.id,
    formationName: formation.name,
    score,
    coverageSummary: {
      coveredSlots,
      totalSlots,
      primaryFits,
      secondaryFits,
      tertiaryFits,
      noFits,
      goalkeeperCovered,
    },
    notes,
  };
}

function findBestFitForSlot(
  players: PlayerAttributeProfile[],
  acceptedPositions: BroadPosition[],
  assigned: Set<string>,
): PlayerAttributeProfile | null {
  let best: PlayerAttributeProfile | null = null;
  let bestTier: string | null = null;
  let bestRating = -Infinity;

  for (const player of players) {
    if (assigned.has(player.playerId)) continue;

    if (acceptedPositions.includes('goalkeeper') && isGoalkeeperCapable(player)) {
      const rating = computeSimpleRating(player);
      if (!best || bestTier !== 'PRIMARY') {
        best = player;
        bestTier = 'PRIMARY';
        bestRating = rating;
        continue;
      }
    }

    const tier = getPositionFitTier(
      player.primaryPosition,
      player.secondaryPosition,
      player.tertiaryPosition,
      acceptedPositions,
    );

    if (tier === 'NO_FIT') continue;

    const rating = computeSimpleRating(player);

    if (!best) {
      best = player;
      bestTier = tier;
      bestRating = rating;
      continue;
    }

    const tierPriority: Record<string, number> = { PRIMARY: 0, SECONDARY: 1, TERTIARY: 2 };
    if ((tierPriority[tier] ?? 3) < (tierPriority[bestTier ?? ''] ?? 3)) {
      best = player;
      bestTier = tier;
      bestRating = rating;
    } else if (tier === bestTier && rating > bestRating) {
      best = player;
      bestRating = rating;
    }
  }

  return best;
}

function computeSimpleRating(player: PlayerAttributeProfile): number {
  const attrs = [
    player.ballControl, player.passing, player.firstTouch, player.oneVOneAttacking,
    player.positioning, player.oneVOneDefending, player.decisionMaking,
    player.effort, player.teamplay, player.concentration, player.speed, player.strength,
  ];
  const valid = attrs.filter((v): v is number => v !== null);
  return valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
}

function formatGameFormatLabel(gf: GameFormat): string {
  const labels: Record<string, string> = {
    THREE_A_SIDE: '3-a-side',
    FIVE_A_SIDE: '5-a-side',
    SEVEN_A_SIDE: '7-a-side',
    NINE_A_SIDE: '9-a-side',
    ELEVEN_A_SIDE: '11-a-side',
  };
  return labels[gf] ?? gf.replace(/_/g, '-').toLowerCase();
}