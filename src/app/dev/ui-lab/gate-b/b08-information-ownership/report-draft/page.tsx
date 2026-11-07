"use client";

import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { MATCH_B_TEAM_NAME, MATCH_B_TEAM_KIT_COLOR } from "../../shared/match-b-fixture";
import { SafePostMatchReportShell } from "../../b05-post-match-report/shared/safe-post-match-report-shell";
import type { SafeReportLocalState } from "../../b05-post-match-report/shared/use-safe-report-lifecycle";
import { B08TransitionNav } from "../shared/transition-nav";
import { B08_MATCH_ID, B08_OPPONENT_NAME, B08_COMPLETED_BY, B08_COMPLETED_AT, b08AfterIdentity } from "../shared/fixture";
import {
  b08InitialReport,
  b08AfterData,
  b08TimingReview,
  b08DebriefAnswers,
  b08AllPlayers,
  b08FootballObservations,
  b08CombinationEvidence,
} from "../shared/fixture-history";

/**
 * B08 — REPORT-DRAFT (editable report).
 *
 * Mounts the real, unmodified `SafePostMatchReportShell` (B05's fixture-safe pattern, ARR-0034's
 * one real mutation surface) parameterized with B08's OWN match identity/history — never B05's.
 * The one genuine incomplete-data condition (`fixture-history.ts`'s own doc comment): the second
 * half's timing is unconfirmed, which is the real blocker `complete()` enforces — resolving it
 * (via the Players tab's own real timing-review controls) is a prerequisite for completion, not a
 * decorative warning.
 */
export default function B08ReportDraftPage() {
  const initialReport = b08InitialReport("draft");
  const afterData = b08AfterData("draft");
  const timingReview = b08TimingReview("draft");

  const initialLocalState: SafeReportLocalState = {
    status: initialReport.status as SafeReportLocalState["status"],
    ourScore: initialReport.homeGoals ?? 0,
    opponentScore: initialReport.awayGoals ?? 0,
    goals: initialReport.goals.map((g) => ({ id: g.id, playerId: g.playerId ?? null, playerName: g.playerName ?? null, minute: g.minute })),
    assists: initialReport.assists.map((a) => ({ id: a.id, playerId: a.playerId, playerName: a.playerName })),
    players: initialReport.playerActuals.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      playerName: p.playerName,
      attendanceStatus: p.attendanceStatus,
      meta: p.coreTeamName,
    })),
    timingReview,
    outOfRangeEventCount: afterData.outOfRangeEventCount,
    completedBy: initialReport.completedBy,
    completedAt: initialReport.completedAt,
    nextLocalId: 0,
  };

  return (
    <div className="touchline mx-auto flex max-w-[900px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div className="flex items-center gap-3">
        <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate B
        </Link>
        <Link href="/dev/ui-lab/gate-b/b08-information-ownership/after" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Back to match (After)
        </Link>
      </div>
      <div>
        <h1 className="text-[22px] font-[650] text-[var(--foreground)]">B08 — Report, draft</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">Second-half timing still needs review before this report can be completed.</p>
      </div>

      <B08TransitionNav current="report-draft" />
      <AppearanceControl />

      <SafePostMatchReportShell
        matchId={B08_MATCH_ID}
        title={`${MATCH_B_TEAM_NAME} vs ${B08_OPPONENT_NAME}`}
        presentation={b08AfterIdentity("draft")}
        ownKitColor={MATCH_B_TEAM_KIT_COLOR}
        ownTeamName={MATCH_B_TEAM_NAME}
        opponentName={B08_OPPONENT_NAME}
        staticAfterData={afterData}
        initialLocalState={initialLocalState}
        completedByLabel={B08_COMPLETED_BY}
        completionTimestamp={B08_COMPLETED_AT.toISOString()}
        debriefAnswers={b08DebriefAnswers}
        allPlayers={b08AllPlayers}
        footballObservations={b08FootballObservations}
        combinationEvidence={b08CombinationEvidence}
        backHref="/dev/ui-lab/gate-b/b08-information-ownership/after"
      />
    </div>
  );
}
