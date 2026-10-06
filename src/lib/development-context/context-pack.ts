import { db } from "@/lib/db";
import { footballMatchRefSourceId, type FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { getActualPositionIntervalsForRef } from "@/lib/evidence/actual-timeline";
import { buildMatchStateTimeline } from "@/lib/evidence/match-state-timeline";
import { getEventReversedEventIds, getLeagueReversedEventIds } from "@/lib/live-match/reversal-resolution";
import {
  buildCoPresenceDrafts,
  buildEventDrafts,
  buildGameStateRoleSecondsDrafts,
  buildRoleSecondsDrafts,
  buildZoneShareDrafts,
  ELIGIBLE_EVENT_TYPES,
  type EligibleEventRow,
  type MeasurementDraft,
} from "./metric-derivation";

/**
 * Match derivation service (ADR-0155 step B2). Assembles every required v1 metric
 * (`metric-registry.ts`) for one match, each carrying explicit numerator/denominator,
 * `sourceRefs`, and a stable `inputRevision` — never persisted here (B3).
 *
 * Deliberately reuses `buildMatchStateTimeline()` (ADR-0113) as the one on-pitch-composition/
 * game-state reconstruction; this module is the thin DB-fetching orchestrator only — the actual
 * metric-shaping logic lives in `metric-derivation.ts` (directly unit-tested without a
 * database), the same split `actual-timeline.ts` already uses elsewhere in this evidence engine.
 *
 * Deliberately no `import "server-only"` here, matching every other DB-backed file in this
 * evidence engine (actual-timeline.ts, match-state-timeline.ts, post-match-learning.ts) — none
 * of them carry it. `server-only`'s guard throws under plain Node/tsx execution too (it only
 * resolves to a no-op via the "react-server" export condition Next.js's own bundler sets), which
 * would break this module's real callers in scripts/recompute-development-context.ts and
 * scripts/verify-development-context.ts. `index.ts`'s own barrel already keeps this module out
 * of reach of any client component without needing the extra guard.
 */

export type { MeasurementDraft };

async function getEligibleEvents(ref: FootballMatchRef, organisationId: string): Promise<EligibleEventRow[]> {
  if (ref.kind === "LEAGUE_MATCH") {
    const [rows, reversedIds] = await Promise.all([
      db.liveMatchEvent.findMany({
        where: {
          matchId: ref.matchId,
          eventType: { in: [...ELIGIBLE_EVENT_TYPES] },
          OR: [{ correctionType: null }, { correctionType: "CORRECTION" }],
        },
        select: { id: true, eventType: true, playerId: true, matchSeconds: true, payload: true },
      }),
      getLeagueReversedEventIds(ref.matchId, organisationId),
    ]);
    return rows.filter((r) => !reversedIds.has(r.id));
  }

  const [rows, reversedIds] = await Promise.all([
    db.eventLiveMatchEvent.findMany({
      where: { eventMatchId: ref.eventMatchId, eventType: { in: [...ELIGIBLE_EVENT_TYPES] }, correctionType: null },
      select: { id: true, eventType: true, playerId: true, matchSeconds: true, payload: true },
    }),
    getEventReversedEventIds(ref.eventMatchId, organisationId),
  ]);
  return rows.filter((r) => !reversedIds.has(r.id));
}

/** Assembles every required v1 metric for one match. Returns `[]` when the match ref cannot be resolved. */
export async function buildMatchContextPack(ref: FootballMatchRef): Promise<MeasurementDraft[]> {
  const timeline = await buildMatchStateTimeline(ref);
  if (!timeline) return [];

  const scopeKey = footballMatchRefSourceId(ref);
  const rawIntervals = await getActualPositionIntervalsForRef(ref);
  const events = await getEligibleEvents(ref, timeline.context.organisationId);

  const { drafts: roleSecondsDrafts, totalExposureSecondsByPlayer } = buildRoleSecondsDrafts(
    scopeKey,
    rawIntervals,
    timeline.context.matchEndMs,
  );

  return [
    ...roleSecondsDrafts,
    ...buildGameStateRoleSecondsDrafts(scopeKey, timeline.intervals),
    ...buildCoPresenceDrafts(scopeKey, timeline.intervals),
    ...buildEventDrafts(scopeKey, events, totalExposureSecondsByPlayer),
    ...buildZoneShareDrafts(scopeKey, events),
  ];
}
