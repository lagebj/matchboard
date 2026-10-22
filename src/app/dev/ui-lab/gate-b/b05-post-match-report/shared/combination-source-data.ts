import type { MatchSegment, PlayerSlot } from "@/lib/evidence/combination-topology";
import type { GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";

/**
 * R8-3/R9-1 remediation — the canonical source records `b05CombinationEvidence`
 * (report-data.ts) is actually derived from, exported here so the SAME records back both the
 * displayed evidence and its own derivation test (`__tests__/combination-evidence.test.ts`) —
 * never two different synthetic models. A plain, hash-friendly (no `Map`) serializable shape;
 * `toMatchSegments()` converts it to the real `MatchSegment[]` shape
 * `deriveCombinationsFromSegments()` requires.
 *
 * R9-1: the R8-3 version of this file modeled one continuous 0-80' segment with all seven
 * present players on pitch throughout — directly contradicting `report-data.ts`'s own
 * `b05MinutesByParticipant` (Kasper 68, Elias 22, Noah 83; the other four at 90). That map
 * predates this file; it was never checked for consistency when this file was first written.
 *
 * **Authoritative participation model, established before correcting anything:**
 * `b05TimingReview("completed")` already records the real second half as
 * `resolvedDurationMinutes: 45` — this fixture's own match is a standard two-half game, so the
 * full match duration is 90 minutes (2x45'), never 80. 80 was simply an invented endpoint with
 * no supporting record anywhere else in the fixture.
 *
 * With a 90-minute match, all seven of `b05MinutesByParticipant`'s existing values are exactly
 * explained by ONE clean substitution pair plus one early departure — no value needed to change:
 * - Aksel (GK), Tobias (LCB), Vetle (RCB), Sindre (LCM): on pitch the full 90 minutes.
 * - Kasper (CM) 0-68', then off. Elias comes on at 68' into the same CM slot, playing 68-90'
 *   (68 + 22 = 90 — the exact clean swap `b05MinutesByParticipant`'s 68/22 pair already implies).
 * - Noah (RCM) 0-83', then off with no replacement (this squad has no further eligible player —
 *   every one of the 7 PRESENT players is already accounted for elsewhere on the pitch at that
 *   moment) — the team plays the final 7 minutes with 6. A genuine early departure, not a false
 *   substitution invented to preserve the aggregate (the 83 is already what the fixture records;
 *   this model explains it, rather than papering over it).
 *
 * No position among the 7 present players is ever assigned to the formation's own CF slot — this
 * squad's real available roster (7 present players, matching exactly 6 on-pitch outfield-or-GK
 * roles at any moment, never a 7th) is honestly smaller than a full 7-a-side fielding, not papered
 * over with an invented 7th player. Disclosed here rather than left unexplained.
 */
export type PositionalParticipant = {
  participantId: string;
  playerName: string;
  position: string;
  /** `FormationSlotRoleType`-derived line, matching `ROLE_TYPE_TO_LINE` exactly (never guessed). */
  line: string;
  lane: string;
};

export type PositionalSegmentSource = { startMs: number; endMs: number; participants: PositionalParticipant[] };

const AKSEL: PositionalParticipant = { participantId: "player-gb5-aksel", playerName: "Aksel", position: "GK", line: "GK", lane: "CENTRE" };
const TOBIAS: PositionalParticipant = { participantId: "player-gb5-tobias", playerName: "Tobias", position: "LCB", line: "DEF", lane: "LEFT" };
const VETLE: PositionalParticipant = { participantId: "player-gb5-vetle", playerName: "Vetle", position: "RCB", line: "DEF", lane: "RIGHT" };
const SINDRE: PositionalParticipant = { participantId: "player-gb5-sindre", playerName: "Sindre", position: "LCM", line: "MID", lane: "LEFT" };
const NOAH: PositionalParticipant = { participantId: "player-gb5-noah", playerName: "Noah", position: "RCM", line: "MID", lane: "RIGHT" };
const KASPER: PositionalParticipant = { participantId: "player-gb5-kasper", playerName: "Kasper", position: "CM", line: "MID", lane: "CENTRE" };
/** Takes over Kasper's exact vacated slot (CM/MID/CENTRE) at 68' — a like-for-like swap, not an
 * invented reshuffle of anyone else's position. */
const ELIAS: PositionalParticipant = { participantId: "player-gb5-elias", playerName: "Elias", position: "CM", line: "MID", lane: "CENTRE" };

/**
 * Three chronological, non-overlapping segments spanning the full 90-minute match — see this
 * module's own top-level doc comment for the participation model each boundary represents.
 */
export const b05PositionalSegments: PositionalSegmentSource[] = [
  {
    // 0-68': the starting XI (minus the unfilled CF slot — see top-level doc comment) with Kasper at CM.
    startMs: 0,
    endMs: 68 * 60_000,
    participants: [AKSEL, TOBIAS, VETLE, SINDRE, NOAH, KASPER],
  },
  {
    // 68-83': Kasper off, Elias on at CM. Noah still present.
    startMs: 68 * 60_000,
    endMs: 83 * 60_000,
    participants: [AKSEL, TOBIAS, VETLE, SINDRE, NOAH, ELIAS],
  },
  {
    // 83-90': Noah off with no replacement — the team finishes the match with 6.
    startMs: 83 * 60_000,
    endMs: 90 * 60_000,
    participants: [AKSEL, TOBIAS, VETLE, SINDRE, ELIAS],
  },
];

/**
 * Matches `b05CanonicalLiveEvents` exactly (`report-data.ts`) — the same real canonical live
 * record, re-expressed in the `GoalAttributionEvent` shape `deriveCombinationsFromSegments()`
 * consumes, never a second, disconnected synthetic event list. All five events (12'/20'/34'/
 * 50'/61') fall within 0-68', before either substitution — every scorer/assist identity below is
 * on pitch at its own event's timestamp in every one of the three segments above.
 */
export const b05GoalAttributionEvents: GoalAttributionEvent[] = [
  { matchMs: 12 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-noah", assistPlayerId: null, approximateTiming: false },
  { matchMs: 20 * 60_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
  { matchMs: 34 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-sindre", assistPlayerId: "player-gb5-vetle", approximateTiming: false },
  { matchMs: 50 * 60_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
  { matchMs: 61 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-kasper", assistPlayerId: null, approximateTiming: false },
];

export function toMatchSegments(segments: PositionalSegmentSource[]): MatchSegment[] {
  return segments.map((segment) => {
    const playersOnPitch = new Map<string, PlayerSlot>(
      segment.participants.map((p) => [p.participantId, { position: p.position, line: p.line, lane: p.lane }]),
    );
    return { startMs: segment.startMs, endMs: segment.endMs, playersOnPitch };
  });
}

/**
 * R9-1 — computes each participant's total on-pitch minutes across a segment sequence, so a test
 * can assert it against the fixture's own authoritative `b05MinutesByParticipant`
 * (`report-data.ts`) directly, instead of trusting the segments as their own source of truth.
 */
export function computeMinutesByParticipant(segments: PositionalSegmentSource[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const segment of segments) {
    const durationMinutes = (segment.endMs - segment.startMs) / 60_000;
    for (const participant of segment.participants) {
      totals.set(participant.participantId, (totals.get(participant.participantId) ?? 0) + durationMinutes);
    }
  }
  return totals;
}

export type SegmentValidationIssue = { code: string; message: string };

/**
 * R9-1 — the structural invariants a positional-segment sequence must satisfy, independent of
 * any specific minute totals. Used both by the real fixture's own consistency test and the
 * dedicated negative test (a deliberately contradictory sequence must fail this).
 */
export function validateSegmentSequence(segments: PositionalSegmentSource[]): SegmentValidationIssue[] {
  const issues: SegmentValidationIssue[] = [];

  for (const segment of segments) {
    if (segment.endMs <= segment.startMs) {
      issues.push({ code: "NON_POSITIVE_DURATION", message: `Segment ${segment.startMs}-${segment.endMs} has non-positive duration.` });
    }
    const seen = new Set<string>();
    for (const p of segment.participants) {
      if (seen.has(p.participantId)) {
        issues.push({ code: "DUPLICATE_OCCUPANCY", message: `${p.participantId} appears twice in segment ${segment.startMs}-${segment.endMs}.` });
      }
      seen.add(p.participantId);
    }
    const positions = segment.participants.map((p) => p.position);
    if (new Set(positions).size !== positions.length) {
      issues.push({ code: "DUPLICATE_POSITION", message: `A position is occupied by more than one player in segment ${segment.startMs}-${segment.endMs}.` });
    }
  }

  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== segments[i]) {
      issues.push({ code: "NOT_CHRONOLOGICAL", message: "Segments are not supplied in chronological order." });
      break;
    }
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i]!.endMs > sorted[i + 1]!.startMs) {
      issues.push({ code: "OVERLAPPING_SEGMENTS", message: `Segment ending at ${sorted[i]!.endMs} overlaps the next segment starting at ${sorted[i + 1]!.startMs}.` });
    }
  }

  return issues;
}
