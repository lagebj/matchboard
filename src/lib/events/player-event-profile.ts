import type { PlayerAttributeProfile, GoalkeeperAbility } from './event-types';

function normalizeRating(value: number | null | undefined): number | null {
  if (typeof value !== 'number') return null;
  if (value < 1 || value > 5) return null;
  return value;
}

export function toPlayerAttributeProfile(player: {
  id: string;
  firstName: string;
  lastName: string | null;
  coreTeamId: string | null;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  goalkeeperAbility: string | null;
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
  nonRotatable: boolean | null;
  preferredFoot: string | null;
  bestSide: string | null;
}): PlayerAttributeProfile {
  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    coreTeamId: player.coreTeamId,
    primaryPosition: player.primaryPosition ?? 'flexible',
    secondaryPosition: player.secondaryPosition,
    tertiaryPosition: player.tertiaryPosition,
    goalkeeperAbility: (player.goalkeeperAbility ?? 'NO') as GoalkeeperAbility,
    ballControl: normalizeRating(player.ballControl),
    passing: normalizeRating(player.passing),
    firstTouch: normalizeRating(player.firstTouch),
    oneVOneAttacking: normalizeRating(player.oneVOneAttacking),
    positioning: normalizeRating(player.positioning),
    oneVOneDefending: normalizeRating(player.oneVOneDefending),
    decisionMaking: normalizeRating(player.decisionMaking),
    effort: normalizeRating(player.effort),
    teamplay: normalizeRating(player.teamplay),
    concentration: normalizeRating(player.concentration),
    speed: normalizeRating(player.speed),
    strength: normalizeRating(player.strength),
    nonRotatable: player.nonRotatable ?? false,
    preferredFoot: player.preferredFoot ?? 'RIGHT',
    bestSide: player.bestSide ?? 'RIGHT',
  };
}