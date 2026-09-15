import type {
  FixturesOverview,
  FixturePeriod,
  FixtureRound,
  FixtureMatch,
  FixtureReportState,
  CompletedFixtureResult,
  FixturePlanningSignal,
} from "./types";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { db } from "@/lib/db";
import { deriveRoundStatus } from "@/lib/round-status";
import { getRoundActions, deriveMatchSelectionState } from "./selection-state-utils";
import { computeRoundPlanIntegrity, type PlanIntegritySignal } from "@/lib/selection/compute-plan-integrity";
import { formatPhaseDisplay } from "@/lib/date/format-phase-display";
import { deriveMatchLifecycleStatus } from "@/lib/selection/planning-boundary";
import { hasLeagueMatchPassed } from "@/lib/match-date-utils";

/**
 * Project a canonical `PlanIntegritySignal` down to the narrow client-safe
 * `FixturePlanningSignal` shape (League Operating Surface,
 * `03_DATA_CONTRACT_AND_VIEW_MODEL.md`). Never re-runs/duplicates the plan-integrity
 * computation — this only re-shapes the already-computed signal.
 */
function toFixturePlanningSignal(signal: PlanIntegritySignal): FixturePlanningSignal {
  return {
    idempotencyKey: signal.idempotencyKey,
    kind: signal.kind,
    ruleCode: signal.ruleCode,
    title: signal.title,
    currentState: signal.currentState,
    consequence: signal.consequence,
    primaryActionLabel: signal.primaryActionLabel,
    primaryActionTarget: signal.primaryActionTarget,
    matchId: signal.matchId,
    teamId: signal.teamId,
    playerId: signal.playerId,
  };
}

function mapReadiness(blockerCount: number, decisionRequiredCount: number): "READY" | "AT_RISK" | "NOT_PLAYABLE" {
  if (blockerCount > 0) return "NOT_PLAYABLE";
  if (decisionRequiredCount > 0) return "AT_RISK";
  return "READY";
}

export async function getFixturesOverview(orgFilter: OrgFilterMode): Promise<FixturesOverview> {
  const organisationId = orgFilter.organisationId;
  const now = new Date();
  const seasons = await db.season.findMany({
    where: { organisationId },
    orderBy: { name: "desc" },
    include: {
      leagueSeasons: {
        orderBy: { startDate: "asc" },
        include: {
          matchRounds: {
            orderBy: { name: "asc" },
            include: {
              matches: {
                include: { team: true },
                orderBy: { startsAt: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (seasons.length === 0) {
    return { periods: [] };
  }

  const allMatchIds = seasons.flatMap((s) =>
    s.leagueSeasons.flatMap((p) =>
      p.matchRounds.flatMap((r) => r.matches.map((m) => m.id)),
    ),
  );

  const [allSelections, postMatchReports, activeLiveSessions, allMatchLineups] = await Promise.all([
    allMatchIds.length > 0
      ? db.selection.findMany({
          where: { matchId: { in: allMatchIds }, organisationId },
          select: { matchId: true, status: true },
        })
      : Promise.resolve([]),
    db.postMatchReport.findMany({
      where: { matchId: { in: allMatchIds }, organisationId },
      select: { id: true, matchId: true, status: true, homeGoals: true, awayGoals: true },
    }),
    allMatchIds.length > 0
      ? db.liveMatchSession.findMany({
          where: { matchId: { in: allMatchIds }, organisationId, status: "ACTIVE" },
          select: { matchId: true },
        })
      : Promise.resolve([]),
    // One bounded batch query for every match's tactical preparation state (League Operating
    // Surface, `03_DATA_CONTRACT_AND_VIEW_MODEL.md` "Efficient lineup loading") — never a
    // per-match lineup query. Only `formationId` is loaded; formation slots/assignments are not
    // needed to decide League's compact "Tactics not prepared" signal.
    allMatchIds.length > 0
      ? db.matchLineup.findMany({
          where: { matchId: { in: allMatchIds }, organisationId },
          select: { matchId: true, formationId: true },
        })
      : Promise.resolve([]),
  ]);

  const liveMatchIds = new Set(activeLiveSessions.map((s) => s.matchId));

  // A match can have more than one MatchLineup (per-team). Any one prepared lineup (non-null
  // formationId) is enough to satisfy the fixed tactics-preparation rule.
  const preparedLineupMatchIds = new Set(
    allMatchLineups.filter((l) => l.formationId != null).map((l) => l.matchId),
  );

  const matchDraftCounts = new Map<string, number>();
  const matchFinalizedCounts = new Map<string, number>();
  for (const s of allSelections) {
    if (s.status === "DRAFT") {
      matchDraftCounts.set(s.matchId, (matchDraftCounts.get(s.matchId) ?? 0) + 1);
    } else if (s.status === "FINALIZED") {
      matchFinalizedCounts.set(s.matchId, (matchFinalizedCounts.get(s.matchId) ?? 0) + 1);
    }
  }

  const postMatchStatusMap = new Map<string, string>();
  const postMatchResultMap = new Map<string, { reportId: string; homeGoals: number; awayGoals: number }>();
  for (const r of postMatchReports) {
    postMatchStatusMap.set(r.matchId, r.status);
    if ((r.status === "REPORTED" || r.status === "LOCKED") && r.homeGoals !== null && r.awayGoals !== null) {
      postMatchResultMap.set(r.matchId, { reportId: r.id, homeGoals: r.homeGoals, awayGoals: r.awayGoals });
    }
  }

  const integrityCache = new Map<string, Awaited<ReturnType<typeof computeRoundPlanIntegrity>>>();

  const periods: FixturePeriod[] = [];

  for (const season of seasons) {
    for (const period of season.leagueSeasons) {
      const rounds: FixtureRound[] = [];

      for (const round of period.matchRounds) {
        let blockerCount = 0;
        let decisionRequiredCount = 0;
        let roundSignals: PlanIntegritySignal[] = [];

        if (round.status !== "FINALIZED") {
          try {
            let integrity = integrityCache.get(round.id);
            if (!integrity) {
              integrity = await computeRoundPlanIntegrity(round.id);
              integrityCache.set(round.id, integrity);
            }
            blockerCount = integrity.summary.blockerCount;
            decisionRequiredCount = integrity.summary.decisionRequiredCount;
            roundSignals = integrity.signals;
          } catch {
            // fallback to zero if computation fails
          }
        }

        // Truthful signal-to-match ownership only (03§"Mapping round signals to a focused match
        // row"): matchId first, then teamId, otherwise the signal stays round-level. Never
        // attach an unscoped signal to a visually convenient match.
        const claimedSignalKeys = new Set<string>();
        const signalsForMatch = (matchId: string, teamId: string): FixturePlanningSignal[] => {
          return roundSignals
            .filter((s) => {
              if (s.matchId) return s.matchId === matchId;
              if (s.teamId) return s.teamId === teamId;
              return false;
            })
            .map((s) => {
              claimedSignalKeys.add(s.idempotencyKey);
              return toFixturePlanningSignal(s);
            });
        };

        const roundDraftSelectionCount = round.matches.reduce(
          (sum, m) => sum + (matchDraftCounts.get(m.id) ?? 0), 0,
        );
        const hasDraftSelections = roundDraftSelectionCount > 0;
        const hasMatches = round.matches.length > 0;

        const derivedRoundStatus = deriveRoundStatus({
          dbStatus: round.status,
          hasDraftSelections,
          // Decision required conditions need the same coach attention as Blocked conditions and
          // must surface as BLOCKED here too.
          blockedSignalCount: blockerCount + decisionRequiredCount,
        });

        const matches: FixtureMatch[] = round.matches.map((match) => {
          const matchDraftCount = matchDraftCounts.get(match.id) ?? 0;
          const matchFinalizedCount = matchFinalizedCounts.get(match.id) ?? 0;
          const matchSelectionState = deriveMatchSelectionState(
            derivedRoundStatus,
            matchDraftCount > 0,
            matchFinalizedCount > 0,
          );

          const matchPlanningSignals = signalsForMatch(match.id, match.teamId);
          const matchBlockerCount = matchPlanningSignals.filter((s) => s.kind === "BLOCKED").length;
          const matchDecisionCount = matchPlanningSignals.filter(
            (s) => s.kind === "DECISION_REQUIRED",
          ).length;

          const postMatchStatus = postMatchStatusMap.get(match.id);
          let reportState: FixtureReportState = { state: "NO_REPORT" };
          if (postMatchStatus === "DRAFT") {
            const result = postMatchResultMap.get(match.id);
            reportState = { state: "DRAFT_REPORT_INCOMPLETE", reportId: result?.reportId ?? "" };
          } else if (postMatchStatus === "REPORTED" || postMatchStatus === "LOCKED") {
            const result = postMatchResultMap.get(match.id);
            if (result) {
              const isHome = match.homeAway === "HOME";
              const goalsFor = isHome ? result.homeGoals : result.awayGoals;
              const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
              const completedResult: CompletedFixtureResult = {
                goalsFor,
                goalsAgainst,
                outcome: goalsFor > goalsAgainst ? "WON" : goalsFor === goalsAgainst ? "DRAWN" : "LOST",
                displayScore: `${goalsFor}–${goalsAgainst}`,
              };
              reportState = { state: "COMPLETED", result: completedResult };
            }
          }

          return {
            id: match.id,
            title: `${match.team.name} vs ${match.opponent}`,
            teamId: match.teamId,
            teamName: match.team.name,
            opponent: match.opponent,
            opponentTeamId: match.opponentTeamId ?? null,
            startsAt: match.startsAt?.toISOString(),
            venue: match.homeAway === "HOME" ? "Home" : match.homeAway === "AWAY" ? "Away" : undefined,
            readinessState: mapReadiness(matchBlockerCount, matchDecisionCount),
            selectionState: matchSelectionState,
            selectedPlayerCount: matchDraftCount + matchFinalizedCount,
            blockerCount: matchBlockerCount,
            decisionRequiredCount: matchDecisionCount,
            postMatchStatus: (postMatchStatus as FixtureMatch["postMatchStatus"]) ?? undefined,
            reportState,
            availableActions: getRoundActions(derivedRoundStatus, hasMatches),
            matchStatus: match.status ?? "SCHEDULED",
            cancelledReason: match.cancelledReason ?? null,
            teamKitColor: match.team.kitColor ?? null,
            lineupState: preparedLineupMatchIds.has(match.id) ? "PREPARED" : "MISSING",
            planningSignals: matchPlanningSignals,
            // Primary, football-action-oriented status (ADR-0101) — kept visually distinct from
            // reportState's FT-score/W-D-L display, which remains a separate fact (AGENTS.md
            // "Fixtures result display rules").
            lifecycleStatus: deriveMatchLifecycleStatus({
              matchStatus: match.status ?? "SCHEDULED",
              reportStatus: (postMatchStatus as "DRAFT" | "REPORTED" | "LOCKED" | undefined) ?? "NONE",
              hasPassed: hasLeagueMatchPassed({ startsAt: match.startsAt, status: match.status }),
              isLive: liveMatchIds.has(match.id),
              roundStatus: round.status,
              planningClosedAt: match.planningClosedAt,
              startsAt: match.startsAt,
            }),
          };
        });

        const roundActions = getRoundActions(derivedRoundStatus, hasMatches);

        // Any signal not claimed by a match/team above remains genuinely round-level (03§
        // "Mapping round signals to a focused match row") — shown in the focused-round summary,
        // never assigned to an arbitrary match.
        const roundLevelPlanningSignals = roundSignals
          .filter((s) => !claimedSignalKeys.has(s.idempotencyKey))
          .map(toFixturePlanningSignal);

        rounds.push({
          id: round.id,
          title: round.name,
          dateRange: undefined,
          readinessState: mapReadiness(blockerCount, decisionRequiredCount),
          selectionState: derivedRoundStatus,
          hasDraftSelections,
          hasMatches,
          blockerCount,
          decisionRequiredCount,
          availableActions: roundActions,
          matches,
          roundLevelPlanningSignals,
        });
      }

      const periodBlockerCount = rounds.reduce((sum, r) => sum + r.blockerCount, 0);
      const periodDecisionCount = rounds.reduce((sum, r) => sum + r.decisionRequiredCount, 0);

      const phaseDisplay = formatPhaseDisplay({
        seasonName: season.name,
        phaseName: period.name,
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
      });

      periods.push({
        id: period.id,
        title: phaseDisplay.combinedLabel,
        dateRange: phaseDisplay.dateRangeLabel,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        readinessState: mapReadiness(periodBlockerCount, periodDecisionCount),
        blockerCount: periodBlockerCount,
        decisionRequiredCount: periodDecisionCount,
        rounds,
        isCurrent: period.startDate <= now && now <= period.endDate,
      });
    }
  }

  return { periods };
}