import type { TodayCarryForwardItem } from "@/lib/touchline/presentation/today-carry-forward";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import type { TodaySquadStatus } from "@/lib/touchline/presentation/today-view-model";
import { gateCBaseCommandCentre, gateCNoLiveMatch } from "../shared/fixtures";

/**
 * C01 — Quiet day (register: "One relevant football object", XR-T01/XR-S02/XR-V01). Empty
 * projection decisions, no same-day Matchday, no due reviews -> `selectTodayComposition()`
 * resolves `"QUIET"` for real, not by a hand-set flag. See
 * `docs/ui-lab/gate-c-w1-candidates/CURRENT_STATE_AUDIT.md` for why this confirms the shipped
 * baseline rather than proposing a change.
 */
export const commandCentre = gateCBaseCommandCentre();
export const liveNow = gateCNoLiveMatch();

export const squadStatus: TodaySquadStatus = {
  available: 9,
  doubtful: 1,
  unavailable: 0,
  notAvailable: [],
};

export const upcomingMatches: MatchPresentation[] = [
  {
    id: "match-c01-upcoming-1",
    href: "/matches/match-c01-upcoming-1",
    homeTeam: "Blå",
    awayTeam: "Nordby IL",
    ownTeamSide: "home",
    kickoffDate: "2026-11-14",
    kickoffTime: "17:00",
    lifecycle: "planning_open",
    score: null,
    clockLabel: null,
    resultOutcomeForOwnTeam: "unknown",
    outcomeLabel: null,
    planningAttention: null,
    reportAttention: null,
    cancelledReason: null,
  },
  {
    id: "match-c01-upcoming-2",
    href: "/matches/match-c01-upcoming-2",
    homeTeam: "Vollen",
    awayTeam: "Blå",
    ownTeamSide: "away",
    kickoffDate: "2026-11-21",
    kickoffTime: "11:00",
    lifecycle: "planning_open",
    score: null,
    clockLabel: null,
    resultOutcomeForOwnTeam: "unknown",
    outcomeLabel: null,
    planningAttention: null,
    reportAttention: null,
    cancelledReason: null,
  },
];

export const carryForwardItems: TodayCarryForwardItem[] = [
  { id: "carry-c01-1", label: "Report still open — Blå 3-1 Åsgård", href: "/matches/match-c01-past-1" },
];
