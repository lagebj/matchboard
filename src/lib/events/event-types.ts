import type {
  Formation,
  FormationSlot,
} from '@/generated/prisma/client';
import type { PositionFitTier } from '@/lib/players/player-position-resolver';
import { getPlayerBroadPositions as canonicalGetPlayerBroadPositions } from '@/lib/players/player-position-resolver';

export type GameFormat = 'THREE_A_SIDE' | 'FIVE_A_SIDE' | 'SEVEN_A_SIDE' | 'NINE_A_SIDE' | 'ELEVEN_A_SIDE';

/**
 * The single centralized "effective game format" calculation (production consistency pass
 * item #4): an EventSquad's own `gameFormatOverride` if set, otherwise the Event's default.
 * Every downstream consumer (formation selection, lineup generation, live reporting, rotation,
 * post-match reporting, pool validation) must call this rather than reading `event.gameFormat`
 * directly or re-deriving the fallback inline.
 */
export function getEffectiveEventTeamGameFormat(
  event: { gameFormat: GameFormat | string },
  squad: { gameFormatOverride: GameFormat | string | null },
): GameFormat {
  return (squad.gameFormatOverride ?? event.gameFormat) as GameFormat;
}

export type EventStatusType = 'DRAFT' | 'FINALIZED';

export type EventSelectionPattern = 'ALL_BALANCED' | 'ONE_COMPETITIVE_BALANCED_REMAINDER' | 'MANUAL_SEED_AUTO_BALANCE' | 'PRESERVE_AND_FILL';

export type EventSquadIntent = 'COMPETITIVE' | 'BALANCED' | 'MANUAL';

export type EventPlayerStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN' | 'RESERVE' | 'LATE_ADDITION' | 'WITHDRAWN';

export type EventSquadPlayerSource = 'AUTO' | 'MANUAL' | 'LOCKED';

export type GoalkeeperAbility = 'NO' | 'EMERGENCY' | 'YES';

export type BroadPosition = 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | 'flexible';

export interface PlayerAttributeProfile {
  playerId: string;
  firstName: string;
  lastName: string | null;
  coreTeamId: string | null;
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  goalkeeperAbility: GoalkeeperAbility;
  ballControl: number | null;
  passing: number | null;
  firstTouch: number | null;
  oneVOneAttacking: number | null;
  positioning: number | null;
  oneVOneDefending: number | null;
  decisionMaking: number | null;
  effort: number | null;
  teamplay: number | null;
  concentration: number | null;
  speed: number | null;
  strength: number | null;
  nonRotatable: boolean;
  preferredFoot: string;
  bestSide: string;
}

export interface CompositeRatings {
  overallLevel: number | null;
  defending: number | null;
  attacking: number | null;
  gameUnderstanding: number | null;
  intensity: number | null;
  teamplay: number | null;
  goalkeeperAbility: GoalkeeperAbility;
}

export function computeCompositeRatings(player: PlayerAttributeProfile): CompositeRatings {
  const attrs = [
    player.ballControl,
    player.passing,
    player.firstTouch,
    player.oneVOneAttacking,
    player.positioning,
    player.oneVOneDefending,
    player.decisionMaking,
    player.effort,
    player.teamplay,
    player.concentration,
    player.speed,
    player.strength,
  ];

  const nonNullAttrs = attrs.filter((a): a is number => a !== null);

  const overallLevel = nonNullAttrs.length > 0
    ? nonNullAttrs.reduce((sum, v) => sum + v, 0) / nonNullAttrs.length
    : null;

  const avgOrNull = (values: (number | null)[]) => {
    const filtered = values.filter((v): v is number => v !== null);
    return filtered.length > 0 ? filtered.reduce((s, v) => s + v, 0) / filtered.length : null;
  };

  return {
    overallLevel: overallLevel !== null ? Math.round(overallLevel * 10) / 10 : null,
    defending: avgOrNull([player.oneVOneDefending, player.positioning]),
    attacking: avgOrNull([player.oneVOneAttacking, player.ballControl]),
    gameUnderstanding: avgOrNull([player.decisionMaking, player.positioning]),
    intensity: avgOrNull([player.effort, player.concentration]),
    teamplay: player.teamplay,
    goalkeeperAbility: player.goalkeeperAbility,
  };
}

export type GoalkeeperCoverageTier = 'strong' | 'acceptable' | 'emergency' | 'none';

export function getGoalkeeperCoverageTier(player: PlayerAttributeProfile): GoalkeeperCoverageTier {
  if (player.goalkeeperAbility === 'YES') return 'strong';
  if (player.primaryPosition === 'GK') return 'strong';
  if (player.secondaryPosition === 'GK') return 'acceptable';
  if (player.tertiaryPosition === 'GK') return 'emergency';
  if (player.goalkeeperAbility === 'EMERGENCY') return 'emergency';
  return 'none';
}

export function isGoalkeeperCapable(player: PlayerAttributeProfile): boolean {
  return getGoalkeeperCoverageTier(player) !== 'none';
}

export { mapAnyPositionToBroad as mapPositionToBroad, getPositionFitTier } from '@/lib/players/player-position-resolver';

export const FIT_TIER_LABELS: Record<string, string> = {
  PRIMARY: '1st',
  SECONDARY: '2nd',
  TERTIARY: '3rd',
  NO_FIT: '',
};

export function getPlayerBroadPositions(player: PlayerAttributeProfile): BroadPosition[] {
  return canonicalGetPlayerBroadPositions(player.primaryPosition, player.secondaryPosition, player.tertiaryPosition);
}

export interface FormationSlotRequirement {
  roleType: string;
  acceptedPositions: BroadPosition[];
  label: string;
}

export interface EventPoolValidation {
  availablePlayerCount: number;
  targetSquadCount: number;
  targetSize: number;
  missingRatingsCount: number;
  partialRatingsCount: number;
  ratedPlayerCount: number;
  goalkeeperCoverage: { total: number; perSquad: number; sufficient: boolean };
  positionCoverage: Record<BroadPosition, { count: number; perSquad: number; sufficient: boolean }>;
  warnings: string[];
  notes: string[];
}

export interface EventSquadAssignment {
  playerId: string;
  eventId: string;
  eventSquadId: string;
  assignedRoleType: string | null;
  assignedPositionId: string | null;
  assignedSlotIndex: number | null;
  assignedSlotLabel: string | null;
  lineupOrder: number | null;
  source: EventSquadPlayerSource;
  locked: boolean;
  selectionReason: string;
  positionFitTier: PositionFitTier | null;
}

export interface SquadBalanceSummary {
  squadId: string;
  squadName: string;
  intent: EventSquadIntent;
  playerCount: number;
  averageOverall: number | null;
  ratedPlayerCount: number;
  goalkeeperCount: number;
  defenderCount: number;
  midfielderCount: number;
  forwardCount: number;
  flexibleCount: number;
  missingRatingsCount: number;
  coverageNotes: string[];
}

export interface GenerationInput {
  eventId: string;
  players: PlayerAttributeProfile[];
  formations: (Formation & { slots: FormationSlot[] })[];
  defaultFormationId: string | null;
  squads: {
    id: string;
    name: string;
    intent: EventSquadIntent;
    targetSize: number;
    minSize: number | null;
    maxSize: number | null;
    formationId: string | null;
    generationOrder: number;
  }[];
  selectionPattern: EventSelectionPattern;
  lockedAssignments: Map<string, string>;
  includeReserves: boolean;
  includeLateAdditions: boolean;
  gameFormat: GameFormat;
}

export interface GenerationOutput {
  assignments: EventSquadAssignment[];
  balanceSummaries: SquadBalanceSummary[];
  validationNotes: string[];
  warnings: string[];
}