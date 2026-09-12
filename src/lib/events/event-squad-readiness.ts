/**
 * Pure adapter: real `EventSquad` rows (already loaded on the Event detail page, no new query)
 * -> `EventSquadReadinessInput[]` (`src/lib/touchline/presentation/event-view-model.ts`,
 * Touchline Design Atlas ADR-0136).
 *
 * Kept separate from `event-detail.tsx` (a large `"use client"` component with substantial
 * server-action surface) so this computation is directly unit-testable, matching
 * `today-match-presentation.ts`/`event-list-presentation.ts`'s same extraction pattern.
 */

import type { EventSquadReadinessInput } from "@/lib/touchline/presentation/event-view-model";

export interface EventSquadReadinessSource {
  id: string;
  name: string;
  targetSize: number;
  players: Array<{ isGK: boolean }>;
}

export function computeEventSquadReadiness(squads: EventSquadReadinessSource[]): EventSquadReadinessInput[] {
  return squads.map((s) => ({
    squadId: s.id,
    squadName: s.name,
    currentCount: s.players.length,
    targetSize: s.targetSize,
    hasGoalkeeper: s.players.some((p) => p.isGK),
    missingCount: Math.max(0, s.targetSize - s.players.length),
  }));
}
