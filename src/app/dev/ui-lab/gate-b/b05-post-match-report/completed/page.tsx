"use client";

import { PostMatchReportPageShell } from "@/components/matches/match-detail/post-match-report-page-shell";
import { AppearanceControl } from "@/components/touchline";
import { MATCH_B_TEAM_NAME, MATCH_B_TEAM_KIT_COLOR } from "../../shared/match-b-fixture";
import { matchId, opponentName, matchIdentity, afterData, initialReport, debriefAnswers, allPlayers, timingReview } from "./fixtures";
import { DEBRIEF_SCHEMA_VERSION } from "@/lib/post-match/debrief/v1";

/**
 * B05-COMPLETED — Post-match Report, completed/locked (official Gate B register, deferred row —
 * now picked up: "Finish/report actions versus read-only knowledge"). The real
 * `PostMatchReportPageShell` composed exactly as `/post-match` does, fed this fixture's already-
 * `LOCKED` report: no "Complete report" button, no goal/assist/attendance add/remove controls, no
 * editable debrief wizard (`PostMatchDebrief` renders its own read-only view once `status ===
 * "SUBMITTED"`) — every mutation surface the draft page shows is genuinely absent here, not just
 * disabled, because the real components themselves gate on `status`/`surfaceState`. Defaults to
 * the `summary` tab (ADR-0147 §1a: no completion-action urgency once locked).
 */
export default function B05CompletedPage() {
  return (
    <div className="touchline mx-auto max-w-[900px] px-4 py-8" data-ui-lab-ready="true">
      <div>
        <h1 className="text-[22px] font-[650] text-[var(--foreground)]">Gate B — B05 Post-match report, completed</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{matchIdentity.kickoffDate}</p>
      </div>
      <div className="my-4">
        <AppearanceControl />
      </div>

      <PostMatchReportPageShell
        matchId={matchId}
        breadcrumbHref="#matches"
        title={`${MATCH_B_TEAM_NAME} vs ${opponentName}`}
        surfaceState="COMPLETED"
        completedByLabel={initialReport.completedBy ? `Completed by ${initialReport.completedBy}` : null}
        presentation={matchIdentity}
        ownKitColor={MATCH_B_TEAM_KIT_COLOR}
        afterData={afterData}
        reviewHref="#review"
        matchDetailHref="#match-detail"
        ownTeamName={MATCH_B_TEAM_NAME}
        opponentName={opponentName}
        postMatchPageProps={{
          matchId,
          initialReport,
          allPlayers,
          hasFinalizedSelections: true,
          goalAttributionGap: afterData.goalAttributionGap,
          timingReview,
          outOfRangeEventCount: afterData.outOfRangeEventCount,
        }}
        observationSectionProps={{ matchId, existingObservation: null, isLocked: true, matchFit: "NOT_ASSESSED" }}
        debriefProps={{
          reportRef: { kind: "LEAGUE", matchId },
          debriefId: "debrief-gate-b-05",
          status: "SUBMITTED",
          initialAnswers: { version: DEBRIEF_SCHEMA_VERSION, answers: debriefAnswers },
          opponentName,
          matchupLabel: `${MATCH_B_TEAM_NAME} vs ${opponentName}`,
          playerOptions: allPlayers.map((p) => ({ id: p.id, name: p.name })),
          periodOptions: ["First half", "Second half"],
        }}
        footballObservationProps={{
          matchId,
          players: allPlayers.map((p) => ({ id: p.id, name: p.name })),
          existingObservations: [
            { id: "obs-gb5-1", playerId: "player-gb5-elias", observationCode: "WORK_RATE_EFFECTIVE", polarity: "POSITIVE", note: "Energetic every time he was on the ball after coming on.", observedAt: initialReport.completedAt ?? matchIdentity.kickoffDate ?? "" },
          ],
          isLocked: true,
        }}
        legacyFeedbackProps={{ feedback: [], players: allPlayers.map((p) => ({ id: p.id, name: p.name })) }}
        combinationEvidenceProps={{ evidence: afterData.combinationEvidence, players: allPlayers.map((p) => ({ id: p.id, name: p.name })) }}
      />
    </div>
  );
}
