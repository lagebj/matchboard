import type { TodayQuickActionCandidate } from "../shared/today-quick-action-sheet";
import { jonas } from "./fixtures";

export const candidate: TodayQuickActionCandidate = {
  playerId: jonas.playerId,
  displayName: jonas.displayName,
  shirtNumber: jonas.shirtNumber,
  eligible: false,
  reasons: ["No response received before the RSVP cutoff (Fri 18:00) — treated as declined for planned selection."],
};
