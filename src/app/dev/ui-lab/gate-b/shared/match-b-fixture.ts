import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";
import { primaryDisplayCellFor } from "@/domain/positions/grid";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";
import { buildPlanningPitchSlotsFromFormationSlots } from "@/components/touchline/pitch/formation-slot-projection";
import type { PlanningPitchSlot, PlanningPitchAssignment } from "@/components/touchline/pitch/touchline-planning-pitch";
import type { FormationSlotRoleType } from "@/lib/formations/types";
import type { MatchTimelineItem } from "@/lib/matches/match-detail-view-model";
import type { OpponentMemoryViewModel } from "@/lib/matches/match-insights/opponent-memory-view-model";
import type { SourceRecord } from "../../gate-a/a04-evidence-grammar/shared/coverage";

/**
 * Gate B W1 shared match anchor (B01-B04 Match Details). One fixed team ("Slemmestad Rød", the
 * same squad vocabulary Gate A's W3 shared fixture uses — ADR-0157's stable-identity requirement
 * is about one real team persisting across the programme, not a coincidence to avoid). Each
 * B0x scenario builds its own match identity/kickoff rather than sharing one match object across
 * lifecycle states — B01/B02 are both genuinely still-planning matches but are not the same
 * fixture (a before-match "ready" and "incomplete" state can't coexist on one match), and
 * B03/B04 are two different completed matches by construction (sparse vs. rich evidence is a
 * property of what was actually recorded, not something one match can toggle between). Fixed UTC
 * clocks only — never `Date.now()`.
 */
export const MATCH_B_TEAM_NAME = "Slemmestad Rød";
export const MATCH_B_TEAM_KIT_COLOR = "#C8102E";

export type MatchBSquadMember = {
  playerId: string;
  displayName: string;
  shirtNumber: number;
  tacticalPosition: CanonicalTacticalPosition | null;
  role: "starter" | "reserve";
};

const LINEUP_POSITIONS: readonly CanonicalTacticalPosition[] = ["GK", "LCB", "RCB", "LCM", "CM", "RCM", "CF"];

const ROLE_TYPE_FOR_POSITION: Partial<Record<CanonicalTacticalPosition, FormationSlotRoleType>> = {
  GK: "GOALKEEPER",
  LCB: "DEFENDER",
  RCB: "DEFENDER",
  LCM: "MIDFIELDER",
  CM: "MIDFIELDER",
  RCM: "MIDFIELDER",
  CF: "FORWARD",
};

/** Real canonical grid cells via `primaryDisplayCellFor` (ADR-0154) — never invented coordinates. */
export function matchBPlanningPitchSlots(): PlanningPitchSlot[] {
  return buildPlanningPitchSlotsFromFormationSlots(
    LINEUP_POSITIONS.map((position) => {
      const cell = primaryDisplayCellFor(position);
      return {
        id: `slot-${position}`,
        gridX: cell.gridX,
        gridY: cell.gridY,
        shortLabel: position,
        roleType: ROLE_TYPE_FOR_POSITION[position] ?? "MIDFIELDER",
      };
    }),
  );
}

export function matchBPlanningPitchAssignments(squad: readonly MatchBSquadMember[]): PlanningPitchAssignment[] {
  return squad
    .filter((m): m is MatchBSquadMember & { tacticalPosition: CanonicalTacticalPosition } => m.tacticalPosition !== null)
    .map((m) => ({
      slotId: `slot-${m.tacticalPosition}`,
      playerId: m.playerId,
      name: m.displayName,
      number: m.shirtNumber,
      kitColor: MATCH_B_TEAM_KIT_COLOR,
      locked: false,
    }));
}

/**
 * Pure reducer for a proposed lineup draft (B01's Edit Lineup demo) — explicitly REPLACES
 * whoever currently occupies the target tactical slot (never produces duplicate occupancy: two
 * players can never end up with the same non-null `tacticalPosition`), and never mutates the
 * input squad. Re-displacing from the authoritative squad on every call (rather than tracking
 * incremental deltas) means repeating the same operation can never accumulate a second duplicate.
 */
export function withTacticalAssignment(
  squad: readonly MatchBSquadMember[],
  playerId: string,
  position: CanonicalTacticalPosition,
): MatchBSquadMember[] {
  const incoming = squad.find((m) => m.playerId === playerId);
  if (!incoming) {
    throw new Error(`withTacticalAssignment: "${playerId}" is not a squad member.`);
  }
  if (!LINEUP_POSITIONS.includes(position)) {
    throw new Error(`withTacticalAssignment: "${position}" is not a recognized tactical slot.`);
  }
  return squad.map((member) => {
    if (member.playerId === playerId) {
      return { ...member, tacticalPosition: position, role: "starter" as const };
    }
    if (member.tacticalPosition === position) {
      return { ...member, tacticalPosition: null, role: "reserve" as const };
    }
    return member;
  });
}

// ---------------------------------------------------------------------------
// B01 — planned, ready
// ---------------------------------------------------------------------------

export const B01_MATCH_ID = "match-gate-b-01";
export const B01_KICKOFF_AT = new Date("2026-10-24T10:00:00.000Z");
export const B01_NOW = new Date("2026-10-22T18:00:00.000Z");
export const B01_OPPONENT_NAME = "Nesbru IL";

export const b01MatchIdentity: MatchPresentation = buildMatchPresentation({
  id: B01_MATCH_ID,
  href: null,
  teamName: MATCH_B_TEAM_NAME,
  opponentName: B01_OPPONENT_NAME,
  isHome: true,
  kickoffAt: B01_KICKOFF_AT,
  lifecycleStatus: "planning_open",
});

/** Fully assigned 7-a-side squad — one reserve, all 7 outfield+GK slots filled. */
export const b01Squad: readonly MatchBSquadMember[] = [
  { playerId: "player-gb-oskar", displayName: "Oskar", shirtNumber: 1, tacticalPosition: "GK", role: "starter" },
  { playerId: "player-gb-theodor", displayName: "Theodor", shirtNumber: 4, tacticalPosition: "LCB", role: "starter" },
  { playerId: "player-gb-markus", displayName: "Markus", shirtNumber: 5, tacticalPosition: "RCB", role: "starter" },
  { playerId: "player-gb-sindre", displayName: "Sindre", shirtNumber: 7, tacticalPosition: "LCM", role: "starter" },
  { playerId: "player-gb-kasper", displayName: "Kasper", shirtNumber: 8, tacticalPosition: "CM", role: "starter" },
  { playerId: "player-gb-tobias", displayName: "Tobias", shirtNumber: 12, tacticalPosition: "RCM", role: "starter" },
  { playerId: "player-gb-noah", displayName: "Noah", shirtNumber: 9, tacticalPosition: "CF", role: "starter" },
  { playerId: "player-gb-vetle", displayName: "Vetle", shirtNumber: 14, tacticalPosition: null, role: "reserve" },
];

/** The reserve Edit Lineup proposes moving onto the pitch, for the B01 XR-I01 local-editor demo. */
export const B01_EDIT_SLOT: CanonicalTacticalPosition = "LCM";
export const B01_EDIT_CANDIDATE = { playerId: "player-gb-vetle", displayName: "Vetle", shirtNumber: 14, reasons: ["Already in the matchday squad", "Eligible for LCM — central midfield cover"] };

export const b01OpponentMemory: OpponentMemoryViewModel = {
  hasHistory: true,
  recentEncounters: [
    { matchId: "match-gate-b-prev-1", occurredAt: new Date("2026-05-10T10:00:00.000Z"), resultLabel: "Won 3-1" },
    { matchId: "match-gate-b-prev-2", occurredAt: new Date("2025-09-27T10:00:00.000Z"), resultLabel: "Drew 2-2" },
  ],
  patterns: [{ summary: `${B01_OPPONENT_NAME} press high in the first 15 minutes of every recorded meeting`, qualifier: "seen in 2 of 2 recent meetings" }],
};

/** Backs B01's RCM-exposure insight (`insight-gb1-2`) with genuinely resolvable records — two
 * recorded appearances, both under 30 minutes, rather than an opaque unresolvable fact id. */
export const b01TobiasRcmAppearanceRecords: SourceRecord[] = [
  {
    sourceId: "appearance-gb1-tobias-rcm-1",
    sourceClass: "SYNTHETIC_LABELED",
    provenance: "Recorded match-day appearance",
    scope: `${MATCH_B_TEAM_NAME}, earlier this season`,
    fieldLabel: "Tobias — RCM appearance",
    fieldValue: "22 minutes",
    coverage: "COMPLETE",
  },
  {
    sourceId: "appearance-gb1-tobias-rcm-2",
    sourceClass: "SYNTHETIC_LABELED",
    provenance: "Recorded match-day appearance",
    scope: `${MATCH_B_TEAM_NAME}, earlier this season`,
    fieldLabel: "Tobias — RCM appearance",
    fieldValue: "18 minutes",
    coverage: "COMPLETE",
  },
];

/**
 * Same match identity as `b01MatchIdentity` (same id/teamName/opponentName/kickoffAt/isHome) —
 * only the lifecycle-legitimate fields differ: now `done`, with a recorded result. Demonstrates
 * B01's register-required before/after identity continuity (XR-S01/XR-V01), not a second match.
 */
export const b01AfterMatchIdentity: MatchPresentation = buildMatchPresentation({
  id: B01_MATCH_ID,
  href: null,
  teamName: MATCH_B_TEAM_NAME,
  opponentName: B01_OPPONENT_NAME,
  isHome: true,
  kickoffAt: B01_KICKOFF_AT,
  lifecycleStatus: "done",
  ownGoals: 2,
  opponentGoals: 1,
  outcome: "WON",
});

/** Chronology reconciles exactly with the 2-1 result — all goals timed and accounted for; no
 * reconciliation-note case applies here (that's B03's territory, not B01's). */
export const b01AfterTimeline: MatchTimelineItem[] = [
  { id: "evt-gb1-after-goal-1", kind: "GOAL_FOR", minuteLabel: "15'", playerName: "Noah", assistPlayerName: "Vetle", secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "evt-gb1-after-goal-against-1", kind: "GOAL_AGAINST", minuteLabel: "40'", playerName: null, assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "evt-gb1-after-goal-2", kind: "GOAL_FOR", minuteLabel: "70'", playerName: "Noah", assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
];

// ---------------------------------------------------------------------------
// B02 — planned, incomplete
// ---------------------------------------------------------------------------

export const B02_MATCH_ID = "match-gate-b-02";
export const B02_KICKOFF_AT = new Date("2026-10-25T09:00:00.000Z");
export const B02_NOW = new Date("2026-10-22T18:00:00.000Z");
export const B02_OPPONENT_NAME = "Åsgårdstrand IF";

export const b02MatchIdentity: MatchPresentation = buildMatchPresentation({
  id: B02_MATCH_ID,
  href: null,
  teamName: MATCH_B_TEAM_NAME,
  opponentName: B02_OPPONENT_NAME,
  isHome: true,
  kickoffAt: B02_KICKOFF_AT,
  lifecycleStatus: "planning_open",
});

/** Genuinely incomplete: only 5 of 9 target squad slots selected, none placed on the pitch yet. */
export const b02Squad: readonly MatchBSquadMember[] = [
  { playerId: "player-gb2-oskar", displayName: "Oskar", shirtNumber: 1, tacticalPosition: null, role: "starter" },
  { playerId: "player-gb2-theodor", displayName: "Theodor", shirtNumber: 4, tacticalPosition: null, role: "starter" },
  { playerId: "player-gb2-markus", displayName: "Markus", shirtNumber: 5, tacticalPosition: null, role: "starter" },
  { playerId: "player-gb2-sindre", displayName: "Sindre", shirtNumber: 7, tacticalPosition: null, role: "starter" },
  { playerId: "player-gb2-kasper", displayName: "Kasper", shirtNumber: 8, tacticalPosition: null, role: "starter" },
];

// ---------------------------------------------------------------------------
// B03 — completed, sparse
// ---------------------------------------------------------------------------

export const B03_MATCH_ID = "match-gate-b-03";
export const B03_KICKOFF_AT = new Date("2026-10-04T10:00:00.000Z");
export const B03_OPPONENT_NAME = "Fjordvik Blå";

/**
 * 6-4 own win per the final recorded result. Only ONE goal event was individually logged
 * (`05_DATA_AND_VISUALIZATION_TRUTH.md`: "a 6-4 scoreline may coexist with only one logged goal
 * event") — the scoreline is the canonical result, independent of per-event logging completeness.
 */
export const b03MatchIdentity: MatchPresentation = buildMatchPresentation({
  id: B03_MATCH_ID,
  href: null,
  teamName: MATCH_B_TEAM_NAME,
  opponentName: B03_OPPONENT_NAME,
  isHome: true,
  kickoffAt: B03_KICKOFF_AT,
  lifecycleStatus: "done",
  ownGoals: 6,
  opponentGoals: 4,
  outcome: "WON",
});

export const b03Timeline: MatchTimelineItem[] = [
  {
    id: "evt-gb3-goal-1",
    kind: "GOAL_FOR",
    minuteLabel: "23'",
    playerName: "Noah",
    assistPlayerName: null,
    secondaryPlayerName: null,
    sourceIsCanonicalLiveEvent: false,
  },
];

// ---------------------------------------------------------------------------
// B04 — completed, rich
// ---------------------------------------------------------------------------

export const B04_MATCH_ID = "match-gate-b-04";
export const B04_KICKOFF_AT = new Date("2026-10-18T10:00:00.000Z");
export const B04_OPPONENT_NAME = "Nesbru IL";

/** A genuine second match, backing the Noah+Sindre combination insight's "2 matches" claim with
 * a real second source — not a second goal within this same match miscounted as a second match. */
export const B04_PRIOR_MATCH_ID = "match-gate-b-04-prev-1";
export const B04_PRIOR_KICKOFF_AT = new Date("2026-09-20T10:00:00.000Z");
export const B04_PRIOR_OPPONENT_NAME = "Krokstadelva IL";
export const B04_PRIOR_GOAL_EVENT_ID = "evt-gb4-prev-1-goal-1";

/** 4-1 own win, every goal individually logged — chronology matches the final score exactly. */
export const b04MatchIdentity: MatchPresentation = buildMatchPresentation({
  id: B04_MATCH_ID,
  href: null,
  teamName: MATCH_B_TEAM_NAME,
  opponentName: B04_OPPONENT_NAME,
  isHome: true,
  kickoffAt: B04_KICKOFF_AT,
  lifecycleStatus: "done",
  ownGoals: 4,
  opponentGoals: 1,
  outcome: "WON",
});

export const b04Timeline: MatchTimelineItem[] = [
  { id: "evt-gb4-goal-1", kind: "GOAL_FOR", minuteLabel: "8'", playerName: "Noah", assistPlayerName: "Sindre", secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "evt-gb4-goal-against-1", kind: "GOAL_AGAINST", minuteLabel: "19'", playerName: null, assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "evt-gb4-rotation-1", kind: "ROTATION", minuteLabel: "40'", playerName: "Kasper", assistPlayerName: null, secondaryPlayerName: "Tobias", sourceIsCanonicalLiveEvent: true },
  { id: "evt-gb4-goal-2", kind: "GOAL_FOR", minuteLabel: "52'", playerName: "Noah", assistPlayerName: "Kasper", secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "evt-gb4-goal-3", kind: "GOAL_FOR", minuteLabel: "61'", playerName: "Sindre", assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: false },
  { id: "evt-gb4-goal-4", kind: "GOAL_FOR", minuteLabel: "77'", playerName: "Tobias", assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: false },
  { id: "evt-gb4-end", kind: "MATCH_END", minuteLabel: "80'", playerName: null, assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
];

/** The two genuinely distinct recorded sources backing the Noah+Sindre "2 matches" insight —
 * this match's own canonical event, plus the prior match's. Two different `scope` strings, two
 * different matches, not one event counted twice. */
export const b04CombinationSourceRecords: SourceRecord[] = [
  {
    sourceId: "evt-gb4-goal-1",
    sourceClass: "SYNTHETIC_LABELED",
    provenance: "Canonical live match event",
    scope: `${MATCH_B_TEAM_NAME} vs ${B04_OPPONENT_NAME}, 18 Oct 2026`,
    fieldLabel: "Goal — Noah, assisted by Sindre",
    fieldValue: "8' · evt-gb4-goal-1",
    coverage: "COMPLETE",
  },
  {
    sourceId: B04_PRIOR_GOAL_EVENT_ID,
    sourceClass: "SYNTHETIC_LABELED",
    provenance: "Canonical live match event",
    scope: `${MATCH_B_TEAM_NAME} vs ${B04_PRIOR_OPPONENT_NAME}, 20 Sep 2026`,
    fieldLabel: "Goal — Noah, assisted by Sindre",
    fieldValue: `12' · ${B04_PRIOR_GOAL_EVENT_ID}`,
    coverage: "COMPLETE",
  },
];

/** Backs `whatThisMatchAddedInput.observationCount` with genuine records rather than a bare
 * count. */
export const b04FootballObservations: readonly { id: string; summary: string }[] = [
  { id: "obs-gb4-1", summary: "First match this season at a 4-3-1 shape without the ball." },
  { id: "obs-gb4-2", summary: "Noah and Sindre's combination play was a recurring attacking outlet." },
];
