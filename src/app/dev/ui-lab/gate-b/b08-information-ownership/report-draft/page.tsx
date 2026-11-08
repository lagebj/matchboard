"use client";

import { useState } from "react";
import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import { MATCH_B_TEAM_NAME, MATCH_B_TEAM_KIT_COLOR } from "../../shared/match-b-fixture";
import { SafePostMatchReportShell } from "../../b05-post-match-report/shared/safe-post-match-report-shell";
import type { SafeReportLocalState } from "../../b05-post-match-report/shared/use-safe-report-lifecycle";
import { B08TransitionNav } from "../shared/transition-nav";
import { EMPTY_DEBRIEF_ANSWERS } from "@/lib/post-match/debrief/v1";
import { B08_MATCH_ID, B08_REPORT_ID, B08_DEBRIEF_ID, B08_OPPONENT_NAME, B08_COMPLETED_BY, B08_COMPLETED_AT, b08AfterIdentity } from "../shared/fixture";
import {
  b08InitialReport,
  b08AfterData,
  b08TimingReview,
  b08DebriefAnswers,
  b08AllPlayers,
  b08FootballObservations,
  b08CombinationEvidence,
  b08MinutesByParticipant,
  b08ObservationCountByParticipant,
} from "../shared/fixture-history";
import { loadFinishedB08JourneyEvents, loadB08JourneyReport, loadB08HistoryOrigin, saveB08JourneyReport, type B08PersistedReportState } from "../shared/b08-journey";
import { resolveB08EffectiveHistory, deriveGoalsAndAssists, deriveEffectiveScore, deriveB08AfterDataFromReport } from "../shared/b08-projection";

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
 *
 * W5 THIRD remediation (independent review, 2026-11-08, "final data-integrity remediation"):
 * `onStateChange` now records which history a persisted report is grounded in
 * (`historyOrigin` — `"REFERENCE"` for a direct edit of the canonical report, `"LIVE_JOURNEY"`
 * for one seeded from a real LIVE session) so AFTER/REPORT-COMPLETED never again derive an
 * empty timeline from an edited reference report (defect #1), and narrative/evidence props
 * (`debriefAnswers`/`footballObservations`/`combinationEvidence`/participant-minutes/observation
 * counts) are chosen by that SAME origin — never the fixed reference content for a LIVE_JOURNEY
 * report, never an empty draft for a REFERENCE one (defect #2). `reportId`/`debriefId`/
 * `minutesByParticipant` passed to the shared shell are now B08's own, not B05's (defect #4).
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
  const [historyOrigin] = useState(() => loadB08HistoryOrigin());
  const [journeyEvents] = useState(() => loadFinishedB08JourneyEvents());
  const hasJourney = persistedReport !== null || journeyEvents !== null;
  // Third remediation ("final data-integrity remediation", defect #2): a REFERENCE-origin
  // persisted report (a direct edit of the canonical report, no LIVE session involved) keeps its
  // own REAL narrative/evidence — only a LIVE_JOURNEY-origin report's narrative must be withheld
  // (it was authored for a different match outcome). `hasJourney` alone used to gate this
  // disclosure/narrative choice, which incorrectly treated a reference-mode edit as "interactive."
  // Gated on `hasJourney` too, not just the stored origin: an UNFINISHED LIVE session (started,
  // never finished) can leave `historyOrigin: "LIVE_JOURNEY"` in storage with neither a usable
  // `journeyEvents` nor a `persistedReport` — this page then correctly falls through to the
  // reference tier for its actual data, and must not ALSO withhold reference narrative for data
  // it isn't even showing.
  const isInteractiveJourney = hasJourney && historyOrigin === "LIVE_JOURNEY";

  const [reportStatus, setReportStatus] = useState<string>(persistedReport?.status ?? "REPORTED");
  const afterHref = reportStatus === "LOCKED" ? `${AFTER_HREF}?report=completed` : AFTER_HREF;

  // Resolves the REAL chronology this report is grounded in — a REFERENCE origin (or no journey
  // at all) keeps the full canonical 10'/22'/48' history; previously, ANY persisted report (even
  // one from editing the reference report directly) derived its timeline from an empty raw event
  // array, silently discarding the real chronology. See `b08-projection.ts`'s own doc comment.
  const history = resolveB08EffectiveHistory(historyOrigin, journeyEvents);

  let initialLocalState: SafeReportLocalState;
  let staticAfterData: MatchDetailAfterData;

  if (persistedReport) {
    // Priority 1: resume the coach's own prior reconciliation exactly.
    initialLocalState = toLocalState(persistedReport);
    staticAfterData = deriveB08AfterDataFromReport(persistedReport, history);
  } else if (journeyEvents) {
    // Priority 2: seed a fresh draft from the real, reversal-aware LIVE journey.
    const { goals, assists } = deriveGoalsAndAssists(history.effectiveEvents);
    const { ourGoals, opponentGoals } = deriveEffectiveScore(history.effectiveEvents);
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
    staticAfterData = deriveB08AfterDataFromReport(seeded, history);
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

      {isInteractiveJourney && (
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
        reportId={B08_REPORT_ID}
        debriefId={B08_DEBRIEF_ID}
        minutesByParticipant={b08MinutesByParticipant}
        observationCountByParticipant={isInteractiveJourney ? new Map() : b08ObservationCountByParticipant}
        teamNote={history.teamNote}
        debriefAnswers={isInteractiveJourney ? EMPTY_DEBRIEF_ANSWERS.answers : b08DebriefAnswers}
        debriefStatus={isInteractiveJourney ? "DRAFT" : "SUBMITTED"}
        allPlayers={b08AllPlayers}
        footballObservations={isInteractiveJourney ? [] : b08FootballObservations}
        combinationEvidence={isInteractiveJourney ? [] : b08CombinationEvidence}
        backHref={AFTER_HREF}
        backHrefForStatus={(status) => (status === "LOCKED" ? `${AFTER_HREF}?report=completed` : AFTER_HREF)}
        onStatusChange={(status) => setReportStatus(status)}
        onStateChange={(state) => saveB08JourneyReport(toPersisted(state), journeyEvents ? "LIVE_JOURNEY" : "REFERENCE")}
      />
    </div>
  );
}
