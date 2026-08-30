import type { CoachingSituation, SituationContext, SituationRouteIntent } from "./situation-types";

/**
 * Minutes-until-kickoff threshold for "imminent." Kept identical to the Rego situation policy's
 * own `is_imminent` threshold (`policies/packs/matchboard-default/rego/matchboard_situation.rego`)
 * — one documented value, not silently duplicated with a different number in each place.
 */
export const MATCHDAY_IMMINENT_MINUTES = 120;

export type SituationMatchFact = {
  matchId: string;
  matchRoundId?: string;
  /** ISO timestamp, or null when not yet scheduled/known. */
  startsAt: string | null;
  hasActiveLiveSession: boolean;
};

export type ResolveSituationContextInput = {
  nowIso: string;
  routeIntent?: SituationRouteIntent;
  matches: SituationMatchFact[];
  nextRoundId?: string;
  /** ISO timestamp of the next round's earliest match, if known — used only to populate
   * `temporal.nextRoundDays`. Optional; omit when not yet resolved. */
  nextRoundStartsAt?: string | null;
};

/**
 * Deterministic TypeScript resolver (ADR-0107, docs/domain/situational-decision-support.md
 * §"Situation resolution"). Computes temporal facts before any policy evaluation. Never persisted
 * as a hidden application mode — recomputed fresh from already-loaded facts on every call.
 */
export function resolveSituationContext(input: ResolveSituationContextInput): SituationContext {
  const now = new Date(input.nowIso).getTime();

  const activeMatch = input.matches.find((m) => m.hasActiveLiveSession);

  const withMinutesUntil = input.matches
    .filter((m) => m.startsAt != null)
    .map((m) => ({
      match: m,
      minutesUntil: (new Date(m.startsAt as string).getTime() - now) / 60_000,
    }));

  const imminentMatchIds = new Set<string>();
  if (activeMatch) imminentMatchIds.add(activeMatch.matchId);
  for (const { match, minutesUntil } of withMinutesUntil) {
    if (minutesUntil >= 0 && minutesUntil <= MATCHDAY_IMMINENT_MINUTES) {
      imminentMatchIds.add(match.matchId);
    }
  }

  const futureMinutes = withMinutesUntil
    .map(({ minutesUntil }) => minutesUntil)
    .filter((m) => m >= 0);
  const nearestKickoffMinutes = futureMinutes.length > 0 ? Math.min(...futureMinutes) : undefined;

  const nextRoundDays =
    input.nextRoundStartsAt != null
      ? (new Date(input.nextRoundStartsAt).getTime() - now) / (24 * 60 * 60_000)
      : undefined;

  const primarySituation = resolvePrimarySituation({
    hasActiveMatch: Boolean(activeMatch),
    hasImminentMatch: imminentMatchIds.size > 0,
    routeIntent: input.routeIntent,
  });

  return {
    nowIso: input.nowIso,
    primarySituation,
    activeMatchId: activeMatch?.matchId,
    imminentMatchIds: [...imminentMatchIds],
    nextRoundId: input.nextRoundId,
    routeIntent: input.routeIntent,
    temporal: {
      nearestKickoffMinutes,
      nextRoundDays,
    },
  };
}

function resolvePrimarySituation(facts: {
  hasActiveMatch: boolean;
  hasImminentMatch: boolean;
  routeIntent?: SituationRouteIntent;
}): CoachingSituation {
  // MATCHDAY dominates whenever a relevant match is live or imminent, regardless of route.
  if (facts.hasActiveMatch || facts.hasImminentMatch) {
    return "MATCHDAY";
  }

  // With no immediate operational focus, an explicit analytical route (Insights, a player's
  // development view) puts the coach in LONG_TERM review rather than default NEXT planning.
  // Route intent influences focus; it never creates persistent hidden mode state — this is
  // recomputed on every call from the caller's current route.
  if (facts.routeIntent === "INSIGHTS" || facts.routeIntent === "PLAYER") {
    return "LONG_TERM";
  }

  return "NEXT";
}
