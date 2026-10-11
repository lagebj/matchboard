import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";
import { primaryDisplayCellFor } from "@/domain/positions/grid";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";
import { buildPlanningPitchSlotsFromFormationSlots } from "@/components/touchline/pitch/formation-slot-projection";
import type { PlanningPitchSlot, PlanningPitchAssignment } from "@/components/touchline/pitch/touchline-planning-pitch";
import type { FormationSlotRoleType } from "@/lib/formations/types";

/**
 * Gate A W3 shared match anchor (bundle `02_SCENARIOS_AND_FIXTURES.md` "Shared deterministic
 * anchor"): one fictional League match, reused by every A03/A07/A09 scenario so the same match
 * ID, teams, kickoff, and selected squad persist across the whole wave (XR-S01/XR-V02). Fixed UTC
 * clocks only — never `Date.now()` (`21_FIXTURE_CAPTURE_AND_AUTHORITY.md`).
 */
export const MATCH_W3_FIXTURE_ID = "gate-a-w3-match-1@v1";
export const MATCH_W3_ID = "match-w3-01";
export const MATCH_W3_GROUP_ID = "group-w3-a";
export const MATCH_W3_ROUND_ID = "round-w3-04";
export const MATCH_W3_ROUND_LABEL = "Round 4";
export const MATCH_W3_TEAM_ID = "team-w3-slemmestad-rod";
export const MATCH_W3_TEAM_NAME = "Slemmestad Rød";
export const MATCH_W3_OPPONENT_NAME = "Fjordvik Blå";
export const MATCH_W3_TEAM_KIT_COLOR = "#C8102E";

/** 12:00 Europe/Oslo (CEST, UTC+2 — before the 25 Oct 2026 DST changeover). */
export const MATCH_W3_KICKOFF_AT = new Date("2026-10-11T10:00:00.000Z");

/** Fixed simulation clocks (never `Date.now()`) — the one "now" each scenario explicitly opts into. */
export const MATCH_W3_NOW_PLANNING_OPEN = new Date("2026-10-10T12:00:00.000Z");
/** 5 minutes after kickoff — the real `startsAt <= now` boundary, not the coarser display-day check. */
export const MATCH_W3_NOW_PLANNING_CLOSED = new Date("2026-10-11T10:05:00.000Z");
/** 18:00 the evening before kickoff — the synthetic RSVP response cutoff used by A09-S3. */
export const MATCH_W3_RSVP_CUTOFF_AT = new Date("2026-10-10T18:00:00.000Z");

export const matchW3Identity: MatchPresentation = buildMatchPresentation({
  id: MATCH_W3_ID,
  href: null,
  teamName: MATCH_W3_TEAM_NAME,
  opponentName: MATCH_W3_OPPONENT_NAME,
  isHome: true,
  kickoffAt: MATCH_W3_KICKOFF_AT,
  lifecycleStatus: "planning_open",
});

/** Same match, same fixed kickoff — only the lifecycle differs, for `planning_closed` scenarios (A03-S2, A07-S5, A09-S4). */
export const matchW3ClosedIdentity: MatchPresentation = buildMatchPresentation({
  id: MATCH_W3_ID,
  href: null,
  teamName: MATCH_W3_TEAM_NAME,
  opponentName: MATCH_W3_OPPONENT_NAME,
  isHome: true,
  kickoffAt: MATCH_W3_KICKOFF_AT,
  lifecycleStatus: "planning_closed",
});

/**
 * 7v7, 7 assigned starters + 1 reserve = 8 squad members, 9 planned target (bundle's own anchor
 * numbers). `tacticalPosition: null` means "in the squad, not yet placed on the pitch" — a roster
 * member is not the same as a position assignment (`17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md`
 * A07 §2). Tobias is the 7th confirmed starter whose exact tactical slot (RCM) has not been
 * locked in yet — A03-S1's "unfilled match squad/position decision" and A07's editable slot are
 * the SAME real gap, not two different invented ones. Vetle is the genuine reserve: a squad
 * member, never provisionally slotted, who stays on the bench in every A07 scenario.
 */
export type MatchW3SquadMember = {
  playerId: string;
  displayName: string;
  shirtNumber: number;
  tacticalPosition: CanonicalTacticalPosition | null;
  /** Whether this member is one of the 7 confirmed starters (slot may still be pending) or the 1 reserve. */
  role: "starter" | "reserve";
  source: "planned";
};

export const MATCH_W3_TARGET_SQUAD_SIZE = 9;
export const MATCH_W3_UNFILLED_SLOT: CanonicalTacticalPosition = "RCM";
/** The starter whose exact slot is still pending — the A07 edit target. */
export const MATCH_W3_PENDING_STARTER_PLAYER_ID = "player-w3-tobias";
/** The genuine bench reserve — never touches the pitch in any W3 scenario. */
export const MATCH_W3_RESERVE_PLAYER_ID = "player-w3-vetle";

export const matchW3Squad: readonly MatchW3SquadMember[] = [
  { playerId: "player-w3-oskar", displayName: "Oskar", shirtNumber: 1, tacticalPosition: "GK", role: "starter", source: "planned" },
  { playerId: "player-w3-theodor", displayName: "Theodor", shirtNumber: 4, tacticalPosition: "LCB", role: "starter", source: "planned" },
  { playerId: "player-w3-markus", displayName: "Markus", shirtNumber: 5, tacticalPosition: "RCB", role: "starter", source: "planned" },
  { playerId: "player-w3-sindre", displayName: "Sindre", shirtNumber: 7, tacticalPosition: "LCM", role: "starter", source: "planned" },
  { playerId: "player-w3-kasper", displayName: "Kasper", shirtNumber: 8, tacticalPosition: "CM", role: "starter", source: "planned" },
  { playerId: "player-w3-noah", displayName: "Noah", shirtNumber: 9, tacticalPosition: "CF", role: "starter", source: "planned" },
  { playerId: "player-w3-tobias", displayName: "Tobias", shirtNumber: 12, tacticalPosition: null, role: "starter", source: "planned" },
  { playerId: "player-w3-vetle", displayName: "Vetle", shirtNumber: 14, tacticalPosition: null, role: "reserve", source: "planned" },
];

/** Current planned-selection squad size (8) — the same number A09 renders as the "current" half of its 8/9 preview. */
export const MATCH_W3_CURRENT_SQUAD_SIZE = matchW3Squad.length;

/** Every slotId this fixture ever renders, so a scenario can prove "no duplicate slots" (`04_TESTS_AND_CAPTURE_MATRIX.md` #3). */
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

/**
 * Real canonical grid cells via `primaryDisplayCellFor` (ADR-0154) — never invented coordinates.
 * Same slot set for every A07 scenario; only `matchW3PlanningPitchAssignments`'s input squad
 * differs (the "before"/"after" of a proposed draft).
 */
export function matchW3PlanningPitchSlots(): PlanningPitchSlot[] {
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

export function matchW3PlanningPitchAssignments(
  squad: readonly MatchW3SquadMember[] = matchW3Squad,
  selectedPlayerId: string | null = null,
): PlanningPitchAssignment[] {
  return squad
    .filter((m): m is MatchW3SquadMember & { tacticalPosition: CanonicalTacticalPosition } => m.tacticalPosition !== null)
    .map((m) => ({
      slotId: `slot-${m.tacticalPosition}`,
      playerId: m.playerId,
      name: m.displayName,
      number: m.shirtNumber,
      kitColor: MATCH_W3_TEAM_KIT_COLOR,
      locked: false,
      selected: m.playerId === selectedPlayerId,
    }));
}

/** Pure reducer for a proposed lineup draft — never mutates `matchW3Squad` itself. */
export function withTacticalAssignment(
  squad: readonly MatchW3SquadMember[],
  playerId: string,
  position: CanonicalTacticalPosition,
): MatchW3SquadMember[] {
  if (!squad.some((m) => m.playerId === playerId)) {
    throw new Error(`withTacticalAssignment: "${playerId}" is not a squad member — a roster membership check must happen before a slot assignment, never the reverse.`);
  }
  return squad.map((m) => (m.playerId === playerId ? { ...m, tacticalPosition: position } : m));
}

export const MATCH_W3_LINEUP_REVISION = "lineup-rev-1";
/** The revision another coach's concurrent change would have produced — used only by A07-S4's predeclared CONFLICT outcome, never computed. */
export const MATCH_W3_LINEUP_REVISION_CONCURRENT = "lineup-rev-2";

/**
 * Today quick-action candidates (A09). `availability`/`actorPermission` are fixed fixture facts,
 * not derived by any local eligibility algorithm — a scenario's `fixtures.ts` reads the one field
 * it needs and never recomputes "is this candidate allowed" from scratch
 * (`02_SCENARIOS_AND_FIXTURES.md` "Fixture response rule").
 */
export type MatchW3TodayCandidate = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  availability: "ACCEPTED" | "NO_RESPONSE_AFTER_DEADLINE";
  actorPermission: "ALLOWED" | "DENIED";
  sourceId: string;
};

export const matchW3TodayCandidates = {
  felix: {
    playerId: "player-w3-felix",
    displayName: "Felix",
    shirtNumber: 15,
    availability: "ACCEPTED",
    actorPermission: "ALLOWED",
    sourceId: "src-rsvp-felix",
  },
  jonas: {
    playerId: "player-w3-jonas",
    displayName: "Jonas",
    shirtNumber: null,
    availability: "NO_RESPONSE_AFTER_DEADLINE",
    actorPermission: "ALLOWED",
    sourceId: "src-rsvp-jonas",
  },
  erik: {
    playerId: "player-w3-erik",
    displayName: "Erik",
    shirtNumber: null,
    availability: "ACCEPTED",
    actorPermission: "DENIED",
    sourceId: "src-rsvp-erik",
  },
} as const satisfies Record<string, MatchW3TodayCandidate>;

export const MATCH_W3_ROSTER_REVISION = "roster-rev-1";
/** The revision a second coach's already-applied addition would have produced — A09-S5's predeclared CONFLICT outcome only. */
export const MATCH_W3_ROSTER_REVISION_CONCURRENT = "roster-rev-2";

/**
 * The SEPARATE operational `MATCH_DAY_ADDITION` path (ADR-0077/ADR-0151 — confirmed by source
 * audit: `assertLeagueMatchHelperEligible` checks only match-not-cancelled, player active, and
 * not-already-a-participant; it does NOT check round finalisation, RSVP, or planning boundary).
 * Its own eligibility fact, never derived from `matchW3TodayCandidates`'s planned-selection facts.
 */
export type MatchW3HelperCandidate = {
  playerId: string;
  displayName: string;
  shirtNumber: number | null;
  helperEligible: boolean;
  sourceId: string;
};

export const matchW3HelperCandidate: MatchW3HelperCandidate = {
  playerId: "player-w3-didrik",
  displayName: "Didrik",
  shirtNumber: null,
  helperEligible: true,
  sourceId: "src-helper-eligibility-didrik",
};

/** The operational roster count is a SEPARATE fact from the planned-selection squad size — both start at 8, but a match-day addition only ever changes this one (A09-S6). */
export const MATCH_W3_OPERATIONAL_ROSTER_BASE_COUNT = 8;
