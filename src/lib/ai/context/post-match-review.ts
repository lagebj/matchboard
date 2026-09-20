import "server-only";
import { db } from "@/lib/db";
import { AiInsightSubjectType } from "@/generated/prisma/client";
import {
  registerAiCapabilityHandler,
  type AiCapabilityContext,
  type AiCapabilityHandler,
  type AiCapabilityRefTarget,
} from "@/lib/ai/jobs/capability-handler";
import { resolveFootballMatchRefById } from "@/lib/evidence/football-match-ref";
import type { JsonValue } from "@/lib/ai/fingerprints";

/**
 * `post_match_review` context builder (06_AI_CAPABILITY_CONTRACTS.md "4. post_match_review").
 * Scope is `Match` (`AiAdvisorScopeType.MATCH`), generic over League `Match`/`PostMatchReport`
 * and Event `EventMatch`/`EventPostMatchReport` — resolved uniformly via
 * `resolveFootballMatchRefById()`, reusing the repository's existing League/Event normalization
 * pattern instead of building a second one.
 *
 * Eligible only once the report has reached `LOCKED` (submitted/completed) — a report still in
 * DRAFT/REPORTED is not yet a stable source of "recorded" facts, so `buildContext` returns
 * `null` (not yet, or no longer, eligible) rather than reviewing a report that could still
 * change under the coach before this job ever runs.
 *
 * Deliberately excludes guest-player rows (`guestPlayerId` set, `playerId` null) from every
 * fact category below: a `GuestPlayer` is not a roster `Player` entity this capability has an
 * ephemeral-ref identity scheme for, and the contract's external-data rule already forbids
 * sending anything that could help re-identify a specific person outside Matchboard's own
 * roster — this is a documented scope adaptation, not a silent gap.
 */

const FACT = "fact";

function playerRef(index: number): string {
  return `P${String(index + 1).padStart(2, "0")}`;
}

/** Sums only *closed* intervals (`endedAtMs` set) into whole minutes — an interval still open
 * at query time has no trustworthy end, and this capability must never estimate one. */
function sumClosedMinutes(intervals: { startedAtMs: number; endedAtMs: number | null }[]): number {
  const totalMs = intervals.reduce(
    (sum, interval) => (interval.endedAtMs === null ? sum : sum + Math.max(0, interval.endedAtMs - interval.startedAtMs)),
    0,
  );
  return Math.round(totalMs / 60000);
}

interface RawFacts {
  ourScore: number | null;
  opponentScore: number | null;
  goals: { playerId: string; minute: number | null }[];
  assists: { playerId: string }[];
  attendance: { playerId: string; status: string }[];
}

async function loadRawFacts(
  ref: NonNullable<Awaited<ReturnType<typeof resolveFootballMatchRefById>>>,
  organisationId: string,
): Promise<RawFacts | null> {
  if (ref.kind === "LEAGUE_MATCH") {
    const report = await db.postMatchReport.findFirst({
      where: { matchId: ref.matchId, organisationId },
      include: { goals: true, assists: true, playerActuals: true },
    });
    if (!report || report.status !== "LOCKED") return null;

    let ourScore: number | null = null;
    let opponentScore: number | null = null;
    if (report.homeGoals !== null && report.awayGoals !== null) {
      const match = await db.match.findUnique({ where: { id: ref.matchId }, select: { homeAway: true } });
      const isHome = match?.homeAway === "HOME";
      ourScore = isHome ? report.homeGoals : report.awayGoals;
      opponentScore = isHome ? report.awayGoals : report.homeGoals;
    }

    return {
      ourScore,
      opponentScore,
      goals: report.goals.filter((g): g is typeof g & { playerId: string } => g.playerId !== null).map((g) => ({ playerId: g.playerId, minute: g.minute })),
      assists: report.assists.filter((a): a is typeof a & { playerId: string } => a.playerId !== null).map((a) => ({ playerId: a.playerId })),
      attendance: report.playerActuals
        .filter((pa): pa is typeof pa & { playerId: string } => pa.playerId !== null)
        .map((pa) => ({ playerId: pa.playerId, status: pa.attendanceStatus })),
    };
  }

  const report = await db.eventPostMatchReport.findFirst({
    where: { eventMatchId: ref.eventMatchId, organisationId },
    include: { goalEvents: true, assistEvents: true, playerReports: true },
  });
  if (!report || report.status !== "LOCKED") return null;

  return {
    ourScore: report.ourScore,
    opponentScore: report.opponentScore,
    goals: report.goalEvents
      .filter((g): g is typeof g & { playerId: string } => g.playerId !== null)
      .map((g) => ({ playerId: g.playerId, minute: g.minute })),
    assists: report.assistEvents.filter((a): a is typeof a & { playerId: string } => a.playerId !== null).map((a) => ({ playerId: a.playerId })),
    attendance: report.playerReports
      .filter((pr): pr is typeof pr & { playerId: string } => pr.playerId !== null)
      .map((pr) => ({ playerId: pr.playerId, status: pr.attendanceStatus })),
  };
}

export async function buildPostMatchReviewContext(params: {
  organisationId: string;
  scopeId: string;
}): Promise<AiCapabilityContext | null> {
  const ref = await resolveFootballMatchRefById(params.scopeId);
  if (!ref) return null;

  const raw = await loadRawFacts(ref, params.organisationId);
  if (!raw) return null;

  const intervals = await db.actualPositionInterval.findMany({
    where:
      ref.kind === "LEAGUE_MATCH"
        ? { matchId: ref.matchId, playerId: { not: null } }
        : { eventMatchId: ref.eventMatchId, playerId: { not: null } },
    select: { playerId: true, startedAtMs: true, endedAtMs: true },
  });

  const playerIds = new Set<string>();
  for (const g of raw.goals) playerIds.add(g.playerId);
  for (const a of raw.assists) playerIds.add(a.playerId);
  for (const at of raw.attendance) playerIds.add(at.playerId);
  for (const iv of intervals) if (iv.playerId) playerIds.add(iv.playerId);

  const activeFocus = playerIds.size
    ? await db.developmentThread.findMany({
        where: { playerId: { in: [...playerIds] }, status: "ACTIVE", organisationId: params.organisationId },
        select: { playerId: true, category: true },
      })
    : [];

  const sortedPlayerIds = [...playerIds].sort();
  const refByPlayerId = new Map<string, string>();
  sortedPlayerIds.forEach((playerId, index) => refByPlayerId.set(playerId, playerRef(index)));

  const matchRef = "M01";
  const refMap = new Map<string, AiCapabilityRefTarget>();
  refMap.set(matchRef, { subjectType: AiInsightSubjectType.MATCH, entityId: params.scopeId });
  for (const [playerId, pr] of refByPlayerId) {
    refMap.set(pr, { subjectType: AiInsightSubjectType.PLAYER, entityId: playerId });
  }

  const evidenceRefs = new Set<string>();

  const scoreFact = raw.ourScore !== null && raw.opponentScore !== null ? { ourScore: raw.ourScore, opponentScore: raw.opponentScore } : null;
  if (scoreFact) evidenceRefs.add(`${FACT}:score:${matchRef}`);

  const attendanceFacts = raw.attendance
    .map((a) => ({ playerRef: refByPlayerId.get(a.playerId), status: a.status }))
    .filter((a): a is { playerRef: string; status: string } => a.playerRef !== undefined)
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const a of attendanceFacts) evidenceRefs.add(`${FACT}:attendance:${a.playerRef}`);

  const goalCounters = new Map<string, number>();
  const goalFacts = raw.goals
    .map((g) => refByPlayerId.get(g.playerId))
    .map((pr, idx) => ({ pr, minute: raw.goals[idx].minute }))
    .filter((entry): entry is { pr: string; minute: number | null } => entry.pr !== undefined)
    .map(({ pr, minute }) => {
      const n = (goalCounters.get(pr) ?? 0) + 1;
      goalCounters.set(pr, n);
      const evidenceRef = `${FACT}:goal:${pr}:${n}`;
      evidenceRefs.add(evidenceRef);
      return { playerRef: pr, minute, evidenceRef };
    })
    .sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef));

  const assistCounters = new Map<string, number>();
  const assistFacts = raw.assists
    .map((a) => refByPlayerId.get(a.playerId))
    .filter((pr): pr is string => pr !== undefined)
    .map((pr) => {
      const n = (assistCounters.get(pr) ?? 0) + 1;
      assistCounters.set(pr, n);
      const evidenceRef = `${FACT}:assist:${pr}:${n}`;
      evidenceRefs.add(evidenceRef);
      return { playerRef: pr, evidenceRef };
    })
    .sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef));

  const minutesByPlayer = new Map<string, { startedAtMs: number; endedAtMs: number | null }[]>();
  for (const iv of intervals) {
    if (!iv.playerId) continue;
    const pr = refByPlayerId.get(iv.playerId);
    if (!pr) continue;
    const list = minutesByPlayer.get(pr) ?? [];
    list.push({ startedAtMs: iv.startedAtMs, endedAtMs: iv.endedAtMs });
    minutesByPlayer.set(pr, list);
  }
  const minutesFacts = [...minutesByPlayer.entries()]
    .map(([pr, ivs]) => ({ playerRef: pr, minutes: sumClosedMinutes(ivs) }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const m of minutesFacts) evidenceRefs.add(`${FACT}:minutes:${m.playerRef}`);

  const focusByPlayer = new Map<string, Set<string>>();
  for (const f of activeFocus) {
    const pr = refByPlayerId.get(f.playerId);
    if (!pr) continue;
    const set = focusByPlayer.get(pr) ?? new Set<string>();
    set.add(f.category ?? "GENERAL");
    focusByPlayer.set(pr, set);
  }
  const developmentFocusFacts = [...focusByPlayer.entries()]
    .map(([pr, categories]) => ({ playerRef: pr, categories: [...categories].sort() }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const f of developmentFocusFacts) evidenceRefs.add(`${FACT}:development-focus:${f.playerRef}`);

  const normalizedContext: JsonValue = {
    match: { ref: matchRef, score: scoreFact },
    attendance: attendanceFacts,
    goals: goalFacts,
    assists: assistFacts,
    minutes: minutesFacts,
    developmentFocus: developmentFocusFacts,
  };

  const instructions = [
    "Capability: post_match_review. Review this completed match's recorded facts.",
    "Do not restate or correct the score, goals, assists, or minutes — treat every supplied number as final and already correct.",
    "Do not create evidence automatically.",
    "You may propose at most one development observation per player, only via the confirm_development_observation action, and only when a supplied fact clearly supports it — every proposal requires explicit coach confirmation before it becomes real.",
  ].join(" ");

  return { normalizedContext, instructions, refMap, evidenceRefs };
}

export const postMatchReviewCapabilityHandler: AiCapabilityHandler = {
  capability: "POST_MATCH_REVIEW",
  buildContext: buildPostMatchReviewContext,
};

registerAiCapabilityHandler(postMatchReviewCapabilityHandler);
