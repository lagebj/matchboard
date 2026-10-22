"use client";

import { AppearanceControl } from "@/components/touchline";
import { MATCH_B_TEAM_NAME, MATCH_B_TEAM_KIT_COLOR } from "../../shared/match-b-fixture";
import { SafePostMatchReportShell } from "../shared/safe-post-match-report-shell";
import { B05_COMPLETED_BY, B05_COMPLETED_AT, b05CombinationEvidence, b05FootballObservations } from "../shared/report-data";
import type { SafeReportLocalState } from "../shared/use-safe-report-lifecycle";
import { identity, matchId, opponentName, matchIdentity, afterData, initialReport, debriefAnswers, allPlayers, timingReview } from "./fixtures";

/**
 * B05-COMPLETED — Post-match Report, completed/locked (official Gate B register, deferred row —
 * picked up in W2, remediated here per B2-R5/R6/R7). The same real match as `draft/`, now
 * genuinely locked — every mutation control the draft shows is absent or disabled, because the
 * real shared `PostMatchReportShell` itself gates on `report.status === "LOCKED"`, not because
 * this page hides anything. The one live control locked state keeps ("Reopen report") is wired
 * to this candidate's own fixture-local lifecycle, never a real production reopen action.
 */
export default function B05CompletedPage() {
  const initialLocalState: SafeReportLocalState = {
    status: initialReport.status as SafeReportLocalState["status"],
    ourScore: initialReport.homeGoals ?? 0,
    opponentScore: initialReport.awayGoals ?? 0,
    goals: initialReport.goals.map((g) => ({ id: g.id, playerId: g.playerId ?? null, playerName: g.playerName ?? null, minute: g.minute })),
    assists: initialReport.assists.map((a) => ({ id: a.id, playerId: a.playerId, playerName: a.playerName })),
    players: initialReport.playerActuals.map((p) => ({ id: p.id, playerId: p.playerId, playerName: p.playerName, attendanceStatus: p.attendanceStatus, meta: p.coreTeamName })),
    timingReview,
    outOfRangeEventCount: afterData.outOfRangeEventCount,
    completedBy: initialReport.completedBy,
    completedAt: initialReport.completedAt,
    nextLocalId: 0,
  };

  return (
    <div className="touchline mx-auto max-w-[900px] px-4 py-8" data-ui-lab-ready="true">
      <div>
        <h1 className="text-[22px] font-[650] text-[var(--foreground)]">Gate B — B05 Post-match report, completed</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
      </div>
      <div className="my-4">
        <AppearanceControl />
      </div>

      <SafePostMatchReportShell
        matchId={matchId}
        title={`${MATCH_B_TEAM_NAME} vs ${opponentName}`}
        presentation={matchIdentity}
        ownKitColor={MATCH_B_TEAM_KIT_COLOR}
        ownTeamName={MATCH_B_TEAM_NAME}
        opponentName={opponentName}
        staticAfterData={afterData}
        initialLocalState={initialLocalState}
        completedByLabel={B05_COMPLETED_BY}
        completionTimestamp={B05_COMPLETED_AT}
        debriefAnswers={debriefAnswers}
        allPlayers={allPlayers}
        footballObservations={b05FootballObservations}
        combinationEvidence={b05CombinationEvidence}
      />
    </div>
  );
}
