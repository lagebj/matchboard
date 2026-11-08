"use client";

import { useState } from "react";
import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import { MATCH_B_TEAM_NAME, MATCH_B_TEAM_KIT_COLOR } from "../../shared/match-b-fixture";
import { SafePostMatchReportShell } from "../../b05-post-match-report/shared/safe-post-match-report-shell";
import type { SafeReportLocalState } from "../../b05-post-match-report/shared/use-safe-report-lifecycle";
import { B08TransitionNav } from "../shared/transition-nav";
import { B08_MATCH_ID, B08_OPPONENT_NAME, B08_COMPLETED_BY, B08_COMPLETED_AT, b08AfterIdentity } from "../shared/fixture";
import { b08InitialReport, b08AfterData, b08TimingReview, b08DebriefAnswers, b08AllPlayers, b08FootballObservations, b08CombinationEvidence } from "../shared/fixture-history";
import { loadFinishedB08JourneyEvents, loadB08JourneyReport, saveB08JourneyReport, type B08PersistedReportState } from "../shared/b08-journey";
import { computeEffectiveLiveEvents, deriveGoalsAndAssists, deriveEffectiveScore, deriveB08AfterDataFromReport } from "../shared/b08-projection";

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
 * (`onStatusChange` lifting the live status up) switch to `?report=completed` once locked.
 *
 * W5 second remediation (independent review, 2026-11-08, "lifecycle data consistency") — THREE
 * initial-state sources, in priority order, so the same effective match appears consistently
 * across a reload AND across navigation to AFTER/REPORT-COMPLETED (not just within this one page):
 *
 * 1. A PERSISTED, reconciled report (`loadB08JourneyReport()`) — the coach already started
 *    editing/completing this exact report in an earlier visit; resume EXACTLY where they left off
 *    (including a LOCKED status), not a re-derivation from raw events.
 * 2. A FINISHED LIVE journey with no report reconciliation yet (`loadFinishedB08JourneyEvents()`)
 *    — seed the draft from what was ACTUALLY recorded, reversal-aware
 *    (`shared/b08-projection.ts`'s `computeEffectiveLiveEvents()`/`deriveGoalsAndAssists()`/
 *    `deriveEffectiveScore()` — a reversed goal correctly does not seed a report row).
 * 3. No journey at all (every direct visit, including every CI/Playwright capture) — the
 *    unchanged canonical `b08InitialReport("draft")` reference snapshot, exactly as before this
 *    remediation.
 *
 * Every real edit (`onStateChange`) is persisted back to the SAME journey slot, so AFTER and
 * REPORT-COMPLETED can read the identical reconciled record (`deriveB08AfterDataFromReport()`) —
 * one authoritative projection, not three independently-correct-looking pages.
 */
const AFTER_HREF = "/dev/ui-lab/gate-b/b08-information-ownership/after";

function toLocalState(report: B08PersistedReportState): SafeReportLocalState {
  return {
    status: report.status,
    ourScore: report.ourScore,
    opponentScore: report.opponentScore,
    goals: report.goals,
    assists: report.assists,
    players: report.players,
    timingReview: report.timingReview,
    outOfRangeEventCount: report.outOfRangeEventCount,
    completedBy: report.completedBy,
    completedAt: report.completedAt,
    nextLocalId: report.nextLocalId,
  };
}

function toPersisted(state: SafeReportLocalState): B08PersistedReportState {
  return {
    status: state.status,
    ourScore: state.ourScore,
    opponentScore: state.opponentScore,
    goals: state.goals,
    assists: state.assists,
    players: state.players,
    timingReview: state.timingReview,
    outOfRangeEventCount: state.outOfRangeEventCount,
    completedBy: state.completedBy,
    completedAt: state.completedAt,
    nextLocalId: state.nextLocalId,
  };
}

export default function B08ReportDraftPage() {
  // Lazy-initialized once per mount — none of these should change identity just because this
  // component re-renders; a fresh value only ever comes from `onStateChange` persisting forward.
  const [persistedReport] = useState(() => loadB08JourneyReport());
  const [journeyEvents] = useState(() => loadFinishedB08JourneyEvents());
  const hasJourney = persistedReport !== null || journeyEvents !== null;

  const [reportStatus, setReportStatus] = useState<string>(persistedReport?.status ?? "REPORTED");
  const afterHref = reportStatus === "LOCKED" ? `${AFTER_HREF}?report=completed` : AFTER_HREF;

  const effectiveEvents = journeyEvents ? computeEffectiveLiveEvents(journeyEvents) : [];

  let initialLocalState: SafeReportLocalState;
  let staticAfterData: MatchDetailAfterData;

  if (persistedReport) {
    // Priority 1: resume the coach's own prior reconciliation exactly.
    initialLocalState = toLocalState(persistedReport);
    staticAfterData = deriveB08AfterDataFromReport(persistedReport, effectiveEvents);
  } else if (journeyEvents) {
    // Priority 2: seed a fresh draft from the real, reversal-aware LIVE journey.
    const { goals, assists } = deriveGoalsAndAssists(effectiveEvents);
    const { ourGoals, opponentGoals } = deriveEffectiveScore(effectiveEvents);
    const referenceInitialReport = b08InitialReport("draft");
    const seeded: B08PersistedReportState = {
      status: "REPORTED",
      ourScore: ourGoals,
      opponentScore: opponentGoals,
      goals: goals.map((g) => ({ id: g.id, playerId: g.participantKey, playerName: g.playerName, minute: g.minute })),
      // deriveGoalsAndAssists() only ever pushes an assist row when its event's own playerId is a
      // real, non-null string (see its own source) — the `!` reflects that real invariant.
      assists: assists.map((a) => ({ id: a.id, playerId: a.participantKey!, playerName: a.playerName })),
      players: referenceInitialReport.playerActuals.map((p) => ({ id: p.id, playerId: p.playerId, playerName: p.playerName, attendanceStatus: p.attendanceStatus, meta: p.coreTeamName })),
      // B08-LIVE does not itself model timing confirmation — the second half's own timing-review
      // row stays the fixture's one genuine incomplete-data condition for the interactive seed
      // too, resolved through this same page's real "Confirm duration" control either way.
      timingReview: b08TimingReview("draft"),
      outOfRangeEventCount: b08AfterData("draft").outOfRangeEventCount,
      completedBy: null,
      completedAt: null,
      nextLocalId: 0,
    };
    initialLocalState = toLocalState(seeded);
    staticAfterData = deriveB08AfterDataFromReport(seeded, effectiveEvents);
  } else {
    // Priority 3: the unchanged reference snapshot.
    const referenceInitialReport = b08InitialReport("draft");
    const referenceAfterData = b08AfterData("draft");
    initialLocalState = {
      status: referenceInitialReport.status as SafeReportLocalState["status"],
      ourScore: referenceInitialReport.homeGoals ?? 0,
      opponentScore: referenceInitialReport.awayGoals ?? 0,
      goals: referenceInitialReport.goals.map((g) => ({ id: g.id, playerId: g.playerId ?? null, playerName: g.playerName ?? null, minute: g.minute })),
      assists: referenceInitialReport.assists.map((a) => ({ id: a.id, playerId: a.playerId, playerName: a.playerName })),
      players: referenceInitialReport.playerActuals.map((p) => ({ id: p.id, playerId: p.playerId, playerName: p.playerName, attendanceStatus: p.attendanceStatus, meta: p.coreTeamName })),
      timingReview: b08TimingReview("draft"),
      outOfRangeEventCount: referenceAfterData.outOfRangeEventCount,
      completedBy: referenceInitialReport.completedBy,
      completedAt: referenceInitialReport.completedAt,
      nextLocalId: 0,
    };
    staticAfterData = referenceAfterData;
  }

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
          from what you actually recorded on B08-LIVE in this browser session (reversed events excluded), not the fixed reference
          fixture. Narrative content authored for the reference match (reflection, observations, combination evidence) is not
          reproduced here — see AFTER's own disclosure once you return.
        </div>
      )}

      <SafePostMatchReportShell
        matchId={B08_MATCH_ID}
        title={`${MATCH_B_TEAM_NAME} vs ${B08_OPPONENT_NAME}`}
        presentation={b08AfterIdentity("draft")}
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
        backHref={AFTER_HREF}
        backHrefForStatus={(status) => (status === "LOCKED" ? `${AFTER_HREF}?report=completed` : AFTER_HREF)}
        onStatusChange={(status) => setReportStatus(status)}
        onStateChange={(state) => saveB08JourneyReport(toPersisted(state))}
      />
    </div>
  );
}
