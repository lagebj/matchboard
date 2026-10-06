import { db } from '@/lib/db';
import type { OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import type { PlannedRotationStatus, PlannedChangeStatus } from '@/generated/prisma/client';
import { getLeagueMatchPeriodConfig, getTotalPeriodDurationMs } from '@/lib/live-match/period-config';

export type { PlannedRotationStatus, PlannedChangeStatus };

export type PlannedRotationChangeData = {
  outPlayerId: string | null;
  inPlayerId: string | null;
  outPosition: string | null;
  inPosition: string | null;
  positionOnly: boolean;
  approximateMatchSeconds: number | null;
  notes: string | null;
};

export type PlannedRotationChangeWithSequence = PlannedRotationChangeData & {
  sequence: number;
};

export type PlannedRotationChangeDetail = {
  id: string;
  sequence: number;
  outPlayerId: string | null;
  inPlayerId: string | null;
  outPosition: string | null;
  inPosition: string | null;
  positionOnly: boolean;
  approximateMatchSeconds: number | null;
  status: PlannedChangeStatus;
  notes: string | null;
  outPlayerFirstName: string | null;
  outPlayerLastName: string | null;
  inPlayerFirstName: string | null;
  inPlayerLastName: string | null;
};

export type PlannedRotationWithChanges = {
  id: string;
  matchId: string;
  teamId: string;
  status: PlannedRotationStatus;
  notes: string | null;
  changes: PlannedRotationChangeDetail[];
};

export type CreatePlannedRotationInput = {
  matchId: string;
  teamId: string;
  notes?: string;
  changes?: PlannedRotationChangeData[];
};

export type UpdatePlannedRotationInput = {
  notes?: string;
  changes?: PlannedRotationChangeData[];
};

const MAX_CHANGES_PER_ROTATION = 50;

export type PlannedRotationValidationIssue = {
  type: "error" | "warning";
  changeIndex: number | null;
  message: string;
};

export function validatePlannedChanges(
  changes: PlannedRotationChangeData[],
  existingPlayerIds: Set<string>,
): PlannedRotationValidationIssue[] {
  const issues: PlannedRotationValidationIssue[] = [];

  if (changes.length > MAX_CHANGES_PER_ROTATION) {
    issues.push({ type: "error", changeIndex: null, message: `Maximum ${MAX_CHANGES_PER_ROTATION} changes per rotation plan` });
  }

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];

    if (change.positionOnly && change.outPlayerId && change.inPlayerId) {
      if (change.outPlayerId === change.inPlayerId) {
        issues.push({ type: "error", changeIndex: i, message: "Position-only swap cannot involve the same player" });
      }
    }

    if (!change.positionOnly) {
      if (!change.outPlayerId) {
        issues.push({ type: "error", changeIndex: i, message: "Substitution must have a player going out" });
      }
      if (!change.inPlayerId) {
        issues.push({ type: "error", changeIndex: i, message: "Substitution must have a player coming in" });
      }
    }

    if (change.outPlayerId && !existingPlayerIds.has(change.outPlayerId)) {
      issues.push({ type: "error", changeIndex: i, message: "Out player is not in the match squad" });
    }
    if (change.inPlayerId && !existingPlayerIds.has(change.inPlayerId)) {
      issues.push({ type: "error", changeIndex: i, message: "In player is not in the match squad" });
    }
  }

  const outPlayerCounts = new Map<string, number[]>();
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (!change.positionOnly && change.outPlayerId) {
      const indices = outPlayerCounts.get(change.outPlayerId) ?? [];
      indices.push(i);
      outPlayerCounts.set(change.outPlayerId, indices);
    }
  }

  for (const [_playerId, indices] of outPlayerCounts) {
    if (indices.length > 1) {
      issues.push({
        type: "warning",
        changeIndex: indices[indices.length - 1],
        message: `Same player substituted out multiple times (changes ${indices.map((idx) => idx + 1).join(", ")})`,
      });
    }
  }

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (!change.positionOnly && change.outPlayerId && change.inPlayerId && change.outPlayerId === change.inPlayerId) {
      issues.push({ type: "error", changeIndex: i, message: "A player cannot substitute themselves" });
    }
  }

  return issues;
}

export async function getPlannedRotation(
  matchId: string,
  teamId: string,
  orgFilter: OrgFilterMode,
): Promise<PlannedRotationWithChanges | null> {
  const orgId = orgFilter.filter.organisationId;
  if (!orgId) return null;

  // Explicit organisationId filter (not a fetch-then-check afterward) — the same
  // defense-in-depth convention every other query in this file already uses, and the only way
  // to be certain this RLS-scoped query stays correctly scoped regardless of ambient
  // AsyncLocalStorage state (ADR-0087).
  const rotation = await db.plannedRotation.findFirst({
    where: { matchId, teamId, organisationId: orgId },
    include: {
      changes: {
        orderBy: { sequence: 'asc' },
        include: {
          outPlayer: { select: { id: true, firstName: true, lastName: true } },
          inPlayer: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!rotation) return null;

  return {
    id: rotation.id,
    matchId: rotation.matchId,
    teamId: rotation.teamId,
    status: rotation.status,
    notes: rotation.notes,
    changes: rotation.changes.map((c) => ({
      id: c.id,
      sequence: c.sequence,
      outPlayerId: c.outPlayerId,
      inPlayerId: c.inPlayerId,
      outPosition: c.outPosition,
      inPosition: c.inPosition,
      positionOnly: c.positionOnly,
      approximateMatchSeconds: c.approximateMatchSeconds,
      status: c.status,
      notes: c.notes,
      outPlayerFirstName: c.outPlayer?.firstName ?? null,
      outPlayerLastName: c.outPlayer?.lastName ?? null,
      inPlayerFirstName: c.inPlayer?.firstName ?? null,
      inPlayerLastName: c.inPlayer?.lastName ?? null,
    })),
  };
}

export async function createPlannedRotation(
  input: CreatePlannedRotationInput,
  orgFilter: OrgFilterMode,
): Promise<{ success: true; rotation: PlannedRotationWithChanges } | { success: false; error: string }> {
  const orgId = orgFilter.filter.organisationId;
  if (!orgId) return { success: false, error: 'Organisation context required' };

  const match = await db.match.findFirst({
    where: { id: input.matchId, ...orgFilter.filter },
    select: { id: true, teamId: true, status: true },
  });
  if (!match) return { success: false, error: 'Match not found' };
  if (match.teamId !== input.teamId) return { success: false, error: 'Team does not belong to this match' };

  if (match.status === 'CANCELLED') {
    return { success: false, error: 'Cannot create rotation plan for a cancelled match' };
  }

  const existing = await db.plannedRotation.findFirst({
    where: { matchId: input.matchId, teamId: input.teamId, organisationId: orgId },
  });
  if (existing) {
    return { success: false, error: 'Rotation plan already exists for this match and team' };
  }

  const changes = input.changes ?? [];
  if (changes.length > MAX_CHANGES_PER_ROTATION) {
    return { success: false, error: `Maximum ${MAX_CHANGES_PER_ROTATION} changes per rotation plan` };
  }

  const rotation = await db.plannedRotation.create({
    data: {
      organisationId: orgId,
      matchId: input.matchId,
      teamId: input.teamId,
      notes: input.notes ?? null,
      status: 'DRAFT',
      changes: {
        create: changes.map((change, index) => ({
          organisationId: orgId,
          sequence: index + 1,
          outPlayerId: change.outPlayerId,
          inPlayerId: change.inPlayerId,
          outPosition: change.outPosition,
          inPosition: change.inPosition,
          positionOnly: change.positionOnly,
          approximateMatchSeconds: change.approximateMatchSeconds,
          notes: change.notes,
          status: 'PENDING',
        })),
      },
    },
    include: {
      changes: {
        orderBy: { sequence: 'asc' },
        include: {
          outPlayer: { select: { id: true, firstName: true, lastName: true } },
          inPlayer: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  return { success: true, rotation: mapRotationWithChanges(rotation) };
}

export async function updatePlannedRotation(
  rotationId: string,
  input: UpdatePlannedRotationInput,
  orgFilter: OrgFilterMode,
): Promise<{ success: true; rotation: PlannedRotationWithChanges } | { success: false; error: string }> {
  const orgId = orgFilter.filter.organisationId;
  if (!orgId) return { success: false, error: 'Organisation context required' };

  const existing = await db.plannedRotation.findFirst({
    where: { id: rotationId, organisationId: orgId },
  });
  if (!existing) return { success: false, error: 'Rotation plan not found' };

  if (existing.status !== 'DRAFT') {
    return { success: false, error: 'Only DRAFT rotation plans can be edited' };
  }

  if (input.changes !== undefined) {
    if (input.changes.length > MAX_CHANGES_PER_ROTATION) {
      return { success: false, error: `Maximum ${MAX_CHANGES_PER_ROTATION} changes per rotation plan` };
    }

    const rotation = await db.plannedRotation.update({
      where: { id: rotationId, organisationId: orgId },
      data: {
        notes: input.notes ?? undefined,
        changes: {
          deleteMany: { plannedRotationId: rotationId },
          create: input.changes.map((change, index) => ({
            organisationId: orgId,
            sequence: index + 1,
            outPlayerId: change.outPlayerId,
            inPlayerId: change.inPlayerId,
            outPosition: change.outPosition,
            inPosition: change.inPosition,
            positionOnly: change.positionOnly,
            approximateMatchSeconds: change.approximateMatchSeconds,
            notes: change.notes,
            status: 'PENDING',
          })),
        },
      },
      include: {
        changes: {
          orderBy: { sequence: 'asc' },
          include: {
            outPlayer: { select: { id: true, firstName: true, lastName: true } },
            inPlayer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return { success: true, rotation: mapRotationWithChanges(rotation) };
  }

  const rotation = await db.plannedRotation.update({
    where: { id: rotationId, organisationId: orgId },
    data: { notes: input.notes ?? undefined },
    include: {
      changes: {
        orderBy: { sequence: 'asc' },
        include: {
          outPlayer: { select: { id: true, firstName: true, lastName: true } },
          inPlayer: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  return { success: true, rotation: mapRotationWithChanges(rotation) };
}

export async function deletePlannedRotation(
  rotationId: string,
  orgFilter: OrgFilterMode,
): Promise<{ success: true } | { success: false; error: string }> {
  const orgId = orgFilter.filter.organisationId;
  if (!orgId) return { success: false, error: 'Organisation context required' };

  const existing = await db.plannedRotation.findFirst({
    where: { id: rotationId, organisationId: orgId },
  });
  if (!existing) return { success: false, error: 'Rotation plan not found' };

  if (existing.status !== 'DRAFT') {
    return { success: false, error: 'Only DRAFT rotation plans can be deleted' };
  }

  await db.plannedRotation.delete({ where: { id: rotationId, organisationId: orgId } });
  return { success: true };
}

export type ProjectedLineupAtTime = {
  playerId: string;
  position: string;
  onPitch: boolean;
  enteredAt: 'start' | number;
};

export function projectPlannedLineup(
  starters: Array<{ playerId: string; position: string }>,
  changes: Array<{
    outPlayerId: string | null;
    inPlayerId: string | null;
    outPosition: string | null;
    inPosition: string | null;
    positionOnly: boolean;
    approximateMatchSeconds: number | null;
  }>,
  atSeconds: number,
): Map<string, { position: string; onPitch: boolean }> {
  const lineup = new Map<string, { position: string; onPitch: boolean }>();

  for (const starter of starters) {
    lineup.set(starter.playerId, { position: starter.position, onPitch: true });
  }

  const applicableChanges = changes
    .filter((c) => c.approximateMatchSeconds !== null && c.approximateMatchSeconds <= atSeconds)
    .sort((a, b) => (a.approximateMatchSeconds ?? 0) - (b.approximateMatchSeconds ?? 0));

  for (const change of applicableChanges) {
    if (change.positionOnly) {
      if (change.outPlayerId && change.inPlayerId) {
        const outPlayerState = lineup.get(change.outPlayerId);
        const inPlayerState = lineup.get(change.inPlayerId);
        if (outPlayerState?.onPitch && inPlayerState?.onPitch) {
          const outPosition = change.outPosition ?? outPlayerState.position;
          const inPosition = change.inPosition ?? inPlayerState.position;
          lineup.set(change.outPlayerId, { position: inPosition, onPitch: true });
          lineup.set(change.inPlayerId, { position: outPosition, onPitch: true });
        }
      }
    } else {
      if (change.outPlayerId) {
        const outPlayerState = lineup.get(change.outPlayerId);
        if (outPlayerState?.onPitch) {
          const vacatedPosition = outPlayerState.position;
          lineup.set(change.outPlayerId, { position: outPlayerState.position, onPitch: false });

          if (change.inPlayerId) {
            const inPosition = change.inPosition ?? vacatedPosition;
            lineup.set(change.inPlayerId, { position: inPosition, onPitch: true });
          }
        }
      } else if (change.inPlayerId) {
        const inPosition = change.inPosition ?? 'BENCH';
        lineup.set(change.inPlayerId, { position: inPosition, onPitch: true });
      }
    }
  }

  return lineup;
}

export type PlannedMinutesProjection = {
  playerId: string;
  plannedMinutes: number;
  startingPosition: string | null;
  positions: Array<{ position: string; fromSeconds: number; toSeconds: number | null }>;
};

export function projectPlannedMinutes(
  starters: Array<{ playerId: string; position: string }>,
  changes: Array<{
    outPlayerId: string | null;
    inPlayerId: string | null;
    outPosition: string | null;
    inPosition: string | null;
    positionOnly: boolean;
    approximateMatchSeconds: number | null;
  }>,
  totalMatchSeconds: number,
): PlannedMinutesProjection[] {
  const playerPositions = new Map<string, Array<{ position: string; fromSeconds: number; toSeconds: number | null }>>();

  for (const starter of starters) {
    playerPositions.set(starter.playerId, [{ position: starter.position, fromSeconds: 0, toSeconds: null }]);
  }

  const timedChanges = changes
    .filter((c) => c.approximateMatchSeconds !== null)
    .sort((a, b) => (a.approximateMatchSeconds ?? 0) - (b.approximateMatchSeconds ?? 0));

  for (const change of timedChanges) {
    const changeTime = change.approximateMatchSeconds!;

    if (change.positionOnly) {
      if (change.outPlayerId && change.inPlayerId) {
        const outPositions = playerPositions.get(change.outPlayerId);
        const inPositions = playerPositions.get(change.inPlayerId);

        if (outPositions && inPositions) {
          const outCurrent = outPositions[outPositions.length - 1];
          const inCurrent = inPositions[inPositions.length - 1];

          if (outCurrent.toSeconds === null) outCurrent.toSeconds = changeTime;
          if (inCurrent.toSeconds === null) inCurrent.toSeconds = changeTime;

          outPositions.push({ position: change.inPosition ?? inCurrent.position, fromSeconds: changeTime, toSeconds: null });
          inPositions.push({ position: change.outPosition ?? outCurrent.position, fromSeconds: changeTime, toSeconds: null });
        }
      }
    } else {
      if (change.outPlayerId) {
        const outPositions = playerPositions.get(change.outPlayerId);
        if (outPositions) {
          const current = outPositions[outPositions.length - 1];
          if (current.toSeconds === null) current.toSeconds = changeTime;
          outPositions.push({ position: 'BENCH', fromSeconds: changeTime, toSeconds: null });
        }
      }

      if (change.inPlayerId) {
        let inPositions = playerPositions.get(change.inPlayerId);
        if (!inPositions) {
          inPositions = [{ position: 'BENCH', fromSeconds: 0, toSeconds: changeTime }];
          playerPositions.set(change.inPlayerId, inPositions);
        } else {
          const current = inPositions[inPositions.length - 1];
          if (current.toSeconds === null) current.toSeconds = changeTime;
        }

        const vacatedPosition = change.outPlayerId
          ? (playerPositions.get(change.outPlayerId)?.[playerPositions.get(change.outPlayerId)!.length - 2]?.position ?? change.outPosition)
          : change.outPosition;

        const inPosition = change.inPosition ?? vacatedPosition ?? 'BENCH';
        inPositions.push({ position: inPosition, fromSeconds: changeTime, toSeconds: null });
      }
    }
  }

  const projections: PlannedMinutesProjection[] = [];

  for (const [playerId, positions] of playerPositions) {
    for (const pos of positions) {
      if (pos.toSeconds === null) pos.toSeconds = totalMatchSeconds;
    }

    const onPitchPositions = positions.filter((p) => p.position !== 'BENCH');
    const plannedMinutes = onPitchPositions.reduce((sum, p) => sum + ((p.toSeconds ?? totalMatchSeconds) - p.fromSeconds), 0) / 60;
    const startingPosition = positions[0]?.position === 'BENCH' ? null : positions[0]?.position ?? null;

    projections.push({
      playerId,
      plannedMinutes: Math.round(plannedMinutes * 10) / 10,
      startingPosition,
      positions: onPitchPositions.map((p) => ({
        position: p.position,
        fromSeconds: p.fromSeconds,
        toSeconds: p.toSeconds!,
      })),
    });
  }

  return projections;
}

/**
 * `projectPlannedMinutes` above only returns an entry for a player who is actually involved
 * somewhere in the plan (a starter, or named by some change) -- a squad member never involved at
 * all (a bench player never brought on, including every non-starter when no rotation plan exists
 * yet) has no entry at all, not a zero-minute one. The Match Detail Overview's planned-playing-
 * time display needs every squad player represented -- including an explicit zero for anyone left
 * out entirely -- so this wraps `projectPlannedMinutes` and fills that gap.
 *
 * This also is exactly the "generic" fallback behaviour requested for a match with no rotation
 * plan configured yet: called with `changes: []`, every starter reads the full match duration
 * (`projectPlannedMinutes`'s own existing behaviour) and every other squad player reads 0 here.
 *
 * Row order follows `squadPlayerIds` -- the caller's own ordering (e.g. squad list order) -- not
 * `projectPlannedMinutes`'s internal `Map` iteration order, which callers should never rely on.
 */
export function projectPlannedMinutesForSquad(
  starters: Array<{ playerId: string; position: string }>,
  changes: Array<{
    outPlayerId: string | null;
    inPlayerId: string | null;
    outPosition: string | null;
    inPosition: string | null;
    positionOnly: boolean;
    approximateMatchSeconds: number | null;
  }>,
  totalMatchSeconds: number,
  squadPlayerIds: string[],
): PlannedMinutesProjection[] {
  const projections = projectPlannedMinutes(starters, changes, totalMatchSeconds);
  const byPlayer = new Map(projections.map((p) => [p.playerId, p]));
  return squadPlayerIds.map(
    (playerId) =>
      byPlayer.get(playerId) ?? {
        playerId,
        plannedMinutes: 0,
        startingPosition: null,
        positions: [],
      },
  );
}

export type PlannedMinutesProjectionForMatch = {
  hasLineup: boolean;
  totalMatchSeconds: number | null;
  rows: PlannedMinutesProjection[];
};

/**
 * The one owner of "starters + saved rotation plan + this match's actually-configured duration ->
 * per-squad-player planned minutes/positions" (ADR-0157 C6's required correction). Previously this
 * input assembly was duplicated inline in `getPlannedPlayingTimeAction` and never reused, which is
 * exactly how `getRotationVsActual()` ended up hardcoding `plannedMinutes = 0` instead of calling
 * it. Both callers now share this function so they can never again drift onto two different
 * answers for "what was planned."
 *
 * Starters are read from the team's current match line-up, never fabricated from the full squad —
 * `hasLineup: false` when none has been set yet, matching `checkPlannedRotationCoverageAction`'s
 * own honesty convention.
 */
export async function getPlannedMinutesProjectionForMatch(
  matchId: string,
  teamId: string,
  orgFilter: OrgFilterMode,
): Promise<PlannedMinutesProjectionForMatch> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true, matchType: true },
  });
  if (!match) return { hasLineup: false, totalMatchSeconds: null, rows: [] };

  const lineup = await db.matchLineup.findFirst({
    where: { matchId, teamId, ...orgFilter.filter },
    include: {
      formation: { include: { slots: { select: { id: true, roleType: true } } } },
      assignments: { where: { playerId: { not: null } }, select: { playerId: true, slotId: true } },
    },
  });
  if (!lineup || lineup.assignments.length === 0) {
    return { hasLineup: false, totalMatchSeconds: null, rows: [] };
  }

  const selections = await db.selection.findMany({
    where: { matchId, status: { in: ['DRAFT', 'FINALIZED'] }, match: { teamId } },
    select: { playerId: true },
    orderBy: [{ role: 'asc' }],
  });
  const squadPlayerIds = selections.map((s) => s.playerId);

  const slotsById = new Map((lineup.formation?.slots ?? []).map((s) => [s.id, s]));
  const starters = lineup.assignments
    .filter((a): a is typeof a & { playerId: string } => a.playerId !== null)
    .map((a) => {
      const roleType = slotsById.get(a.slotId)?.roleType;
      return { playerId: a.playerId, position: roleType === 'GOALKEEPER' ? 'GK' : (roleType ?? 'FLEXIBLE') };
    });

  // ARR-0053's format-aware fix — the match's actually-configured total duration (match >
  // team > season default override precedence), not the hardcoded per-format lookup table this
  // replaced. Imported dynamically: `match-format-override.ts` is `"server-only"`-guarded, and
  // this module is also imported by pure-function unit tests (and a client component, via a
  // type-only import) that must not pay for that guard just to load this file.
  const { getMatchFormatOverrideState } = await import('@/lib/matches/match-format-override');
  const formatState = await getMatchFormatOverrideState(matchId, orgFilter.organisationId);
  const resolvedFormat = formatState?.frozenFormat ?? formatState?.effectiveFormat ?? null;
  const periodConfig = getLeagueMatchPeriodConfig(match.matchType, resolvedFormat);
  const totalMatchDurationMs = getTotalPeriodDurationMs(periodConfig);
  const totalMatchSeconds = totalMatchDurationMs !== null ? Math.round(totalMatchDurationMs / 1000) : null;

  const rotation = await getPlannedRotation(matchId, teamId, orgFilter);
  const rows = projectPlannedMinutesForSquad(starters, rotation?.changes ?? [], totalMatchSeconds ?? 0, squadPlayerIds);

  return { hasLineup: true, totalMatchSeconds, rows };
}

export type PlannedRotationCoverageIssue = {
  type: 'no_goalkeeper' | 'position_gap' | 'below_minimum' | 'untimed_change';
  description: string;
  affectedPlayerIds?: string[];
};

export function checkPlannedRotationCoverage(
  starters: Array<{ playerId: string; position: string }>,
  changes: Array<{
    outPlayerId: string | null;
    inPlayerId: string | null;
    outPosition: string | null;
    inPosition: string | null;
    positionOnly: boolean;
    approximateMatchSeconds: number | null;
  }>,
  squadPlayerIds: Set<string>,
  options: { totalMatchSeconds: number; minimumOnPitch: number; positions: string[] },
): PlannedRotationCoverageIssue[] {
  const issues: PlannedRotationCoverageIssue[] = [];

  const untimedChanges = changes.filter((c) => c.approximateMatchSeconds === null);
  if (untimedChanges.length > 0) {
    issues.push({
      type: 'untimed_change',
      description: `${untimedChanges.length} change(s) have no approximate timing and cannot be projected`,
    });
  }

  const startLineup = projectPlannedLineup(starters, [], 0);
  const onPitchStarters = [...startLineup.values()].filter((p) => p.onPitch);
  if (onPitchStarters.length < options.minimumOnPitch) {
    issues.push({
      type: 'below_minimum',
      description: `Starting line-up has ${onPitchStarters.length} players, minimum is ${options.minimumOnPitch}`,
    });
  }

  const hasGoalkeeper = starters.some((s) =>
    s.position.toLowerCase() === 'gk' || s.position.toLowerCase() === 'goalkeeper'
  );
  const projectedGK = changes.some((c) =>
    c.inPosition?.toLowerCase() === 'gk' || c.inPosition?.toLowerCase() === 'goalkeeper'
  );
  if (!hasGoalkeeper && !projectedGK) {
    issues.push({
      type: 'no_goalkeeper',
      description: 'No goalkeeper in starting line-up or planned changes',
    });
  }

  for (const playerId of squadPlayerIds) {
    const inStarters = starters.some((s) => s.playerId === playerId);
    const inChanges = changes.some(
      (c) => c.inPlayerId === playerId || c.outPlayerId === playerId
    );
    if (!inStarters && !inChanges) {
      // Player is in squad but not in starting line-up or rotation plan — this is fine, they're on the bench
    }
  }

  return issues;
}

function mapRotationWithChanges(rotation: {
  id: string;
  matchId: string;
  teamId: string;
  status: PlannedRotationStatus;
  notes: string | null;
  changes: Array<{
    id: string;
    sequence: number;
    outPlayerId: string | null;
    inPlayerId: string | null;
    outPosition: string | null;
    inPosition: string | null;
    positionOnly: boolean;
    approximateMatchSeconds: number | null;
    status: PlannedChangeStatus;
    notes: string | null;
    outPlayer: { id: string; firstName: string; lastName: string | null } | null;
    inPlayer: { id: string; firstName: string; lastName: string | null } | null;
  }>;
}): PlannedRotationWithChanges {
  return {
    id: rotation.id,
    matchId: rotation.matchId,
    teamId: rotation.teamId,
    status: rotation.status,
    notes: rotation.notes,
    changes: rotation.changes.map((c) => ({
      id: c.id,
      sequence: c.sequence,
      outPlayerId: c.outPlayerId,
      inPlayerId: c.inPlayerId,
      outPosition: c.outPosition,
      inPosition: c.inPosition,
      positionOnly: c.positionOnly,
      approximateMatchSeconds: c.approximateMatchSeconds,
      status: c.status,
      notes: c.notes,
      outPlayerFirstName: c.outPlayer?.firstName ?? null,
      outPlayerLastName: c.outPlayer?.lastName ?? null,
      inPlayerFirstName: c.inPlayer?.firstName ?? null,
      inPlayerLastName: c.inPlayer?.lastName ?? null,
    })),
  };
}