import {
  type PlayerAttributeProfile,
  type BroadPosition,
  type GameFormat,
  type EventPoolValidation,
  type FormationSlotRequirement,
  type GoalkeeperCoverageTier,
  isGoalkeeperCapable,
  getGoalkeeperCoverageTier,
  getPlayerBroadPositions,
  computeCompositeRatings,
} from './event-types';
import type { SelectionPolicyResult } from '@/lib/policies/types';
import { coachFacingWarningMessage } from '@/lib/policies/policy-evaluation';
import { computeExactFormationCoverage } from '@/domain/positions/formation-coverage';
import type { FormationSlotRoleType } from '@/lib/formations/types';
import type { SideInput } from '@/domain/positions/roles';

export function applyPolicyWarnings(
  policyResult: SelectionPolicyResult | null,
  warnings: string[],
): string[] {
  if (!policyResult) return warnings;
  const merged = [...warnings];
  for (const warning of policyResult.warnings) {
    merged.push(coachFacingWarningMessage(warning));
  }
  for (const [playerId, reasons] of Object.entries(policyResult.blocked)) {
    for (const reason of reasons) {
      merged.push(`Policy blocked ${playerId}: ${reason}`);
    }
  }
  return merged;
}

export function validateEventPool(
  players: PlayerAttributeProfile[],
  targetSquadCount: number,
  targetSize: number,
  gameFormat: GameFormat,
  formationSlots: FormationSlotRequirement[],
  /**
   * The real total players needed across every squad, when squads have different target sizes
   * (D16/D17) — `targetSquadCount * targetSize` assumes every squad shares one uniform target,
   * which silently under/over-counts as soon as squads differ. Defaults to that product for
   * every existing caller/test that doesn't pass it, so this is purely additive.
   */
  totalTargetSizeOverride?: number,
): EventPoolValidation {
  const available = players.filter((p) => p !== null);
  const availableCount = available.length;
  const totalTargetSize = totalTargetSizeOverride ?? targetSquadCount * targetSize;

  let missingRatingsCount = 0;
  let partialRatingsCount = 0;
  let ratedPlayerCount = 0;

  for (const p of available) {
    const ratings = computeCompositeRatings(p);
    if (ratings.overallLevel === null) {
      missingRatingsCount++;
    } else {
      ratedPlayerCount++;
      if (ratings.overallLevel !== null && p.ballControl === null && p.effort === null && p.passing === null) {
        partialRatingsCount++;
      }
    }
  }

  const goalkeeperCount = available.filter(isGoalkeeperCapable).length;
  const goalkeeperPerSquad = targetSquadCount > 0 ? goalkeeperCount / targetSquadCount : 0;
  const goalkeeperSufficient = goalkeeperCount >= targetSquadCount;

  const goalkeeperTiers = available.reduce(
    (acc, p) => {
      const tier = getGoalkeeperCoverageTier(p);
      if (tier !== 'none') acc[tier]++;
      return acc;
    },
    { strong: 0, acceptable: 0, emergency: 0 } as Record<Exclude<GoalkeeperCoverageTier, 'none'>, number>,
  );

  const positionCounts: Record<BroadPosition, number> = {
    goalkeeper: goalkeeperCount,
    defender: 0,
    midfielder: 0,
    forward: 0,
    flexible: 0,
  };

  for (const player of available) {
    const positions = getPlayerBroadPositions(player);
    if (positions.length === 0) {
      positionCounts.flexible++;
    } else {
      for (const pos of positions) {
        if (pos in positionCounts) {
          positionCounts[pos]++;
        } else {
          positionCounts.flexible++;
        }
      }
    }
  }

  const positionCoverage: Record<BroadPosition, { count: number; perSquad: number; sufficient: boolean }> = {
    goalkeeper: {
      count: positionCounts.goalkeeper,
      perSquad: Math.round(goalkeeperPerSquad * 10) / 10,
      sufficient: goalkeeperSufficient,
    },
    defender: {
      count: positionCounts.defender,
      perSquad: targetSquadCount > 0 ? Math.round((positionCounts.defender / targetSquadCount) * 10) / 10 : 0,
      sufficient: positionCounts.defender >= targetSquadCount,
    },
    midfielder: {
      count: positionCounts.midfielder,
      perSquad: targetSquadCount > 0 ? Math.round((positionCounts.midfielder / targetSquadCount) * 10) / 10 : 0,
      sufficient: positionCounts.midfielder >= targetSquadCount,
    },
    forward: {
      count: positionCounts.forward,
      perSquad: targetSquadCount > 0 ? Math.round((positionCounts.forward / targetSquadCount) * 10) / 10 : 0,
      sufficient: positionCounts.forward >= targetSquadCount,
    },
    flexible: {
      count: positionCounts.flexible,
      perSquad: targetSquadCount > 0 ? Math.round((positionCounts.flexible / targetSquadCount) * 10) / 10 : 0,
      sufficient: true,
    },
  };

  const warnings: string[] = [];
  const notes: string[] = [];

  if (availableCount < totalTargetSize) {
    warnings.push(
      `Not enough available players: ${availableCount} available, ${totalTargetSize} needed for ${targetSquadCount} squads`,
    );
  }

  if (!goalkeeperSufficient) {
    const strong = goalkeeperTiers.strong;
    const acceptable = goalkeeperTiers.acceptable;
    const emergency = goalkeeperTiers.emergency;
    const parts: string[] = [];
    if (strong > 0) parts.push(`${strong} strong`);
    if (acceptable > 0) parts.push(`${acceptable} acceptable`);
    if (emergency > 0) parts.push(`${emergency} emergency`);
    const coverage = parts.length > 0 ? `: ${parts.join(', ')}` : '';
    warnings.push(
      `Insufficient goalkeeper coverage${coverage} for ${targetSquadCount} squads`,
    );
  }

  if (missingRatingsCount > 0) {
    if (missingRatingsCount === availableCount) {
      notes.push(
        `All ${missingRatingsCount} available players have no usable ratings, which will affect balance quality.`,
      );
    } else if (missingRatingsCount > availableCount / 2) {
      notes.push(
        `Many players have no usable ratings (${missingRatingsCount} of ${availableCount}), which may affect balance quality.`,
      );
    } else {
      notes.push(
        `${missingRatingsCount} of ${availableCount} available players have no usable ratings.`,
      );
    }
  }

  const requiredPositions = getRequiredPositionsByFormat(gameFormat, formationSlots);
  for (const pos of requiredPositions) {
    if (positionCoverage[pos] && positionCoverage[pos].count < targetSquadCount) {
      warnings.push(
        `Insufficient ${pos} coverage: ${positionCoverage[pos].count} players for ${targetSquadCount} squads`,
      );
    }
  }

  // Exact simultaneous coverage (ADR-0129 §12): only when a real formation was resolved (its
  // slots carry grid geometry). We test whether the whole available pool can staff
  // `targetSquadCount` copies of the formation at once, via maximum matching — so one versatile
  // player is never counted as the sole solution for two different required roles.
  let exactFormationCoverage: EventPoolValidation['exactFormationCoverage'] = null;
  const geometricSlots = formationSlots.filter((s) => typeof s.gridX === 'number');
  if (geometricSlots.length > 0 && targetSquadCount > 0) {
    const coverageSlots: { slotId: string; roleType: FormationSlotRoleType; gridX: number }[] = [];
    for (let squad = 0; squad < targetSquadCount; squad++) {
      geometricSlots.forEach((slot, i) => {
        coverageSlots.push({
          slotId: `s${squad}-${i}`,
          roleType: slot.roleType as FormationSlotRoleType,
          gridX: slot.gridX as number,
        });
      });
    }
    const coverage = computeExactFormationCoverage(
      coverageSlots,
      available.map((p) => ({
        id: p.playerId,
        primaryPosition: p.primaryPosition,
        secondaryPosition: p.secondaryPosition,
        tertiaryPosition: p.tertiaryPosition,
        bestSide: p.bestSide as SideInput,
      })),
    );
    const unfilledByRole = new Map<string, number>();
    for (const role of coverage.unfilledRoles) unfilledByRole.set(role, (unfilledByRole.get(role) ?? 0) + 1);
    exactFormationCoverage = {
      covered: coverage.covered,
      requiredExactSlots: coverage.requiredExactSlots,
      filledExactSlots: coverage.filledExactSlots,
      unfilledRoles: [...unfilledByRole.entries()].map(([role, count]) => ({ role, count })),
    };
    for (const { role, count } of exactFormationCoverage.unfilledRoles) {
      warnings.push(
        `Not enough players for the ${role} role across ${targetSquadCount} squad${targetSquadCount === 1 ? '' : 's'} (${count} uncovered)`,
      );
    }
  }

  return {
    availablePlayerCount: availableCount,
    targetSquadCount,
    targetSize,
    totalTargetSize,
    missingRatingsCount,
    partialRatingsCount,
    ratedPlayerCount,
    goalkeeperCoverage: {
      total: goalkeeperCount,
      perSquad: Math.round(goalkeeperPerSquad * 10) / 10,
      sufficient: goalkeeperSufficient,
    },
    positionCoverage,
    exactFormationCoverage,
    warnings,
    notes,
  };
}

function getRequiredPositionsByFormat(
  gameFormat: GameFormat,
  formationSlots: FormationSlotRequirement[],
): BroadPosition[] {
  if (formationSlots.length > 0) {
    const positions = new Set<BroadPosition>();
    for (const slot of formationSlots) {
      for (const pos of slot.acceptedPositions) {
        positions.add(pos);
      }
    }
    return [...positions];
  }

  switch (gameFormat) {
    case 'THREE_A_SIDE':
      return ['defender', 'flexible'];
    case 'FIVE_A_SIDE':
      return ['goalkeeper', 'defender', 'forward'];
    case 'SEVEN_A_SIDE':
      return ['goalkeeper', 'defender', 'midfielder', 'forward'];
    case 'NINE_A_SIDE':
    case 'ELEVEN_A_SIDE':
      return ['goalkeeper', 'defender', 'midfielder', 'forward'];
    default:
      return ['goalkeeper', 'defender', 'midfielder', 'forward'];
  }
}