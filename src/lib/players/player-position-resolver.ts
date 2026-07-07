import type { BroadPosition } from '@/lib/events/event-types';

export type PositionCode = 'GK' | 'CB' | 'CM' | 'W' | 'ST';

export const POSITION_CODES: PositionCode[] = ['GK', 'CB', 'CM', 'W', 'ST'];

export const POSITION_LABELS: Record<PositionCode, string> = {
  GK: 'Goalkeeper',
  CB: 'Center Back',
  CM: 'Center Midfield',
  W: 'Wing',
  ST: 'Striker',
};

export type PositionFitTier = 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'NO_FIT';

export interface PlayerPositionEntry {
  positionId: PositionCode;
  priority: PositionFitTier;
}

export interface PlayerPositionProfile {
  playerId: string;
  primary: PositionCode;
  secondary: PositionCode | null;
  tertiary: PositionCode | null;
  broadPositions: BroadPosition[];
}

const POSITION_TO_BROAD: Record<PositionCode, BroadPosition> = {
  GK: 'goalkeeper',
  CB: 'defender',
  CM: 'midfielder',
  W: 'midfielder',
  ST: 'forward',
};

export function mapPositionCodeToBroad(position: PositionCode): BroadPosition {
  return POSITION_TO_BROAD[position] ?? 'flexible';
}

export function mapAnyPositionToBroad(position: string): BroadPosition {
  if (POSITION_TO_BROAD[position as PositionCode]) {
    return POSITION_TO_BROAD[position as PositionCode];
  }
  return 'flexible';
}

export function getPlayerPositionProfile(
  primaryPosition: string,
  secondaryPosition: string | null,
  tertiaryPosition: string | null,
): PlayerPositionProfile {
  const primary = primaryPosition as PositionCode;
  const secondary = (secondaryPosition && secondaryPosition !== 'NONE') ? secondaryPosition as PositionCode : null;
  const tertiary = (tertiaryPosition && tertiaryPosition !== 'NONE') ? tertiaryPosition as PositionCode : null;

  const broadPositions: BroadPosition[] = [mapPositionCodeToBroad(primary)];
  if (secondary) {
    const broad = mapPositionCodeToBroad(secondary);
    if (!broadPositions.includes(broad)) broadPositions.push(broad);
  }
  if (tertiary) {
    const broad = mapPositionCodeToBroad(tertiary);
    if (!broadPositions.includes(broad)) broadPositions.push(broad);
  }

  return { playerId: '', primary, secondary, tertiary, broadPositions };
}

export function getPositionFitTier(
  primaryPosition: string,
  secondaryPosition: string | null,
  tertiaryPosition: string | null,
  slotAcceptedPositions: BroadPosition[],
): PositionFitTier {
  const primaryBroad = mapAnyPositionToBroad(primaryPosition);
  if (slotAcceptedPositions.includes(primaryBroad)) return 'PRIMARY';

  if (secondaryPosition && secondaryPosition !== 'NONE') {
    const secondaryBroad = mapAnyPositionToBroad(secondaryPosition);
    if (slotAcceptedPositions.includes(secondaryBroad)) return 'SECONDARY';
  }

  if (tertiaryPosition && tertiaryPosition !== 'NONE') {
    const tertiaryBroad = mapAnyPositionToBroad(tertiaryPosition);
    if (slotAcceptedPositions.includes(tertiaryBroad)) return 'TERTIARY';
  }

  if (slotAcceptedPositions.includes('flexible')) return 'NO_FIT';

  return 'NO_FIT';
}

export function getPlayerBroadPositions(
  primaryPosition: string,
  secondaryPosition: string | null,
  tertiaryPosition: string | null,
): BroadPosition[] {
  return getPlayerPositionProfile(primaryPosition, secondaryPosition, tertiaryPosition).broadPositions;
}

export function isGoalkeeperCapable(
  goalkeeperAbility: string,
  primaryPosition: string,
): boolean {
  if (goalkeeperAbility === 'YES' || goalkeeperAbility === 'EMERGENCY') return true;
  return primaryPosition === 'GK';
}

export const FIT_TIER_PRIORITY: Record<PositionFitTier, number> = {
  PRIMARY: 0,
  SECONDARY: 1,
  TERTIARY: 2,
  NO_FIT: 3,
};

export interface PositionScarcity {
  position: BroadPosition;
  primaryCandidateCount: number;
  totalCandidateCount: number;
  squadCount: number;
  isScarce: boolean;
  note: string | null;
}

export function computePositionScarcity(
  players: { primaryPosition: string; secondaryPosition: string | null; tertiaryPosition: string | null; goalkeeperAbility: string }[],
  squadCount: number,
): PositionScarcity[] {
  const broadPositions: BroadPosition[] = ['goalkeeper', 'defender', 'midfielder', 'forward'];

  return broadPositions.map((pos) => {
    const primaryCandidates = players.filter((p) => {
      if (pos === 'goalkeeper') {
        return isGoalkeeperCapable(p.goalkeeperAbility, p.primaryPosition) && mapAnyPositionToBroad(p.primaryPosition) === 'goalkeeper';
      }
      return mapAnyPositionToBroad(p.primaryPosition) === pos;
    });

    const totalCandidates = players.filter((p) => {
      const profile = getPlayerPositionProfile(p.primaryPosition, p.secondaryPosition, p.tertiaryPosition);
      return profile.broadPositions.includes(pos);
    });

    const isScarce = primaryCandidates.length < squadCount;

    let note: string | null = null;
    if (primaryCandidates.length === 0) {
      note = `No primary ${pos} players available`;
    } else if (isScarce) {
      note = `Only ${primaryCandidates.length} primary ${pos} player(s) for ${squadCount} squad(s)`;
    }

    return {
      position: pos,
      primaryCandidateCount: primaryCandidates.length,
      totalCandidateCount: totalCandidates.length,
      squadCount,
      isScarce,
      note,
    };
  });
}