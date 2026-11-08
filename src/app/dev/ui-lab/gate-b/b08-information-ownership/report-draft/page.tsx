"use client";

import { useState } from "react";
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
  b08GoalsAndAssistsFromJourney,
} from "../shared/fixture-history";
import { loadFinishedB08JourneyEvents } from "../shared/b08-journey";

/**
 * B08 — REPORT-DRAFT (editable report).
 *
 * Mounts the real, unmodified `SafePostMatchReportShell` (B05's fixture-safe pattern, ARR-0034's
 * one real mutation surface) parameterized with B08's OWN match identity/history — never B05's.
 * The one genuine incomplete-data condition (`fixture-history.ts`'s own doc comment): the second
 * half's timing is unconfirmed, which is the real blocker `complete()` enforces — resolving it
 * (via the Players tab's own real timing-review controls) is a prerequisite for completion, not a
 * decorative warning.
 *
 * B08 W5 remediation (independent review, P1-5/P1-6): completing the report IN PLACE here (status
 * flips REPORTED -> LOCKED, no navigation — the real, already-tested reconciliation behavior) must
 * not leave either "back to match" control pointing at the stale draft/incomplete AFTER variant.
 * Both the shell's own internal back-link (`backHrefForStatus`) and this page's own top breadcrumb
 * (`onStatusChange` lifting the live status up) now switch to `?report=completed` once locked.
 *
 * P1-6 (LIVE-to-report continuity): if a FINISHED B08-LIVE journey exists in this browser session
 * (`shared/b08-journey.ts`), goals/assists/score are derived from what was ACTUALLY recorded there
 * (`b08GoalsAndAssistsFromJourney()`) instead of always showing the fixed canonical report —
 * genuine dependency on the coach's own interactive actions, not five disconnected static
 * snapshots. No journey (every direct visit, including every CI/Playwright capture) falls back to
 * the unchanged canonical `b08InitialReport("draft")`, exactly as before this remediation.
 */
const AFTER_HREF = "/dev/ui-lab/gate-b/b08-information-ownership/after";

export default function B08ReportDraftPage() {
  const [reportStatus, setReportStatus] = useState<string>("REPORTED");
  const afterHref = reportStatus === "LOCKED" ? `${AFTER_HREF}?report=completed` : AFTER_HREF;
  const initialReport = b08InitialReport("draft");
  const afterData = b08AfterData("draft");
  const timingReview = b08TimingReview("draft");

  // Lazy-initialized once per mount — a finished journey's events never change identity mid-session
  // just because this component re-renders.
  const [journeyEvents] = useState(() => loadFinishedB08JourneyEvents());
  const hasJourney = journeyEvents !== null;
  const journeyDerived = hasJourney ? b08GoalsAndAssistsFromJourney(journeyEvents) : null;
  const journeyOwnGoals = hasJourney ? journeyEvents.filter((e) => e.eventType === "GOAL_FOR").length : null;
  const journeyOpponentGoals = hasJourney ? journeyEvents.filter((e) => e.eventType === "GOAL_AGAINST").length : null;

  const initialLocalState: SafeReportLocalState = {
    status: initialReport.status as SafeReportLocalState["status"],
    ourScore: journeyOwnGoals ?? initialReport.homeGoals ?? 0,
    opponentScore: journeyOpponentGoals ?? initialReport.awayGoals ?? 0,
    goals: journeyDerived
      ? journeyDerived.goals.map((g) => ({ id: g.id, playerId: g.participantKey, playerName: g.playerName, minute: g.minute }))
      : initialReport.goals.map((g) => ({ id: g.id, playerId: g.playerId ?? null, playerName: g.playerName ?? null, minute: g.minute })),
    assists: journeyDerived
      ? // b08GoalsAndAssistsFromJourney() only ever pushes an assist row when its event's own
        // playerId is a real, non-null string (see its own source) — the `!` reflects that real
        // invariant, not an unchecked assumption.
        journeyDerived.assists.map((a) => ({ id: a.id, playerId: a.participantKey!, playerName: a.playerName }))
      : initialReport.assists.map((a) => ({ id: a.id, playerId: a.playerId, playerName: a.playerName })),
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
        <Link href={afterHref} className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Back to match (After)
        </Link>
      </div>
      <div>
        <h1 className="text-[22px] font-[650] text-[var(--foreground)]">B08 — Report, draft</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          {reportStatus === "LOCKED"
            ? "Completed in place — the report lifecycle shell below now shows LOCKED, no navigation required."
            : "Second-half timing still needs review before this report can be completed."}
        </p>
      </div>

      <B08TransitionNav current="report-draft" />
      <AppearanceControl />

      {hasJourney && (
        <div className="rounded-lg border border-dashed border-[var(--accent)]/50 bg-[var(--accent)]/5 px-3 py-2 text-[12px] text-[var(--text-muted)]">
          <span className="font-[650] text-[var(--foreground)]">Reflecting your LIVE session:</span> goals/assists/score below come
          from what you actually recorded on B08-LIVE in this browser session, not the fixed reference fixture.
        </div>
      )}

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
        backHref={AFTER_HREF}
        backHrefForStatus={(status) => (status === "LOCKED" ? `${AFTER_HREF}?report=completed` : AFTER_HREF)}
        onStatusChange={(status) => setReportStatus(status)}
      />
    </div>
  );
}
