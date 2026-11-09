import { gateCBaseCommandCentre, gateCBuildMatchdayContext, gateCNoLiveMatch } from "../../../shared/fixtures";

/** C03 — Event · Imminent (register: "Matchday or live", "Before kickoff/live", XR-T01/XR-V02). */
export const commandCentre = gateCBaseCommandCentre();
export const liveNow = gateCNoLiveMatch();
export const matchdayContext = gateCBuildMatchdayContext({ source: "EVENT", phase: "IMMINENT" });
