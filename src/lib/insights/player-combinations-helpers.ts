export const RECENT_ROUNDS_WINDOW = 4;

// Deterministic, order-independent key for an unordered player pair.
export function pairKey(playerIdA: string, playerIdB: string): string {
  return [playerIdA, playerIdB].sort().join(":");
}
