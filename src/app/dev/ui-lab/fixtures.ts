/**
 * UI Lab fixture data (bundle `13_UI_LAB_AND_GOLDEN_GATE.md §2`).
 *
 * Representative, in-memory only — no database, no production writes. Names and
 * scores echo the golden references so the seven rendered screens can be
 * compared to `references/golden/*`; they are not literal domain fixtures.
 */
import { CalendarRange, CalendarPlus, BarChart3, Users, Goal, ArrowLeftRight, ThumbsUp, AlertTriangle, Bookmark } from "lucide-react";
import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";
import {
  buildTouchlineNav,
  type TouchlineNavKey,
  type QuickAction,
  type MetricStripItem,
  type LiveAction,
  type BenchRailPlayer,
  type PositionFitEntry,
} from "@/components/touchline";
import type {
  TacticsBoardSlot,
  TacticsBoardAssignment,
  TacticsBoardPlayer,
} from "@/components/formations/tactics-board";

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

/* --- Touchline Finish & Visual Convergence follow-up fixtures ---------- */

/* Shell (widget-rich Today composition) ---------------------------------- */

export const shellNextMatch = buildMatchPresentation({
  id: "shell-next",
  href: null,
  teamName: "Rød",
  opponentName: "Graabein United",
  isHome: true,
  kickoffAt: "2026-09-12T13:00:00",
  lifecycleStatus: "planning_open",
});

export const shellSquadStatus: MetricStripItem[] = [
  { id: "available", label: "Available", value: "18", tone: "accent" },
  { id: "doubtful", label: "Doubtful", value: "2", tone: "attention" },
  { id: "unavailable", label: "Unavailable", value: "1", tone: "danger" },
];

export const shellNotAvailable: { name: string; reason: string; tone: "danger" | "attention" }[] = [
  { name: "Oliver Hansen", reason: "Injured", tone: "danger" },
  { name: "Marius Dahl", reason: "Questionable", tone: "attention" },
  { name: "Sander Nilsen", reason: "Illness", tone: "attention" },
];

export const shellRecentMatches: MatchPresentation[] = [
  finalRow("shell-1", { team: "Sætre Lions", opponent: "Rød", isHome: true, ownGoals: 6, opponentGoals: 4, outcome: "WON" }),
  finalRow("shell-2", { team: "Rød", opponent: "Graabein United", isHome: true, ownGoals: 7, opponentGoals: 2, outcome: "WON" }),
  finalRow("shell-3", { team: "Hurum City", opponent: "Rød", isHome: true, ownGoals: 3, opponentGoals: 4, outcome: "LOST" }),
];

export const shellQuickActions: QuickAction[] = [
  { key: "round-board", label: "Round Board", icon: CalendarRange, href: "/dev/ui-lab/round-board", dominant: true },
  { key: "add-match", label: "Add match", icon: CalendarPlus, href: "/dev/ui-lab/league" },
  { key: "insights", label: "View insights", icon: BarChart3, href: "/dev/ui-lab/insights" },
  { key: "players", label: "Players", icon: Users, href: "/dev/ui-lab" },
];

export const shellThisWeek: { label: string; meta: string; tag?: string }[] = [
  { label: "Rød vs Graabein United", meta: "Sat 13:00 · League · Pitch 1", tag: "2 decisions" },
  { label: "Hvit vs Tofte", meta: "Sat 14:20 · Friendly · Pitch 3" },
];

/* Event squad ------------------------------------------------------------- */

export const eventSquadCapacity = { value: 12, max: 14 };

export const eventSquadPlayers: {
  number: number;
  name: string;
  code: string;
  status: "available" | "guest" | "unavailable";
  detail: string;
}[] = [
  { number: 1, name: "Marius", code: "GK", status: "available", detail: "Available" },
  { number: 2, name: "Sander", code: "LB", status: "available", detail: "Available" },
  { number: 4, name: "Emil", code: "CB", status: "available", detail: "Available" },
  { number: 6, name: "Henrik", code: "RB", status: "available", detail: "Available" },
  { number: 8, name: "Noah", code: "LM", status: "available", detail: "Available" },
  { number: 10, name: "Elias", code: "CM", status: "available", detail: "Available" },
  { number: 11, name: "Oliver", code: "ST", status: "available", detail: "Available" },
  { number: 12, name: "Jonas", code: "RW", status: "unavailable", detail: "Travelling" },
  { number: 14, name: "Adam", code: "CM", status: "available", detail: "Available" },
  { number: 15, name: "Lukas", code: "CB", status: "guest", detail: "Guest player" },
  { number: 16, name: "Theo", code: "LW", status: "available", detail: "Available" },
  { number: 17, name: "Isak", code: "ST", status: "unavailable", detail: "Not available" },
];

/* Lineup / tactics (4-3-3, vertical pitch) -------------------------------- */

const LINEUP_SLOT_SEED: {
  id: string;
  gridX: number;
  gridY: number;
  shortLabel: string;
  roleType: TacticsBoardSlot["roleType"];
  playerId: string;
}[] = [
  { id: "slot-lw", gridX: 1, gridY: 1, shortLabel: "LW", roleType: "ATTACKING_MIDFIELDER", playerId: "oliver" },
  { id: "slot-st", gridX: 2, gridY: 0, shortLabel: "ST", roleType: "FORWARD", playerId: "henrik" },
  { id: "slot-rw", gridX: 3, gridY: 1, shortLabel: "RW", roleType: "ATTACKING_MIDFIELDER", playerId: "noah" },
  { id: "slot-lm", gridX: 0, gridY: 2, shortLabel: "LM", roleType: "MIDFIELDER", playerId: "elias" },
  { id: "slot-cm", gridX: 2, gridY: 2, shortLabel: "CM", roleType: "MIDFIELDER", playerId: "emil" },
  { id: "slot-rm", gridX: 4, gridY: 2, shortLabel: "RM", roleType: "MIDFIELDER", playerId: "sander" },
  { id: "slot-lb", gridX: 0, gridY: 4, shortLabel: "LB", roleType: "DEFENDER", playerId: "marius" },
  { id: "slot-cb1", gridX: 1, gridY: 4, shortLabel: "CB", roleType: "DEFENDER", playerId: "lars" },
  { id: "slot-cb2", gridX: 3, gridY: 4, shortLabel: "CB", roleType: "DEFENDER", playerId: "jonas" },
  { id: "slot-rb", gridX: 4, gridY: 4, shortLabel: "RB", roleType: "DEFENDER", playerId: "david" },
  { id: "slot-gk", gridX: 2, gridY: 5, shortLabel: "GK", roleType: "GOALKEEPER", playerId: "kristian" },
];

export const lineupSlots: TacticsBoardSlot[] = LINEUP_SLOT_SEED.map((s, i) => ({
  id: s.id,
  gridX: s.gridX,
  gridY: s.gridY,
  label: s.shortLabel,
  shortLabel: s.shortLabel,
  roleType: s.roleType,
  acceptedPositionIds: [],
  sortOrder: i,
}));

export const lineupAssignments: TacticsBoardAssignment[] = LINEUP_SLOT_SEED.map((s) => ({
  id: `assignment-${s.id}`,
  slotId: s.id,
  playerId: s.playerId,
  locked: false,
  source: "MANUAL",
}));

const LINEUP_PLAYER_SEED: { id: string; firstName: string; lastName: string; shirtNumber: number }[] = [
  { id: "oliver", firstName: "Oliver", lastName: "Hansen", shirtNumber: 11 },
  { id: "henrik", firstName: "Henrik", lastName: "Berg", shirtNumber: 9 },
  { id: "noah", firstName: "Noah", lastName: "Larsen", shirtNumber: 7 },
  { id: "elias", firstName: "Elias", lastName: "Dahl", shirtNumber: 8 },
  { id: "emil", firstName: "Emil", lastName: "Nilsen", shirtNumber: 6 },
  { id: "sander", firstName: "Sander", lastName: "Aas", shirtNumber: 10 },
  { id: "marius", firstName: "Marius", lastName: "Holm", shirtNumber: 3 },
  { id: "lars", firstName: "Lars", lastName: "Vik", shirtNumber: 5 },
  { id: "jonas", firstName: "Jonas", lastName: "Bakke", shirtNumber: 4 },
  { id: "david", firstName: "David", lastName: "Strand", shirtNumber: 2 },
  { id: "kristian", firstName: "Kristian", lastName: "Foss", shirtNumber: 1 },
];

export const lineupPlayers: TacticsBoardPlayer[] = LINEUP_PLAYER_SEED.map((p) => ({
  id: p.id,
  firstName: p.firstName,
  lastName: p.lastName,
  primaryPosition: "",
  shirtNumber: p.shirtNumber,
}));

export const lineupBench: BenchRailPlayer[] = [
  { id: "sander-2", name: "Sander", role: "LM", number: 12 },
  { id: "oscar", name: "Oscar", role: "LW", number: 14 },
  { id: "teo", name: "Teo", role: "CM", number: 15 },
  { id: "hakon", name: "Håkon", role: "CB", number: 16 },
  { id: "adam", name: "Adam", role: "RB", number: 17 },
  { id: "lukas", name: "Lukas", role: "ST", number: 18 },
  { id: "isak", name: "Isak", role: "GK", number: 20 },
];

export const lineupSelectedPlayerFit: PositionFitEntry[] = [
  { tier: "NATURAL", roles: ["LM"] },
  { tier: "STRONG", roles: ["LW", "CM"] },
  { tier: "PLAUSIBLE", roles: ["LWB", "AM"] },
];

/* Live reporting ----------------------------------------------------------- */

export const liveReportingMatch = buildMatchPresentation({
  id: "live-reporting",
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

/**
 * Only canonical `LiveMatchEventType` actions (Goal for/against, Rotation,
 * Fair play +/concern, Moment marked) — the golden reference's Shot / Yellow
 * / Red / Foul / Corner / Free kick are NOT modelled by the live-reporting
 * domain today and are deliberately not reproduced here (see the
 * conformance report's documented deviation).
 */
export const liveReportingActions: LiveAction[] = [
  { key: "goal-for", label: "Goal for us", icon: Goal, tone: "primary" },
  { key: "goal-against", label: "Goal for them", icon: Goal, tone: "neutral" },
  { key: "rotation", label: "Rotation", icon: ArrowLeftRight, tone: "neutral" },
  { key: "fair-play-positive", label: "Fair play +", icon: ThumbsUp, tone: "neutral" },
  { key: "fair-play-concern", label: "Fair play concern", icon: AlertTriangle, tone: "attention" },
  { key: "moment", label: "Moment marked", icon: Bookmark, tone: "neutral" },
];

export const liveReportingEvents: { time: string; tag: string; text: string; score?: string }[] = [
  { time: "31:08", tag: "GOAL", text: "Noah", score: "3–2" },
  { time: "24:17", tag: "GOAL", text: "Graabein United", score: "2–2" },
  { time: "18:42", tag: "ROTATION", text: "Oliver → Marius (Rød)" },
  { time: "16:11", tag: "FAIR PLAY", text: "Henrik (Rød) — positive" },
  { time: "12:03", tag: "GOAL", text: "Elias (Rød)", score: "2–1" },
];

export const liveReportingRoster: { name: string; code: string; number: number }[] = [
  { name: "Marius", code: "GK", number: 1 },
  { name: "Noah", code: "LW", number: 4 },
  { name: "Emil", code: "CB", number: 6 },
  { name: "Henrik", code: "RB", number: 8 },
];

/* Player detail ------------------------------------------------------------ */

export const playerDetailIdentity = {
  name: "Noah Larsen",
  number: 10,
  role: "Left Wing",
  group: "G2015 · Autumn 2026",
  team: "Graabein United",
};

export const playerDetailParticipation: MetricStripItem[] = [
  { id: "matches", label: "Matches", value: "11" },
  { id: "minutes", label: "Minutes", value: "327" },
  { id: "starts", label: "Starts", value: "8" },
  { id: "goals", label: "Goals", value: "2" },
  { id: "assists", label: "Assists", value: "4" },
];

export const playerDetailOpportunity: { weekLabel: string; value: number; isCurrent?: boolean }[] = [
  { weekLabel: "W32", value: 30 },
  { weekLabel: "W33", value: 45 },
  { weekLabel: "W34", value: 100, isCurrent: true },
  { weekLabel: "W35", value: 20 },
  { weekLabel: "W36", value: 55 },
];

export const playerDetailPositionExposure: { code: string; pct: number }[] = [
  { code: "LW", pct: 68 },
  { code: "LM", pct: 22 },
  { code: "ST", pct: 10 },
];

export const playerDetailObservation = {
  dateLabel: "7 Sep",
  text:
    "Noah stayed available for the pass on the left and looked to connect with teammates in the final third.",
  tags: ["Stayed available for pass", "Connected with teammates", "Final third decisions"],
};

export const playerDetailRecentFootball: { date: string; label: string; context: string; goals?: number; assists?: number }[] = [
  { date: "12 Sep", label: "Slemmestad Rød", context: "Skrim Kiwi Bama Cup", goals: 1, assists: 1 },
  { date: "10 Sep", label: "Rød vs Graabein United", context: "G2015 · League", assists: 1 },
  { date: "31 Aug", label: "Sætre Lions", context: "G2015 · League", goals: 1 },
];
