/**
 * UI Lab fixture data (bundle `13_UI_LAB_AND_GOLDEN_GATE.md §2`).
 *
 * Representative, in-memory only — no database, no production writes. Names and
 * scores echo the golden references so the seven rendered screens can be
 * compared to `references/golden/*`; they are not literal domain fixtures.
 */
import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";
import { buildTouchlineNav, type TouchlineNavKey } from "@/components/touchline";

export const UI_LAB_ORG_CONTEXT = "Slemmestad IF · G2015 · Autumn 2026";
export const UI_LAB_SEASON = "Autumn 2026 · Jul–Dec";

export function uiLabNav(activeKey: TouchlineNavKey) {
  return {
    items: buildTouchlineNav((key) => `/dev/ui-lab/${navRoute(key)}`),
    activeKey,
  };
}

function navRoute(key: TouchlineNavKey): string {
  switch (key) {
    case "today":
      return "today";
    case "league":
      return "league";
    case "events":
      return "event-day";
    case "players":
      return "";
    case "more":
      return "insights";
  }
}

/* --- League scorebook -------------------------------------------------- */

type Row = {
  team: string;
  opponent: string;
  isHome: boolean;
  ownGoals: number;
  opponentGoals: number;
  outcome: "WON" | "LOST" | "DRAWN";
};

function finalRow(id: string, r: Row): MatchPresentation {
  return buildMatchPresentation({
    id,
    href: null,
    teamName: r.team,
    opponentName: r.opponent,
    isHome: r.isHome,
    kickoffAt: null,
    lifecycleStatus: "done",
    ownGoals: r.ownGoals,
    opponentGoals: r.opponentGoals,
    outcome: r.outcome,
  });
}

export const leagueRounds: {
  marker: string;
  dateLabel: string;
  summary: string;
  rows: MatchPresentation[];
}[] = [
  {
    marker: "W34",
    dateLabel: "24 Aug",
    summary: "Final · 3 matches",
    rows: [
      finalRow("w34-1", { team: "Rød", opponent: "Graabein United", isHome: true, ownGoals: 7, opponentGoals: 2, outcome: "WON" }),
      finalRow("w34-2", { team: "Blå", opponent: "ROS Victors", isHome: false, ownGoals: 9, opponentGoals: 8, outcome: "WON" }),
      finalRow("w34-3", { team: "Hvit", opponent: "Tofte Fremad 1", isHome: true, ownGoals: 7, opponentGoals: 3, outcome: "WON" }),
    ],
  },
  {
    marker: "W35",
    dateLabel: "31 Aug",
    summary: "Final · 3 matches",
    rows: [
      finalRow("w35-1", { team: "Rød", opponent: "Sætre Lions", isHome: true, ownGoals: 6, opponentGoals: 4, outcome: "WON" }),
      finalRow("w35-2", { team: "Blå", opponent: "Åros United", isHome: true, ownGoals: 5, opponentGoals: 5, outcome: "DRAWN" }),
      finalRow("w35-3", { team: "Hvit", opponent: "Hurum City", isHome: true, ownGoals: 3, opponentGoals: 4, outcome: "LOST" }),
    ],
  },
];

/* --- Today ----------------------------------------------------------- */

export const todayNextMatch = buildMatchPresentation({
  id: "today-next",
  href: null,
  teamName: "Rød",
  opponentName: "Graabein United",
  isHome: true,
  kickoffAt: "2026-09-12T13:00:00",
  lifecycleStatus: "planning_open",
});

export const todayDateRail = [
  { id: "mon", sublabel: "Mon", label: "7" },
  { id: "tue", sublabel: "Tue", label: "8" },
  { id: "wed", sublabel: "Wed", label: "9" },
  { id: "thu", sublabel: "Thu", label: "10" },
  { id: "fri", sublabel: "Fri", label: "11" },
  { id: "sat", sublabel: "Sat", label: "12" },
];

/* --- Event day ------------------------------------------------------- */

export const eventNextMatch = buildMatchPresentation({
  id: "event-next",
  href: null,
  teamName: "Slemmestad Rød",
  opponentName: "Skrim United",
  isHome: true,
  kickoffAt: "2026-09-12T11:10:00",
  lifecycleStatus: "planning_open",
});

export const eventDayRail = [
  { id: "sat", sublabel: "Sat", label: "12" },
  { id: "sun", sublabel: "Sun", label: "13" },
];

export const eventSquadRail = [
  { id: "rod", label: "Rød" },
  { id: "hvit", label: "Hvit" },
  { id: "bla", label: "Blå" },
];

/* --- Follow Live --------------------------------------------------- */

export const followLiveMatch = buildMatchPresentation({
  id: "follow-live",
  href: null,
  teamName: "Rød",
  opponentName: "Graabein United",
  isHome: true,
  kickoffAt: "2026-09-10T12:30:00",
  lifecycleStatus: "live",
  ownGoals: 3,
  opponentGoals: 2,
  liveClockLabel: "34:12",
});

export const followLiveOnField: { code: string; name: string }[] = [
  { code: "GK", name: "Marius" },
  { code: "LB", name: "Sander" },
  { code: "CB", name: "Emil" },
  { code: "RB", name: "Henrik" },
  { code: "LM", name: "Noah" },
  { code: "CM", name: "Elias" },
  { code: "ST", name: "Oliver" },
];

export const followLiveEvents: { time: string; tag: string; text: string }[] = [
  { time: "31:08", tag: "GOAL", text: "Rød · Noah" },
  { time: "24:17", tag: "GOAL", text: "Graabein United" },
  { time: "18:42", tag: "ROT", text: "Henrik to RB" },
];

/* --- Round Board -------------------------------------------------- */

export const roundBoardColumns: {
  title: string;
  meta: string;
  players: { name: string; code: string }[];
}[] = [
  {
    title: "Rød · vs Graabein",
    meta: "13:00 · 8 players · 1 decision",
    players: [
      { name: "Noah", code: "LW" },
      { name: "Emil", code: "CM" },
      { name: "Elias", code: "RB" },
      { name: "Henrik", code: "ST" },
      { name: "Sander", code: "GK" },
      { name: "Marius", code: "LM" },
    ],
  },
  {
    title: "Hvit · vs Tofte",
    meta: "13:00 · 8 players · 1 decision",
    players: [
      { name: "Noah", code: "LW" },
      { name: "Emil", code: "CM" },
      { name: "Elias", code: "RB" },
      { name: "Henrik", code: "ST" },
      { name: "Sander", code: "GK" },
      { name: "Marius", code: "LM" },
    ],
  },
  {
    title: "Blå · vs ROS",
    meta: "13:00 · 8 players · 1 decision",
    players: [
      { name: "Noah", code: "LW" },
      { name: "Emil", code: "CM" },
      { name: "Elias", code: "RB" },
      { name: "Henrik", code: "ST" },
      { name: "Sander", code: "GK" },
      { name: "Marius", code: "LM" },
    ],
  },
];
