"use client";

import { useState } from "react";
import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import { MATCH_B_TEAM_NAME, MATCH_B_TEAM_KIT_COLOR } from "../../shared/match-b-fixture";
import { SafePostMatchReportShell } from "../../b05-post-match-report/shared/safe-post-match-report-shell";
import type { SafeReportLocalState } from "../../b05-post-match-report/shared/use-safe-report-lifecycle";
import { B08TransitionNav } from "../shared/transition-nav";
import { B08_MATCH_ID, B08_OPPONENT_NAME, B08_COMPLETED_BY, B08_COMPLETED_AT, b08AfterIdentity } from "../shared/fixture";
import { b08InitialReport, b08AfterData, b08TimingReview, b08DebriefAnswers, b08AllPlayers, b08FootballObservations, b08CombinationEvidence } from "../shared/fixture-history";
import { loadFinishedB08JourneyEvents, loadB08JourneyReport } from "../shared/b08-journey";
import { computeEffectiveLiveEvents, deriveB08AfterDataFromReport, deriveB08IdentityFromReport } from "../shared/b08-projection";

/**
 * B08 — REPORT-COMPLETED (locked report).
 *
 * Same real `SafePostMatchReportShell`/`useSafeReportLifecycle` as REPORT-DRAFT, seeded directly
 * with the "completed" fixture variant (`status: "LOCKED"`, timing already resolved,
 * `completedBy`/`completedAt` set) — the exact same seed-as-already-completed mechanism B05's own
 * `completed/page.tsx` uses: the hook has no special "start locked" mode, the shell simply renders
 * whatever `initialLocalState.status` says, and the real shared `PostMatchReportShell` itself
 * gates every mutation control on `report.status === "LOCKED"`. No edit control is reachable.
 *
 * Default tab is `summary` (ADR-0147) — `SafePostMatchReportShell` resolves this itself via
 * `resolvePostMatchReportTab("COMPLETED", null)`. "Back to match" routes to B08-AFTER with
 * `?report=completed` so B08-AFTER renders its own completed variant (P1-5).
 *
 * W5 second remediation (independent review, 2026-11-08, "lifecycle data consistency"): if the
 * coach completed a report during an interactive journey (`loadB08JourneyReport()`), THIS page
 * now shows THAT exact reconciled record (goals/score/attribution/completion metadata) via the
 * same `deriveB08AfterDataFromReport()`/`deriveB08IdentityFromReport()` projection REPORT-DRAFT
 * and AFTER both read — never a second, independently-correct-looking interpretation. If that
 * journey's own report was never actually locked (status still `REPORTED`), the real shared shell
 * renders it honestly as its own real DRAFT-editable surface instead of fabricating a completed
 * state — `SafePostMatchReportShell`'s own `surfaceState = status === "LOCKED" ? "COMPLETED" :
 * "DRAFT"` already does this correctly; this page does not special-case it. No journey at all
 * (every direct visit, including every CI/Playwright capture) falls back to the unchanged
 * canonical `b08InitialReport("completed")` reference snapshot, exactly as before this pass.
 */
export default function B08ReportCompletedPage() {
  const [persistedReport] = useState(() => loadB08JourneyReport());
  const [journeyEvents] = useState(() => loadFinishedB08JourneyEvents());
  const effectiveEvents = journeyEvents ? computeEffectiveLiveEvents(journeyEvents) : [];

  let initialLocalState: SafeReportLocalState;
  let staticAfterData: MatchDetailAfterData;
  let presentation: MatchPresentation;
  let isLocked: boolean;

  if (persistedReport) {
    initialLocalState = {
      status: persistedReport.status,
      ourScore: persistedReport.ourScore,
      opponentScore: persistedReport.opponentScore,
      goals: persistedReport.goals,
      assists: persistedReport.assists,
      players: persistedReport.players,
      timingReview: persistedReport.timingReview,
      outOfRangeEventCount: persistedReport.outOfRangeEventCount,
      completedBy: persistedReport.completedBy,
      completedAt: persistedReport.completedAt,
      nextLocalId: persistedReport.nextLocalId,
    };
    staticAfterData = deriveB08AfterDataFromReport(persistedReport, effectiveEvents);
    isLocked = persistedReport.status === "LOCKED";
    presentation = deriveB08IdentityFromReport(persistedReport, isLocked ? "done" : "report_incomplete");
  } else {
    const referenceInitialReport = b08InitialReport("completed");
    const referenceAfterData = b08AfterData("completed");
    initialLocalState = {
      status: referenceInitialReport.status as SafeReportLocalState["status"],
      ourScore: referenceInitialReport.homeGoals ?? 0,
      opponentScore: referenceInitialReport.awayGoals ?? 0,
      goals: referenceInitialReport.goals.map((g) => ({ id: g.id, playerId: g.playerId ?? null, playerName: g.playerName ?? null, minute: g.minute })),
      assists: referenceInitialReport.assists.map((a) => ({ id: a.id, playerId: a.playerId, playerName: a.playerName })),
      players: referenceInitialReport.playerActuals.map((p) => ({ id: p.id, playerId: p.playerId, playerName: p.playerName, attendanceStatus: p.attendanceStatus, meta: p.coreTeamName })),
      timingReview: b08TimingReview("completed"),
      outOfRangeEventCount: referenceAfterData.outOfRangeEventCount,
      completedBy: referenceInitialReport.completedBy,
      completedAt: referenceInitialReport.completedAt,
      nextLocalId: 0,
    };
    staticAfterData = referenceAfterData;
    isLocked = true;
    presentation = b08AfterIdentity("completed");
  }

  return (
    <div className="touchline mx-auto flex max-w-[900px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div className="flex items-center gap-3">
        <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate B
        </Link>
        <Link
          href="/dev/ui-lab/gate-b/b08-information-ownership/after?report=completed"
          className="text-[12px] text-[var(--text-muted)] hover:underline"
        >
          &larr; Back to match (historical After)
        </Link>
      </div>
      <div>
        <h1 className="text-[22px] font-[650] text-[var(--foreground)]">B08 — Report, completed</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          {isLocked
            ? "Locked — read-only. No edit control is reachable."
            : "Your interactive journey's own report has not been locked yet — shown here as its real, still-editable draft."}
        </p>
      </div>

      <B08TransitionNav current="report-completed" />
      <AppearanceControl />

      {persistedReport && (
        <div className="rounded-lg border border-dashed border-[var(--accent)]/50 bg-[var(--accent)]/5 px-3 py-2 text-[12px] text-[var(--text-muted)]">
          <span className="font-[650] text-[var(--foreground)]">Reflecting your interactive journey:</span> this is the exact
          report you reconciled on REPORT-DRAFT — not the fixed reference fixture.
        </div>
      )}

      <SafePostMatchReportShell
        matchId={B08_MATCH_ID}
        title={`${MATCH_B_TEAM_NAME} vs ${B08_OPPONENT_NAME}`}
        presentation={presentation}
        ownKitColor={MATCH_B_TEAM_KIT_COLOR}
        ownTeamName={MATCH_B_TEAM_NAME}
        opponentName={B08_OPPONENT_NAME}
        staticAfterData={staticAfterData}
        initialLocalState={initialLocalState}
        completedByLabel={B08_COMPLETED_BY}
        completionTimestamp={B08_COMPLETED_AT.toISOString()}
        debriefAnswers={b08DebriefAnswers}
        allPlayers={b08AllPlayers}
        footballObservations={b08FootballObservations}
        combinationEvidence={b08CombinationEvidence}
        backHref="/dev/ui-lab/gate-b/b08-information-ownership/after?report=completed"
      />
    </div>
  );
}
