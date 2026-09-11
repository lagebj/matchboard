/**
 * Event squad presentation view model (Touchline Design Atlas,
 * `06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §C`).
 *
 * Sources:
 * - squads   -> EXISTING_DIRECT (EventSquad: id, name, targetSize/minSize/maxSize)
 * - players  -> EXISTING_DIRECT (EventSquadPlayer, merged Player + GuestPlayer per ADR-0106)
 * Derived:
 * - spotsLeft -> DERIVED_PRESENTATION (targetSize - currentCount, floored at 0)
 *
 * Guest players appear at the same visual level as normal players — `isGuest` is metadata only,
 * never a diminished row treatment (`06§C`).
 */

export interface EventSquadPlayerRowInput {
  participantId: string;
  displayName: string;
  shirtNumber: number | null;
  position: string | null;
  availabilityLabel: string;
  isGuest: boolean;
}

export interface EventSquadRailItemInput {
  squadId: string;
  label: string;
  currentCount: number;
  targetSize: number;
}

export interface EventSquadViewModelInput {
  squadId: string;
  squadName: string;
  opponentSummary: string;
  currentCount: number;
  targetSize: number;
  squadRail: EventSquadRailItemInput[];
  players: EventSquadPlayerRowInput[];
  guestCount: number;
}

export interface EventSquadViewModel extends EventSquadViewModelInput {
  spotsLeft: number;
}

export function buildEventSquadViewModel(input: EventSquadViewModelInput): EventSquadViewModel {
  return { ...input, spotsLeft: Math.max(0, input.targetSize - input.currentCount) };
}
