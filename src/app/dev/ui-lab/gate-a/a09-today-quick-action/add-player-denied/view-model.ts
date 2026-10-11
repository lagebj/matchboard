import type { TodayQuickActionCandidate } from "../shared/today-quick-action-sheet";
import { erik } from "./fixtures";

/** Blocked at entry — `eligible: false` so no draft can ever form and Confirm never fires. */
export const candidate: TodayQuickActionCandidate = {
  playerId: erik.playerId,
  displayName: erik.displayName,
  shirtNumber: erik.shirtNumber,
  eligible: false,
  reasons: ["You do not have group access to add players for this team."],
};
