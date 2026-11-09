import { gateCBaseCommandCentre, gateCBuildBusyDay, gateCNoLiveMatch } from "../../../shared/fixtures";

/** C03 — League · Verify (register: "Matchday or live", "Before kickoff/live", XR-T01/XR-V02). */
const busyDay = gateCBuildBusyDay({ source: "LEAGUE", phase: "VERIFY" });

export const commandCentre = gateCBaseCommandCentre({ todayMatches: busyDay.todayMatches });
export const liveNow = gateCNoLiveMatch();
export const matchdayContext = busyDay.matchdayContext;
export const nowIso = busyDay.nowIso;
