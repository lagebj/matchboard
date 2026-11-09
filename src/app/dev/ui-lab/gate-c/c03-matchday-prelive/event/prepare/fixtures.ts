import { gateCBaseCommandCentre, gateCBuildBusyDay, gateCNoLiveMatch } from "../../../shared/fixtures";

/** C03 — Event · Prepare (register: "Matchday or live", "Before kickoff/live", XR-T01/XR-V02). */
const busyDay = gateCBuildBusyDay({ source: "EVENT", phase: "PREPARE" });

export const commandCentre = gateCBaseCommandCentre({ todayMatches: busyDay.todayMatches });
export const liveNow = gateCNoLiveMatch();
export const matchdayContext = busyDay.matchdayContext;
export const nowIso = busyDay.nowIso;
export const squadStatus = busyDay.squadStatus;
