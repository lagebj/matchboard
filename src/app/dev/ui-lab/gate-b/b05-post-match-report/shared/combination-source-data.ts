import type { MatchSegment, PlayerSlot } from "@/lib/evidence/combination-topology";
import type { GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";

/**
 * R8-3 remediation — the canonical source records `b05CombinationEvidence` (report-data.ts) is
 * actually derived from, exported here so the SAME records back both the displayed evidence and
 * its own derivation test (`__tests__/combination-evidence.test.ts`) — never two different
 * synthetic models. A plain, hash-friendly (no `Map`) serializable shape; `toMatchSegments()`
 * converts it to the real `MatchSegment[]` shape `deriveCombinationsFromSegments()` requires.
 *
 * One continuous 80-minute segment, the full present 7-a-side lineup on pitch throughout (no
 * substitutions modeled — consistent with this fixture's own simplicity elsewhere). Positions
 * assigned so the real `derivePartnershipSubtype()` reproduces the fixture's own claim: Noah
 * (RCM) and Sindre (LCM) share the same line (`MIDFIELDER` -> `"MID"`) -> `HORIZONTAL`.
 */
export type PositionalParticipant = {
  participantId: string;
  playerName: string;
  position: string;
  /** `FormationSlotRoleType`-derived line, matching `ROLE_TYPE_TO_LINE` exactly (never guessed). */
  line: string;
  lane: string;
};

export const b05PositionalSegment: { startMs: number; endMs: number; participants: PositionalParticipant[] } = {
  startMs: 0,
  endMs: 80 * 60_000,
  participants: [
    { participantId: "player-gb5-aksel", playerName: "Aksel", position: "GK", line: "GK", lane: "CENTRE" },
    { participantId: "player-gb5-tobias", playerName: "Tobias", position: "LCB", line: "DEF", lane: "LEFT" },
    { participantId: "player-gb5-vetle", playerName: "Vetle", position: "RCB", line: "DEF", lane: "RIGHT" },
    { participantId: "player-gb5-sindre", playerName: "Sindre", position: "LCM", line: "MID", lane: "LEFT" },
    { participantId: "player-gb5-kasper", playerName: "Kasper", position: "CM", line: "MID", lane: "CENTRE" },
    { participantId: "player-gb5-noah", playerName: "Noah", position: "RCM", line: "MID", lane: "RIGHT" },
    { participantId: "player-gb5-elias", playerName: "Elias", position: "CF", line: "ATT", lane: "CENTRE" },
  ],
};

/**
 * Matches `b05CanonicalLiveEvents` exactly (`report-data.ts`) — the same real canonical live
 * record, re-expressed in the `GoalAttributionEvent` shape `deriveCombinationsFromSegments()`
 * consumes, never a second, disconnected synthetic event list.
 */
export const b05GoalAttributionEvents: GoalAttributionEvent[] = [
  { matchMs: 12 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-noah", assistPlayerId: null, approximateTiming: false },
  { matchMs: 20 * 60_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
  { matchMs: 34 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-sindre", assistPlayerId: "player-gb5-vetle", approximateTiming: false },
  { matchMs: 50 * 60_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
  { matchMs: 61 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-kasper", assistPlayerId: null, approximateTiming: false },
];

export function toMatchSegments(segment: typeof b05PositionalSegment): MatchSegment[] {
  const playersOnPitch = new Map<string, PlayerSlot>(
    segment.participants.map((p) => [p.participantId, { position: p.position, line: p.line, lane: p.lane }]),
  );
  return [{ startMs: segment.startMs, endMs: segment.endMs, playersOnPitch }];
}
