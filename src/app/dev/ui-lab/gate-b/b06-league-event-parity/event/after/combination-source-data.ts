import type { MatchSegment, PlayerSlot } from "@/lib/evidence/combination-topology";
import type { GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";
import { b06EventParticipants } from "../../../shared/match-b-fixture";

/**
 * R8-3 remediation — the canonical source records `combinationEvidence` (fixtures.ts) is
 * actually derived from, exported here so the SAME records back both the displayed evidence and
 * its own derivation test (`__tests__/combination-evidence.test.ts`) — never two different
 * synthetic models. A plain, hash-friendly (no `Map`) serializable shape; `toMatchSegments()`
 * converts it to the real `MatchSegment[]` shape `deriveCombinationsFromSegments()` requires.
 *
 * Reuses `b06EventParticipants` (`shared/match-b-fixture.ts`) directly for identity/position —
 * never a second, disconnected roster. William (the Guest Player, `tacticalPosition: null`) is
 * excluded from the positional segment entirely, not assigned a placeholder position: no
 * Guest Player acquires combination/partnership evidence this way (same boundary B5/R2 closes
 * for the standalone observation record).
 */
const ROLE_LINE: Record<string, string> = {
  GK: "GK",
  LCB: "DEF",
  RCB: "DEF",
  LCM: "MID",
  CM: "MID",
  RCM: "MID",
  CF: "ATT",
};

const ROLE_LANE: Record<string, string> = {
  GK: "CENTRE",
  LCB: "LEFT",
  RCB: "RIGHT",
  LCM: "LEFT",
  CM: "CENTRE",
  RCM: "RIGHT",
  CF: "CENTRE",
};

export type PositionalParticipant = {
  participantId: string;
  playerName: string;
  position: string;
  line: string;
  lane: string;
};

const positionedParticipants = b06EventParticipants.filter(
  (p): p is typeof p & { tacticalPosition: NonNullable<(typeof p)["tacticalPosition"]> } => p.tacticalPosition !== null,
);

export const b06EventAfterPositionalSegment: { startMs: number; endMs: number; participants: PositionalParticipant[] } = {
  startMs: 0,
  endMs: 80 * 60_000,
  participants: positionedParticipants.map((p) => ({
    participantId: p.participantId,
    playerName: p.displayName,
    position: p.tacticalPosition,
    line: ROLE_LINE[p.tacticalPosition] ?? "MID",
    lane: ROLE_LANE[p.tacticalPosition] ?? "CENTRE",
  })),
};

/**
 * Matches `fixtures.ts`'s own `report.goals`/`report.assists` exactly: Noah 12' (scorer),
 * Sindre 34' (scorer, assisted by Kasper — outside the Noah+Sindre pair), one goal against at
 * 50', Kasper 70' (scorer, outside the pair).
 */
export const b06EventAfterGoalAttributionEvents: GoalAttributionEvent[] = [
  { matchMs: 12 * 60_000, team: "FOR", scorerPlayerId: "participant-gb6e-noah", assistPlayerId: null, approximateTiming: false },
  { matchMs: 34 * 60_000, team: "FOR", scorerPlayerId: "participant-gb6e-sindre", assistPlayerId: "participant-gb6e-kasper", approximateTiming: false },
  { matchMs: 50 * 60_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
  { matchMs: 70 * 60_000, team: "FOR", scorerPlayerId: "participant-gb6e-kasper", assistPlayerId: null, approximateTiming: false },
];

export function toMatchSegments(segment: typeof b06EventAfterPositionalSegment): MatchSegment[] {
  const playersOnPitch = new Map<string, PlayerSlot>(
    segment.participants.map((p) => [p.participantId, { position: p.position, line: p.line, lane: p.lane }]),
  );
  return [{ startMs: segment.startMs, endMs: segment.endMs, playersOnPitch }];
}
