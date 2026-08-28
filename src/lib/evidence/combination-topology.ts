import { db } from "@/lib/db";
import { getActualPositionIntervalsForRef, type ActualIntervalRow } from "@/lib/evidence/actual-timeline";
import { getGoalAttributionEventsForRef } from "@/lib/evidence/combination-goal-attribution";
import { footballMatchRefSourceId, type FootballMatchRef } from "@/lib/evidence/football-match-ref";

export type CombinationFamily =
  | "PARTNERSHIP"
  | "TRIANGLE"
  | "LINE"
  | "CORRIDOR"
  | "FUNCTIONAL_UNIT"
  | "FULL_CONFIGURATION";

export type PartnershipSubtype = "HORIZONTAL" | "VERTICAL" | "GOALKEEPER_LINK";
export type TriangleSubtype = "DEFENSIVE" | "CENTRAL_SPINE" | "WIDE" | "MIDFIELD" | "ATTACKING";
export type LineSubtype = "DEFENSIVE" | "MIDFIELD" | "ATTACKING";
export type CorridorSubtype = "LEFT" | "CENTRE" | "RIGHT";
export type FunctionalUnitSubtype = "BUILD_UP" | "DEFENSIVE_CORE" | "CENTRAL_UNIT" | "ATTACKING_UNIT";

export type CombinationSubtype =
  | PartnershipSubtype
  | TriangleSubtype
  | LineSubtype
  | CorridorSubtype
  | FunctionalUnitSubtype
  | null;

export type ConfidenceLevel = "INSUFFICIENT" | "EMERGING" | "ESTABLISHED";

export type CombinationEvidenceRow = {
  id: string;
  organisationId: string;
  matchId: string | null;
  eventMatchId: string | null;
  family: CombinationFamily;
  subtype: CombinationSubtype;
  playerIds: string[];
  positions: string[];
  minutesTogether: number;
  goalsForWhilePresent: number;
  goalsAgainstWhilePresent: number;
  directGoalContributions: number;
  directAssistContributions: number;
  opponentDiversity: number;
  confidence: ConfidenceLevel;
  approximateTiming: boolean;
  leagueSeasonId: string;
  createdAt: Date;
};

/**
 * A player's occupied slot at a point in time. `position` is the raw role-type string persisted
 * on `ActualPositionInterval` (see actual-timeline.ts); `line`/`lane` are the pre-resolved
 * classification from the same row — never re-derived from `position`/label parsing here.
 */
type PlayerSlot = { position: string; line: string | null; lane: string | null };

interface MatchSegment {
  startMs: number;
  endMs: number;
  playersOnPitch: Map<string, PlayerSlot>;
}

// Depth ordering used only to detect "adjacent line" structures (triangles, corridors, units).
// This is finer-grained than the 4-value LINE family classification (GK|DEF|MID|ATT) — it keeps
// DEFENSIVE_MIDFIELDER/ATTACKING_MIDFIELDER distinguishable from MIDFIELDER for triangle/unit
// shape detection, matching COMBINATION_TOPOLOGY.md's named examples (e.g. CB+CB+CDM as a
// defensive triangle, not merged into one generic "3 midfielders" bucket).
const ROLE_DEPTH: Record<string, number> = {
  GOALKEEPER: 0,
  DEFENDER: 1,
  DEFENSIVE_MIDFIELDER: 2,
  MIDFIELDER: 3,
  ATTACKING_MIDFIELDER: 4,
  FORWARD: 5,
};

export function buildSegmentsFromIntervals(intervals: ActualIntervalRow[], matchEndMs: number | null): MatchSegment[] {
  if (intervals.length === 0) return [];

  const endTimePoints = new Set<number>();
  endTimePoints.add(0);

  for (const interval of intervals) {
    if (interval.position !== "BENCH" && interval.position !== "unknown") {
      endTimePoints.add(interval.startedAtMs);
      if (interval.endedAtMs !== null) {
        endTimePoints.add(interval.endedAtMs);
      }
    }
  }

  if (matchEndMs !== null) {
    endTimePoints.add(matchEndMs);
  }

  const sortedTimes = [...endTimePoints].sort((a, b) => a - b);
  const segments: MatchSegment[] = [];

  for (let i = 0; i < sortedTimes.length - 1; i++) {
    const startMs = sortedTimes[i]!;
    const endMs = sortedTimes[i + 1]!;

    const playersOnPitch = new Map<string, PlayerSlot>();
    for (const interval of intervals) {
      if (interval.position === "BENCH" || interval.position === "unknown") continue;
      const intervalStart = interval.startedAtMs;
      const intervalEnd = interval.endedAtMs ?? matchEndMs ?? Infinity;
      if (intervalStart <= startMs && intervalEnd > startMs) {
        playersOnPitch.set(interval.playerId, {
          position: interval.position,
          line: interval.line,
          lane: interval.lane,
        });
      }
    }

    if (playersOnPitch.size >= 2) {
      segments.push({ startMs, endMs, playersOnPitch });
    }
  }

  return segments;
}

type DetectedCombo = {
  family: CombinationFamily;
  subtype: CombinationSubtype;
  playerIds: string[];
  positions: string[];
};

function comboKey(combo: DetectedCombo): string {
  return `${combo.family}|${combo.subtype ?? "none"}|${[...combo.playerIds].sort().join(",")}|${[...combo.positions].sort().join(",")}`;
}

function derivePartnershipSubtype(lineA: string | null, lineB: string | null): PartnershipSubtype | null {
  if (lineA === "GK" || lineB === "GK") return "GOALKEEPER_LINK";
  if (lineA === null || lineB === null) return null;
  return lineA === lineB ? "HORIZONTAL" : "VERTICAL";
}

function detectPartnerships(players: [string, PlayerSlot][]): DetectedCombo[] {
  const combos: DetectedCombo[] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const [idA, slotA] = players[i]!;
      const [idB, slotB] = players[j]!;
      combos.push({
        family: "PARTNERSHIP",
        subtype: derivePartnershipSubtype(slotA.line, slotB.line),
        playerIds: [idA, idB],
        positions: [slotA.position, slotB.position],
      });
    }
  }
  return combos;
}

function detectLines(players: [string, PlayerSlot][]): DetectedCombo[] {
  const byLine = new Map<"DEF" | "MID" | "ATT", [string, PlayerSlot][]>();
  for (const entry of players) {
    const line = entry[1].line;
    if (line !== "DEF" && line !== "MID" && line !== "ATT") continue;
    const bucket = byLine.get(line) ?? [];
    bucket.push(entry);
    byLine.set(line, bucket);
  }

  const combos: DetectedCombo[] = [];
  for (const [line, members] of byLine) {
    if (members.length < 2) continue;
    const subtype: LineSubtype = line === "DEF" ? "DEFENSIVE" : line === "MID" ? "MIDFIELD" : "ATTACKING";
    combos.push({
      family: "LINE",
      subtype,
      playerIds: members.map((m) => m[0]),
      positions: [...new Set(members.map((m) => m[1].position))],
    });
  }
  return combos;
}

function detectCorridors(players: [string, PlayerSlot][]): DetectedCombo[] {
  const byLane = new Map<CorridorSubtype, [string, PlayerSlot][]>();
  for (const entry of players) {
    const lane = entry[1].lane;
    if (lane !== "LEFT" && lane !== "CENTRE" && lane !== "RIGHT") continue;
    const bucket = byLane.get(lane) ?? [];
    bucket.push(entry);
    byLane.set(lane, bucket);
  }

  const combos: DetectedCombo[] = [];
  for (const [lane, members] of byLane) {
    if (members.length < 2) continue;
    const distinctLines = new Set(members.map((m) => m[1].line).filter((l): l is string => l !== null));
    if (distinctLines.size < 2) continue; // a same-line group is not a "connected chain through lines"
    combos.push({
      family: "CORRIDOR",
      subtype: lane,
      playerIds: members.map((m) => m[0]),
      positions: [...new Set(members.map((m) => m[1].position))],
    });
  }
  return combos;
}

function detectFunctionalUnits(players: [string, PlayerSlot][]): DetectedCombo[] {
  const combos: DetectedCombo[] = [];

  const withRole = (roles: string[]) => players.filter((p) => roles.includes(p[1].position));

  const buildUp = [...withRole(["GOALKEEPER"]), ...players.filter((p) => p[1].line === "DEF")];
  addUnit(combos, "BUILD_UP", buildUp);

  const defensiveCore = [
    ...players.filter((p) => p[1].line === "DEF"),
    ...withRole(["DEFENSIVE_MIDFIELDER"]),
  ];
  addUnit(combos, "DEFENSIVE_CORE", defensiveCore);

  const centralUnit = players.filter(
    (p) => p[1].lane === "CENTRE" && ["DEFENSIVE_MIDFIELDER", "MIDFIELDER", "ATTACKING_MIDFIELDER"].includes(p[1].position),
  );
  addUnit(combos, "CENTRAL_UNIT", centralUnit);

  const attackingUnit = [...players.filter((p) => p[1].line === "ATT"), ...withRole(["ATTACKING_MIDFIELDER"])];
  addUnit(combos, "ATTACKING_UNIT", attackingUnit);

  return combos;
}

function addUnit(combos: DetectedCombo[], subtype: FunctionalUnitSubtype, members: [string, PlayerSlot][]): void {
  const distinct = new Map(members);
  if (distinct.size < 2) return;
  combos.push({
    family: "FUNCTIONAL_UNIT",
    subtype,
    playerIds: [...distinct.keys()],
    positions: [...new Set([...distinct.values()].map((s) => s.position))],
  });
}

function classifyTriangle(trio: [string, PlayerSlot][]): TriangleSubtype | null {
  const roles = trio.map((p) => p[1].position);
  const lanes = trio.map((p) => p[1].lane);

  const isSubsetOf = (allowed: string[]) => roles.every((r) => allowed.includes(r));
  const countOf = (role: string) => roles.filter((r) => r === role).length;

  if (countOf("GOALKEEPER") === 1 && countOf("DEFENDER") === 2) return "CENTRAL_SPINE";
  if (isSubsetOf(["DEFENDER", "DEFENSIVE_MIDFIELDER"]) && countOf("DEFENDER") >= 2) return "DEFENSIVE";
  if (isSubsetOf(["DEFENSIVE_MIDFIELDER", "MIDFIELDER", "ATTACKING_MIDFIELDER"])) return "MIDFIELD";
  if (isSubsetOf(["ATTACKING_MIDFIELDER", "FORWARD"]) && countOf("FORWARD") >= 2) return "ATTACKING";

  const knownLanes = lanes.filter((l): l is string => l !== null);
  if (knownLanes.length === 3 && knownLanes.every((l) => l === knownLanes[0]) && (knownLanes[0] === "LEFT" || knownLanes[0] === "RIGHT")) {
    return "WIDE";
  }

  return null;
}

function detectTriangles(players: [string, PlayerSlot][]): DetectedCombo[] {
  const combos: DetectedCombo[] = [];
  const known = players.filter((p) => p[1].position in ROLE_DEPTH);

  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      for (let k = j + 1; k < known.length; k++) {
        const trio = [known[i]!, known[j]!, known[k]!];
        const subtype = classifyTriangle(trio);
        if (!subtype) continue;
        combos.push({
          family: "TRIANGLE",
          subtype,
          playerIds: trio.map((p) => p[0]),
          positions: [...new Set(trio.map((p) => p[1].position))],
        });
      }
    }
  }
  return combos;
}

function detectFullConfiguration(players: [string, PlayerSlot][]): DetectedCombo[] {
  if (players.length < 2) return [];
  return [
    {
      family: "FULL_CONFIGURATION",
      subtype: null,
      playerIds: players.map((p) => p[0]),
      positions: [...new Set(players.map((p) => p[1].position))],
    },
  ];
}

// A LINE/CORRIDOR/FUNCTIONAL_UNIT that happens to contain every on-pitch player in the segment
// adds no structural distinction beyond FULL_CONFIGURATION — this is what keeps a 3v3 (or any
// segment with very few on-pitch players) from manufacturing a "line" or "corridor" out of what
// is really just the whole team. TRIANGLE/PARTNERSHIP are exempt: COMBINATION_TOPOLOGY.md
// explicitly expects a 3v3 to still produce "a meaningful triangle" even though 3 players is the
// entire team.
function excludeFullTeamSubsets(combos: DetectedCombo[], totalOnPitch: number): DetectedCombo[] {
  return combos.filter((c) => c.playerIds.length < totalOnPitch);
}

function detectCombosInSegment(segment: MatchSegment): DetectedCombo[] {
  const players = [...segment.playersOnPitch.entries()];
  const totalOnPitch = players.length;
  return [
    ...detectPartnerships(players),
    ...excludeFullTeamSubsets(detectLines(players), totalOnPitch),
    ...excludeFullTeamSubsets(detectCorridors(players), totalOnPitch),
    ...excludeFullTeamSubsets(detectFunctionalUnits(players), totalOnPitch),
    ...detectTriangles(players),
    ...detectFullConfiguration(players),
  ];
}

export function deriveConfidence(minutesTogether: number, matchCount: number, opponentDiversity: number): ConfidenceLevel {
  if (minutesTogether < 30 || matchCount < 1) return "INSUFFICIENT";
  if (minutesTogether < 180 || matchCount < 3 || opponentDiversity < 2) return "EMERGING";
  return "ESTABLISHED";
}

export function deriveCombinationsFromSegments(
  segments: MatchSegment[],
  ref: FootballMatchRef,
  orgId: string,
  leagueSeasonId: string,
  goalEvents: Awaited<ReturnType<typeof getGoalAttributionEventsForRef>> = [],
): CombinationEvidenceRow[] {
  const sourceId = footballMatchRefSourceId(ref);
  const accumulated = new Map<
    string,
    {
      combo: DetectedCombo;
      minutes: number;
      goalsFor: number;
      goalsAgainst: number;
      directGoals: number;
      directAssists: number;
      approximateTiming: boolean;
    }
  >();

  for (const segment of segments) {
    const durationMinutes = (segment.endMs - segment.startMs) / 60000;
    const combos = detectCombosInSegment(segment);

    for (const combo of combos) {
      const key = comboKey(combo);
      const existing = accumulated.get(key) ?? {
        combo,
        minutes: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        directGoals: 0,
        directAssists: 0,
        approximateTiming: false,
      };
      existing.minutes += durationMinutes;

      for (const event of goalEvents) {
        if (event.matchMs < segment.startMs || event.matchMs >= segment.endMs) continue;
        if (event.approximateTiming) existing.approximateTiming = true;
        if (event.team === "FOR") {
          existing.goalsFor += 1;
          if (event.scorerPlayerId && combo.playerIds.includes(event.scorerPlayerId)) existing.directGoals += 1;
          if (event.assistPlayerId && combo.playerIds.includes(event.assistPlayerId)) existing.directAssists += 1;
        } else {
          existing.goalsAgainst += 1;
        }
      }

      accumulated.set(key, existing);
    }
  }

  const rows: CombinationEvidenceRow[] = [];
  for (const [key, data] of accumulated) {
    const { combo } = data;
    const confidence = deriveConfidence(data.minutes, 1, 1);

    rows.push({
      id: `${sourceId}-${key}`,
      organisationId: orgId,
      matchId: ref.kind === "LEAGUE_MATCH" ? ref.matchId : null,
      eventMatchId: ref.kind === "EVENT_MATCH" ? ref.eventMatchId : null,
      family: combo.family,
      subtype: combo.subtype,
      playerIds: [...combo.playerIds].sort(),
      positions: [...combo.positions].sort(),
      minutesTogether: Math.round(data.minutes * 10) / 10,
      goalsForWhilePresent: data.goalsFor,
      goalsAgainstWhilePresent: data.goalsAgainst,
      directGoalContributions: data.directGoals,
      directAssistContributions: data.directAssists,
      opponentDiversity: 1,
      confidence,
      approximateTiming: data.approximateTiming,
      leagueSeasonId,
      createdAt: new Date(),
    });
  }

  return rows;
}

/**
 * Computes combination evidence for one match from its already-recorded actual position
 * timeline. Relies on ambient tenant context already established by the caller (matching
 * actual-timeline.ts's `rebuildActualTimeline` — never re-derives tenant context from cookies
 * here, since this is called both from request-scoped server actions and from background
 * reconciliation).
 */
export async function computeMatchCombinationEvidence(
  ref: FootballMatchRef,
  leagueSeasonId: string,
): Promise<CombinationEvidenceRow[]> {
  const context =
    ref.kind === "LEAGUE_MATCH"
      ? await db.match.findFirst({
          where: { id: ref.matchId },
          select: { organisationId: true, matchDurationMinutes: true },
        })
      : await db.eventMatch.findFirst({
          where: { id: ref.eventMatchId },
          select: { organisationId: true, event: { select: { matchDurationMinutes: true } } },
        }).then((m) => m && { organisationId: m.organisationId, matchDurationMinutes: m.event.matchDurationMinutes });

  if (!context) return [];

  const intervals = await getActualPositionIntervalsForRef(ref);
  if (intervals.length === 0) return [];

  const matchEndMs = context.matchDurationMinutes ? context.matchDurationMinutes * 60 * 1000 : null;

  const segments = buildSegmentsFromIntervals(intervals, matchEndMs);
  if (segments.length === 0) return [];

  const goalEvents = await getGoalAttributionEventsForRef(ref);

  // Each combination in a single match faces one opponent — opponentDiversity is always 1
  // for per-match evidence; cross-match aggregation counts distinct opponents.
  return deriveCombinationsFromSegments(segments, ref, context.organisationId, leagueSeasonId, goalEvents);
}
