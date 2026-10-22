import type { MatchSegment, PlayerSlot } from "@/lib/evidence/combination-topology";
import type { GoalAttributionEvent } from "@/lib/evidence/combination-goal-attribution";
import { B05_MATCH_FORMAT } from "./report-data";

/**
 * R8-3/R9-1/R10-1 remediation — the canonical source records `b05CombinationEvidence`
 * (report-data.ts) is actually derived from, exported here so the SAME records back both the
 * displayed evidence and its own derivation test (`__tests__/combination-evidence.test.ts`) —
 * never two different synthetic models. A plain, hash-friendly (no `Map`) serializable shape;
 * `toMatchSegments()` converts it to the real `MatchSegment[]` shape
 * `deriveCombinationsFromSegments()` requires.
 *
 * R10-1 — the R9-1 version of this file was itself unsupported: it assumed a 90-minute match
 * (no NFF rule or match-specific exception supports that — see `B05_MATCH_FORMAT`'s own doc
 * comment), modeled a substitution and an early departure that were both INFERRED from
 * `b05MinutesByParticipant`'s pre-existing aggregate values rather than backed by any explicit
 * rotation/withdrawal event, left the formation's own CF slot permanently vacant, and its own
 * code comment ("the team finishes the match with 6") did not even match its own final segment's
 * array length (5).
 *
 * **Corrected, simplest coherent model**: Slemmestad Rød plays NFF Akershus G11 7v7 — 2x30
 * minutes, 60 total (`B05_MATCH_FORMAT`). All 7 present players start and play the entire
 * 60-minute match, filling all 7 real formation slots (including CF, previously unfilled) —
 * zero substitutions, zero inferred departures, nothing left unexplained. This is not a
 * simplification that discards information: every one of `b05MinutesByParticipant`'s values was
 * ALREADY uniform at a glance except for the three the R9-1 pass invented a substitution/
 * departure to explain (Kasper, Elias, Noah) — those three values were themselves the defect
 * (inferred from a segment, not from any real recorded event), not a fact this correction needs
 * to preserve. `b05FootballObservations`'s Elias note is corrected accordingly (no longer
 * describes him "coming on").
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

/** The full, real NFF G11 7v7 formation (GK + 6 outfield) — every slot filled by a real present
 * player for the entire match. Noah (RCM) and Sindre (LCM) keep the exact positions they already
 * held in the prior revision (same line, MID -> HORIZONTAL partnership unchanged); Elias now
 * fills the previously-vacant CF slot instead of being modeled as a substitute. */
export const b05PositionalSegments: PositionalSegmentSource[] = [
  {
    startMs: 0,
    endMs: B05_MATCH_FORMAT.regulationDurationMinutes * 60_000,
    participants: [
      { participantId: "player-gb5-aksel", playerName: "Aksel", position: "GK", line: "GK", lane: "CENTRE" },
      { participantId: "player-gb5-tobias", playerName: "Tobias", position: "LCB", line: "DEF", lane: "LEFT" },
      { participantId: "player-gb5-vetle", playerName: "Vetle", position: "RCB", line: "DEF", lane: "RIGHT" },
      { participantId: "player-gb5-sindre", playerName: "Sindre", position: "LCM", line: "MID", lane: "LEFT" },
      { participantId: "player-gb5-kasper", playerName: "Kasper", position: "CM", line: "MID", lane: "CENTRE" },
      { participantId: "player-gb5-noah", playerName: "Noah", position: "RCM", line: "MID", lane: "RIGHT" },
      { participantId: "player-gb5-elias", playerName: "Elias", position: "CF", line: "ATT", lane: "CENTRE" },
    ],
  },
];

/**
 * No substitutions or rotations occurred this match — an explicit, authoritative declaration
 * (empty on purpose) rather than silence, so "no rotation event supports this boundary" can
 * never again be true by omission. If a future revision introduces a real substitution, it
 * belongs here FIRST, with the positional segments above derived to match it — never the other
 * direction.
 */
export const b05RotationEvents: ReadonlyArray<{ matchMs: number; playerOffId: string; playerOnId: string; position: string }> = [];

/**
 * Matches `b05CanonicalLiveEvents` exactly (`report-data.ts`) — the same real canonical live
 * record, re-expressed in the `GoalAttributionEvent` shape `deriveCombinationsFromSegments()`
 * consumes, never a second, disconnected synthetic event list. All five events (12'/20'/34'/50'/
 * 55' — see that module's own R10-1 correction note) fall within the 0-60' segment; every
 * scorer/assist identity below is on pitch at its own event's timestamp.
 */
export const b05GoalAttributionEvents: GoalAttributionEvent[] = [
  { matchMs: 12 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-noah", assistPlayerId: null, approximateTiming: false },
  { matchMs: 20 * 60_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
  { matchMs: 34 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-sindre", assistPlayerId: "player-gb5-vetle", approximateTiming: false },
  { matchMs: 50 * 60_000, team: "AGAINST", scorerPlayerId: null, assistPlayerId: null, approximateTiming: false },
  { matchMs: 55 * 60_000, team: "FOR", scorerPlayerId: "player-gb5-kasper", assistPlayerId: null, approximateTiming: false },
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
 * Computes each participant's total on-pitch minutes across a segment sequence, so a test can
 * assert it against the fixture's own authoritative `b05MinutesByParticipant` (`report-data.ts`)
 * directly, instead of trusting the segments as their own source of truth.
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
 * The structural invariants a positional-segment sequence must satisfy, independent of any
 * specific minute totals. Used both by the real fixture's own consistency test and the dedicated
 * negative tests (deliberately contradictory sequences must fail this).
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

/**
 * R10-1 — validates a segment sequence's total duration against a declared match format,
 * independent of the structural checks above (a sequence can be perfectly well-formed and still
 * assume an unsupported match length, the original R9-1 defect's own root cause).
 */
export function validateMatchFormat(
  segments: PositionalSegmentSource[],
  format: { regulationDurationMinutes: number },
): SegmentValidationIssue[] {
  if (segments.length === 0) return [{ code: "NO_SEGMENTS", message: "No positional segments supplied." }];
  const totalMs = segments[segments.length - 1]!.endMs - segments[0]!.startMs;
  const totalMinutes = totalMs / 60_000;
  if (totalMinutes !== format.regulationDurationMinutes) {
    return [{
      code: "UNSUPPORTED_MATCH_DURATION",
      message: `Segment sequence spans ${totalMinutes} minutes, not the declared format's ${format.regulationDurationMinutes}.`,
    }];
  }
  return [];
}
