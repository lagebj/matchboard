export type SelectionSnapshot = {
  createdAt: Date;
  finalizedAt: Date | null;
  id: string;
  matchId: string;
};

function getFinalizedTimeValue(finalizedAt: Date | null): number {
  return finalizedAt ? finalizedAt.getTime() : Number.NEGATIVE_INFINITY;
}

export function compareSelectionSnapshotRecency<T extends SelectionSnapshot>(left: T, right: T): number {
  const createdAtDifference = right.createdAt.getTime() - left.createdAt.getTime();

  if (createdAtDifference !== 0) {
    return createdAtDifference;
  }

  const finalizedAtDifference =
    getFinalizedTimeValue(right.finalizedAt) - getFinalizedTimeValue(left.finalizedAt);

  if (finalizedAtDifference !== 0) {
    return finalizedAtDifference;
  }

  return right.id.localeCompare(left.id);
}

export function getLatestSelectionSnapshotByMatchId<T extends SelectionSnapshot>(
  snapshots: T[],
): Map<string, T> {
  const latestSnapshotByMatchId = new Map<string, T>();

  for (const snapshot of [...snapshots].sort(compareSelectionSnapshotRecency)) {
    if (!latestSnapshotByMatchId.has(snapshot.matchId)) {
      latestSnapshotByMatchId.set(snapshot.matchId, snapshot);
    }
  }

  return latestSnapshotByMatchId;
}

export function getLatestSelectionSnapshots<T extends SelectionSnapshot>(snapshots: T[]): T[] {
  return [...getLatestSelectionSnapshotByMatchId(snapshots).values()];
}
