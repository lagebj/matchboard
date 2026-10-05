import type { MatchSegment } from "@/lib/evidence/match-state-timeline";

/** Shared on-pitch seconds between one pair of players. Exposure only — never a chemistry/partnership score. */
export interface CoPresencePair {
  playerAId: string;
  playerBId: string;
  sharedSeconds: number;
}

/**
 * All-pairs teammate co-presence (ADR-0155 §4, source bundle §03's "Teammate co-presence").
 * Reuses `buildSegmentsFromIntervals`'s own maximal-on-pitch-composition segments
 * (`match-state-timeline.ts`, ADR-0113) — this function adds only the all-pairs aggregation over
 * those segments; it never re-derives interval intersection, and it never touches
 * `CombinationEvidence` (a different, named-combination-shaped metric built on the same
 * primitive).
 */
export function computeCoPresencePairs(segments: readonly MatchSegment[]): CoPresencePair[] {
  const sharedMs = new Map<string, number>();

  for (const segment of segments) {
    const durationMs = segment.endMs - segment.startMs;
    if (durationMs <= 0) continue;

    const playerIds = [...segment.playersOnPitch.keys()];
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const key = pairKey(playerIds[i]!, playerIds[j]!);
        sharedMs.set(key, (sharedMs.get(key) ?? 0) + durationMs);
      }
    }
  }

  return [...sharedMs.entries()]
    .map(([key, ms]) => {
      const [playerAId, playerBId] = key.split("\u0000") as [string, string];
      return { playerAId, playerBId, sharedSeconds: ms / 1000 };
    })
    .sort((a, b) => (a.playerAId === b.playerAId ? a.playerBId.localeCompare(b.playerBId) : a.playerAId.localeCompare(b.playerAId)));
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}
