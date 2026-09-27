import "server-only";
import { db } from "@/lib/db";
import { AiInsightSubjectType } from "@/generated/prisma/client";
import {
  registerAiCapabilityHandler,
  type AiCapabilityContext,
  type AiCapabilityHandler,
  type AiCapabilityRefTarget,
} from "@/lib/ai/jobs/capability-handler";
import type { JsonValue } from "@/lib/ai/fingerprints";
import { withEvidenceRef, toRefSegment } from "@/lib/ai/context/evidence-ref";
import {
  dedupeQualitativeObservationsByStatement,
} from "@/lib/evidence/qualitative-evidence-service";

/**
 * `development_cycle_review` context builder (ADR-0152 §6 "Five-week learning cycle", bundle
 * `06_OPPONENT_MEMORY_AND_LONGITUDINAL.md` §9-14). Scope is `TEAM_WINDOW` — a composite scope
 * with the same shape convention `weekly_team_review` established for `TEAM_WEEK`:
 * `${teamId}:${windowStartISO}:${windowEndISO}`, with the window a fixed 35-day span ending at
 * the moment the scheduled scan (`jobs/scheduled-triggers.ts`, the only producer of this id
 * shape) resolved it. `buildContext` re-derives the window from the scopeId itself, so a review
 * is always internally consistent about which matches are in it.
 *
 * Cycle reviews are immutable snapshots (bundle §14): the runner's existing fingerprint/scope
 * dedup means one successful review per 35-day window per team, and later windows never rewrite
 * earlier ones — `persistSuccessfulReview` supersedes only within the same scopeId, i.e. only
 * the current window's own re-run.
 *
 * League-only, deliberately: `Team` has no Event equivalent (the same scope decision
 * `weekly_team_review` documents), so Event matches cannot fall inside a team's window.
 *
 * Player-specific cycle outcomes are governed by bundle §12's threshold: at least two
 * independent evidence items in window, or one explicit coach development observation plus
 * sufficient match exposure. Below the threshold a player is simply omitted from
 * `playerStates` — the model may say "Insufficient evidence" in prose but is never handed a
 * thin evidence set to over-interpret. No numeric development score exists anywhere in this
 * context (bundle §11), and the prompt forbids inventing one.
 */

const FACT = "fact";

// ADR-0152 §6 / bundle §9: window length is 35 days.
export const DEVELOPMENT_CYCLE_WINDOW_DAYS = 35;

// Bundle §10: "Do not send every raw report" — the qualitative evidence sent is the same
// bounded, deduplicated active-observation set the weekly builder uses, capped to keep one
// five-week cycle materially larger than one week but still bounded.
const MAX_QUALITATIVE_OBSERVATIONS = 120;
const MAX_DEVELOPMENT_OBSERVATIONS_PER_PLAYER = 8;
const RECURRING_THEME_MIN_MATCH_COUNT = 2;
const RECURRING_THEME_MAX_ITEMS = 10;
// Bundle §12: player-specific cycle insight requires at least two independent evidence items in
// window, or one explicit coach development observation plus sufficient match exposure.
const PLAYER_MIN_INDEPENDENT_EVIDENCE_ITEMS = 2;
/** "Sufficient match exposure" alongside one explicit coach observation — this codebase's own
 * documented threshold, since the bundle leaves the number open: any recorded minutes in window. */
const PLAYER_MIN_EXPOSURE_MINUTES = 1;

function ref(prefix: string, index: number): string {
  return `${prefix}${String(index + 1).padStart(2, "0")}`;
}

export function buildDevelopmentCycleScopeId(teamId: string, windowStart: Date, windowEnd: Date): string {
  return `${teamId}:${windowStart.toISOString()}:${windowEnd.toISOString()}`;
}

/**
 * Scope ids embed two ISO timestamps, which themselves contain colons — so this cannot use the
 * `indexOf(":")` split `parseWeeklyTeamReviewScopeId` can. The one producer
 * (`buildDevelopmentCycleScopeId`, always fed `Date.toISOString()` output) emits exactly
 * `teamId:startISO:endISO`, so a format-anchored regex splits it unambiguously.
 */
const SCOPE_ID_PATTERN = /^([^:]+):(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z):(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)$/;

/** Exported so the presentation layer and the confirm/dismiss actions can recover the team and
 * window from a `TEAM_WINDOW` review's `scopeId` without duplicating this parsing. */
export function parseDevelopmentCycleScopeId(scopeId: string): { teamId: string; windowStart: Date; windowEnd: Date } | null {
  const match = SCOPE_ID_PATTERN.exec(scopeId);
  if (!match) return null;
  const windowStartMs = Date.parse(match[2]);
  const windowEndMs = Date.parse(match[3]);
  if (Number.isNaN(windowStartMs) || Number.isNaN(windowEndMs) || windowEndMs <= windowStartMs) return null;
  return { teamId: match[1], windowStart: new Date(windowStartMs), windowEnd: new Date(windowEndMs) };
}

/** Sums only *closed* intervals (`endedAtMs` set), matching the other builders' own convention —
 * an interval still open at query time has no trustworthy end. */
function sumClosedMinutes(intervals: { startedAtMs: number; endedAtMs: number | null }[]): number {
  const totalMs = intervals.reduce(
    (sum, interval) => (interval.endedAtMs === null ? sum : sum + Math.max(0, interval.endedAtMs - interval.startedAtMs)),
    0,
  );
  return Math.round(totalMs / 60000);
}

export async function buildDevelopmentCycleReviewContext(params: {
  organisationId: string;
  scopeId: string;
}): Promise<AiCapabilityContext | null> {
  const parsed = parseDevelopmentCycleScopeId(params.scopeId);
  if (!parsed) return null;
  const { teamId, windowStart, windowEnd } = parsed;

  const team = await db.team.findFirst({ where: { id: teamId, organisationId: params.organisationId }, select: { id: true } });
  if (!team) return null;

  // Bundle §10 "Include matches in window": completed (locked-report) matches only — the same
  // two-query shape `findRecentLockedMatches` uses, but anchored to this scope's own window
  // rather than a rolling lookback.
  const candidateMatches = await db.match.findMany({
    where: {
      teamId,
      organisationId: params.organisationId,
      startsAt: { gte: windowStart, lte: windowEnd },
      status: { not: "CANCELLED" },
    },
    select: { id: true },
    orderBy: { startsAt: "desc" },
  });
  if (candidateMatches.length === 0) return null;
  const lockedReports = await db.postMatchReport.findMany({
    where: { organisationId: params.organisationId, matchId: { in: candidateMatches.map((m) => m.id) }, status: "LOCKED" },
    select: { matchId: true },
  });
  const lockedMatchIds = new Set(lockedReports.map((r) => r.matchId));
  const windowMatches = candidateMatches.filter((m) => lockedMatchIds.has(m.id));
  if (windowMatches.length === 0) return null;

  const matchIds = windowMatches.map((m) => m.id);

  const [intervals, qualitativeObservations, developmentObservations, developmentThreads] = await Promise.all([
    db.actualPositionInterval.findMany({
      where: { matchId: { in: matchIds }, organisationId: params.organisationId, playerId: { not: null } },
      select: { playerId: true, matchId: true, position: true, startedAtMs: true, endedAtMs: true },
    }),
    db.qualitativeEvidenceObservation.findMany({
      where: {
        organisationId: params.organisationId,
        teamId,
        matchId: { in: matchIds },
        extractionRun: { status: "SUCCEEDED", supersededAt: null },
      },
      select: { id: true, scope: true, phase: true, polarity: true, explicitness: true, period: true, statement: true, playerId: true, secondaryPlayerId: true, matchId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.playerDevelopmentObservation.findMany({
      where: { organisationId: params.organisationId, matchId: { in: matchIds }, observableNote: { not: null } },
      select: { id: true, playerId: true, matchId: true, kind: true, direction: true, observableNote: true, observedAt: true },
      orderBy: { observedAt: "desc" },
    }),
    db.developmentThread.findMany({
      where: { organisationId: params.organisationId, status: "ACTIVE", category: { not: null }, player: { coreTeamId: teamId } },
      select: { playerId: true, category: true },
    }),
  ]);

  const dedupedObservations = dedupeQualitativeObservationsByStatement(qualitativeObservations)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_QUALITATIVE_OBSERVATIONS);

  // Per-player participation aggregates: minutes and distinct realised positions in window.
  const minutesByPlayer = new Map<string, { startedAtMs: number; endedAtMs: number | null }[]>();
  const positionsByPlayer = new Map<string, Set<string>>();
  const playedMatchIdsByPlayer = new Map<string, Set<string>>();
  for (const interval of intervals) {
    if (!interval.playerId || !interval.matchId) continue;
    const list = minutesByPlayer.get(interval.playerId) ?? [];
    list.push({ startedAtMs: interval.startedAtMs, endedAtMs: interval.endedAtMs });
    minutesByPlayer.set(interval.playerId, list);
    const positions = positionsByPlayer.get(interval.playerId) ?? new Set<string>();
    positions.add(interval.position);
    positionsByPlayer.set(interval.playerId, positions);
    const played = playedMatchIdsByPlayer.get(interval.playerId) ?? new Set<string>();
    played.add(interval.matchId);
    playedMatchIdsByPlayer.set(interval.playerId, played);
  }

  const developmentObservationsByPlayer = new Map<string, typeof developmentObservations>();
  for (const o of developmentObservations) {
    const list = developmentObservationsByPlayer.get(o.playerId) ?? [];
    list.push(o);
    developmentObservationsByPlayer.set(o.playerId, list);
  }

  const playerIds = new Set<string>();
  for (const playerId of minutesByPlayer.keys()) playerIds.add(playerId);
  for (const playerId of developmentObservationsByPlayer.keys()) playerIds.add(playerId);
  for (const o of dedupedObservations) {
    if (o.playerId) playerIds.add(o.playerId);
    if (o.secondaryPlayerId) playerIds.add(o.secondaryPlayerId);
  }
  for (const t of developmentThreads) playerIds.add(t.playerId);

  const sortedPlayerIds = [...playerIds].sort();
  const playerRefById = new Map(sortedPlayerIds.map((id, index) => [id, ref("P", index)]));
  const matchRefById = new Map(matchIds.slice().sort().map((id, index) => [id, ref("M", index)]));
  const teamRef = "T01";

  const refMap = new Map<string, AiCapabilityRefTarget>();
  refMap.set(teamRef, { subjectType: AiInsightSubjectType.TEAM, entityId: teamId });
  for (const [id, matchRef] of matchRefById) {
    refMap.set(matchRef, { subjectType: AiInsightSubjectType.MATCH, entityId: id });
  }
  for (const [id, playerRef] of playerRefById) {
    refMap.set(playerRef, { subjectType: AiInsightSubjectType.PLAYER, entityId: id });
  }

  const evidenceRefs = new Set<string>();

  const matchFacts = [...matchRefById.entries()]
    .map(([, matchRef]) => ({ ref: matchRef }))
    .sort((a, b) => a.ref.localeCompare(b.ref));

  const participationFacts = [...playerRefById.entries()]
    .map(([playerId, playerRef]) =>
      withEvidenceRef(evidenceRefs, `${FACT}:participation:${playerRef}`, {
        playerRef,
        minutes: sumClosedMinutes(minutesByPlayer.get(playerId) ?? []),
        positions: [...(positionsByPlayer.get(playerId) ?? new Set<string>())].sort(),
        matchesPlayed: playedMatchIdsByPlayer.get(playerId)?.size ?? 0,
      }),
    )
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));

  const developmentObservationFacts = [...developmentObservationsByPlayer.entries()]
    .flatMap(([playerId, observations]) =>
      observations
        .slice(0, MAX_DEVELOPMENT_OBSERVATIONS_PER_PLAYER)
        .map((o, index) =>
          withEvidenceRef(evidenceRefs, `${FACT}:development-observation:${playerRefById.get(playerId)}:${index}`, {
            playerRef: playerRefById.get(playerId)!,
            matchRef: o.matchId ? (matchRefById.get(o.matchId) ?? null) : null,
            kind: o.kind,
            direction: o.direction,
            note: o.observableNote,
          }),
        ),
    )
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));

  const activeQualitativeEvidenceFacts = dedupedObservations.map((o, index) =>
    withEvidenceRef(evidenceRefs, `${FACT}:active-qualitative-evidence:${teamRef}:${index}`, {
      playerRef: o.playerId ? (playerRefById.get(o.playerId) ?? null) : null,
      scope: o.scope,
      phase: o.phase,
      polarity: o.polarity,
      statement: o.statement,
    }),
  );

  // Bundle §10 "recurring tactical aggregates": the same per-phase working/problem shape
  // `weekly_team_review` established (bundle §6), aggregated over this window's own matches
  // instead of a rolling 42-day lookback. Exposed only once a phase has evidence in >=2 matches.
  const observationsByMatchId = new Map<string, typeof dedupedObservations>();
  for (const o of dedupedObservations) {
    if (!o.matchId) continue;
    const list = observationsByMatchId.get(o.matchId) ?? [];
    list.push(o);
    observationsByMatchId.set(o.matchId, list);
  }

  function directionForMatchPhase(matchId: string, phase: string): "WORKING" | "PROBLEM" | null {
    const directional = (observationsByMatchId.get(matchId) ?? []).filter((o) => o.phase === phase && (o.polarity === "WORKING" || o.polarity === "PROBLEM"));
    const polarities = new Set(directional.map((o) => o.polarity));
    return polarities.size === 1 ? (directional[0]!.polarity as "WORKING" | "PROBLEM") : null;
  }

  const phaseAccumulators = new Map<string, { workingMatchIds: Set<string>; problemMatchIds: Set<string>; newestObservationDate: Date }>();
  for (const o of dedupedObservations) {
    if (!o.matchId || (o.polarity !== "WORKING" && o.polarity !== "PROBLEM")) continue;
    const acc = phaseAccumulators.get(o.phase) ?? { workingMatchIds: new Set<string>(), problemMatchIds: new Set<string>(), newestObservationDate: o.createdAt };
    if (o.polarity === "WORKING") acc.workingMatchIds.add(o.matchId);
    else acc.problemMatchIds.add(o.matchId);
    if (o.createdAt > acc.newestObservationDate) acc.newestObservationDate = o.createdAt;
    phaseAccumulators.set(o.phase, acc);
  }

  const recurringTacticalThemeFacts = [...phaseAccumulators.entries()]
    .map(([phase, acc]) => {
      const totalMatches = new Set([...acc.workingMatchIds, ...acc.problemMatchIds]).size;
      if (totalMatches < RECURRING_THEME_MIN_MATCH_COUNT) return null;

      let streakDirection: "WORKING" | "PROBLEM" | null = null;
      let streakCount = 0;
      for (const m of windowMatches) {
        const direction = directionForMatchPhase(m.id, phase);
        if (!direction) break;
        if (streakDirection === null) streakDirection = direction;
        else if (direction !== streakDirection) break;
        streakCount++;
      }

      return withEvidenceRef(evidenceRefs, `${FACT}:recurring-theme:${teamRef}:${toRefSegment(phase)}`, {
        phase,
        matchesWithWorking: acc.workingMatchIds.size,
        matchesWithProblem: acc.problemMatchIds.size,
        newestObservationDate: acc.newestObservationDate.toISOString(),
        consecutiveStreak: streakCount > 0 && streakDirection ? { direction: streakDirection, count: streakCount } : null,
      });
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .sort((a, b) => b.matchesWithWorking + b.matchesWithProblem - (a.matchesWithWorking + a.matchesWithProblem) || a.phase.localeCompare(b.phase))
    .slice(0, RECURRING_THEME_MAX_ITEMS);

  // Bundle §12 "Player evidence threshold": at least two independent evidence items in window,
  // or one explicit coach development observation plus sufficient match exposure. Independent
  // items = coach development observations + player-scoped qualitative evidence, across
  // distinct sources; participation alone is exposure, not evidence.
  const playerEvidenceCounts = new Map<string, Set<string>>();
  function addPlayerEvidence(playerId: string, sourceKey: string) {
    const set = playerEvidenceCounts.get(playerId) ?? new Set<string>();
    set.add(sourceKey);
    playerEvidenceCounts.set(playerId, set);
  }
  for (const o of developmentObservations) addPlayerEvidence(o.playerId, `development-observation:${o.id}`);
  for (const o of dedupedObservations) {
    if (o.playerId) addPlayerEvidence(o.playerId, `qualitative:${o.id}`);
    if (o.secondaryPlayerId) addPlayerEvidence(o.secondaryPlayerId, `qualitative:${o.id}:secondary`);
  }

  const playerStateFacts = sortedPlayerIds
    .filter((playerId) => {
      const evidenceCount = playerEvidenceCounts.get(playerId)?.size ?? 0;
      if (evidenceCount >= PLAYER_MIN_INDEPENDENT_EVIDENCE_ITEMS) return true;
      const hasCoachDevelopmentObservation = (developmentObservationsByPlayer.get(playerId) ?? []).length > 0;
      const exposureMinutes = sumClosedMinutes(minutesByPlayer.get(playerId) ?? []);
      return hasCoachDevelopmentObservation && exposureMinutes >= PLAYER_MIN_EXPOSURE_MINUTES;
    })
    .map((playerId) => {
      const playerRef = playerRefById.get(playerId)!;
      const thread = developmentThreads.find((t) => t.playerId === playerId);
      return withEvidenceRef(evidenceRefs, `${FACT}:player-state:${playerRef}`, {
        playerRef,
        minutes: sumClosedMinutes(minutesByPlayer.get(playerId) ?? []),
        positions: [...(positionsByPlayer.get(playerId) ?? new Set<string>())].sort(),
        activeDevelopmentFocus: thread?.category ?? null,
        evidenceItemCount: playerEvidenceCounts.get(playerId)?.size ?? 0,
      });
    });

  const normalizedContext: JsonValue = {
    team: { ref: teamRef, windowStart: windowStart.toISOString(), windowEnd: windowEnd.toISOString() },
    matches: matchFacts,
    participationFacts,
    developmentObservations: developmentObservationFacts,
    activeQualitativeEvidence: activeQualitativeEvidenceFacts,
    recurringTacticalThemes: recurringTacticalThemeFacts,
    playerStates: playerStateFacts,
  };

  const instructions = [
    "Capability: development_cycle_review. Review this team's last five weeks using only the supplied structured facts.",
    "Required reasoning: 1) use `recurringTacticalThemes` to identify RECURRING_PATTERN insights — only when the counts clearly support recurrence across matches, never from a single match's own observation; cite the exact counts (e.g. 'similar observations appear in 4 of the last 6 reports'); 2) for each entry in `playerStates`, decide exactly one of: Improving, Unresolved, or Insufficient evidence — Improving requires multiple supporting evidence items in the window (coach observations and/or qualitative evidence), Unresolved means the evidence is mixed or the exposure was too limited to conclude, Insufficient evidence means there is not enough to judge; always state the evidence (minutes, positions, observations) behind the classification in observable, time-bounded language; 3) a player absent from `playerStates` has no evidence above the threshold — do not invent a classification for them and never mention a player who appears nowhere in the supplied facts; 4) produce at most two NEXT_FOCUS insights for the coming cycle, each stating the focus, the evidence behind it, and one small training constraint; 5) optionally produce at most one EVIDENCE_GAP with a clarificationPrompt, only when one answer would materially improve interpretation; 6) use only RECURRING_PATTERN, NEXT_FOCUS, or EVIDENCE_GAP as analysisRole.",
    "Classifications are about the player's current recorded development in this window — never describe ambition, attitude, commitment, character, intelligence, potential, or fixed ability; never rank players against each other; never assign any numeric score; never state or imply a permanent position suitability.",
    "Good: 'Improving: across four recent matches the player received 46 minutes in midfield; two coach observations describe earlier scanning and better support positioning.' Good: 'Insufficient evidence: the player has only six recent minutes in the new position; there is not enough match exposure to evaluate the current focus.' Bad: 'Natural midfielder.' Bad: 'Tactical awareness 8/10.'",
    "This is a longitudinal learning cycle, not a player rating: the summary must help the coach's next five-week plan, and absence of evidence must be presented as absence of evidence, never as a negative judgement.",
    "Every fact object carries an evidenceRef field giving you the exact string to cite — copy it verbatim, never construct or guess your own evidence-ref string.",
    "You may propose at most one development observation per player, only via the confirm_development_observation action, and only when a supplied fact clearly supports it — every proposal requires explicit coach confirmation before it becomes real.",
  ].join(" ");

  return { normalizedContext, instructions, refMap, evidenceRefs };
}

export const developmentCycleReviewCapabilityHandler: AiCapabilityHandler = {
  capability: "DEVELOPMENT_CYCLE_REVIEW",
  buildContext: buildDevelopmentCycleReviewContext,
};

registerAiCapabilityHandler(developmentCycleReviewCapabilityHandler);