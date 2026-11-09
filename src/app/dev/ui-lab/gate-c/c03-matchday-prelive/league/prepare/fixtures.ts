import { gateCBaseCommandCentre, gateCBuildMatchdayContext, gateCNoLiveMatch } from "../../../shared/fixtures";

/** C03 — League · Prepare (register: "Matchday or live", "Before kickoff/live", XR-T01/XR-V02). */
export const commandCentre = gateCBaseCommandCentre();
export const liveNow = gateCNoLiveMatch();
export const matchdayContext = gateCBuildMatchdayContext({ source: "LEAGUE", phase: "PREPARE" });
