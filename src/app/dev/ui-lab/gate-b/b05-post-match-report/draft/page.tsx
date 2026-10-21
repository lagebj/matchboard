"use client";

import { useState } from "react";
import { PostMatchReportPageShell } from "@/components/matches/match-detail/post-match-report-page-shell";
import { AppearanceControl, TouchlineButton } from "@/components/touchline";
import { MATCH_B_TEAM_NAME, MATCH_B_TEAM_KIT_COLOR } from "../../shared/match-b-fixture";
import * as draftFixtures from "./fixtures";
import * as completedFixtures from "../completed/fixtures";
import { DEBRIEF_SCHEMA_VERSION } from "@/lib/post-match/debrief/v1";

type Variant = "draft" | "completed";

/**
 * B05 "Post-match Report / Draft" (official Gate B register, deferred row — now picked up):
 * "Finish/report actions versus read-only knowledge." The real editable moment: `Complete
 * report` (inside the real `PostMatchReportShell`, Players tab) is reachable because the real
 * debrief is already `SUBMITTED` — the real completion gate (`completeReport()`'s
 * `isDebriefSubmittedForReport`) is genuinely satisfied, not bypassed. The real
 * `GoalAttributionGapBanner` and `RecoveredTimingCallout` show one real unresolved item each.
 *
 * "Continue fixture simulation →" (same UI-Lab-local grammar A07/B01 established — never the real
 * `Complete report` button, never a production mutation) swaps this page's props from this
 * fixture to `../completed/fixtures`' own fixture — the same real match, now locked — entirely in
 * local state. This demonstrates ADR-0147 §1b's actual regression (`post-match-report-page-
 * shell.test.tsx`'s own coverage): the resolved `?tab=players` default stays pinned and selected
 * through the DRAFT -> COMPLETED transition, because `players` is a real tab in both tab sets and
 * the shell's tab-pinning effect depends only on the URL, never on `surfaceState`.
 */
export default function B05DraftPage() {
  const [variant, setVariant] = useState<Variant>("draft");
  const fx = variant === "draft" ? draftFixtures : completedFixtures;
  const surfaceState = variant === "draft" ? "DRAFT" : "COMPLETED";

  return (
    <div className="touchline mx-auto max-w-[900px] px-4 py-8" data-ui-lab-ready="true">
      <div>
        <h1 className="text-[22px] font-[650] text-[var(--foreground)]">Gate B — B05 Post-match report, draft</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          {fx.matchIdentity.kickoffDate} · Surface state: {surfaceState}
        </p>
      </div>
      <div className="my-4">
        <AppearanceControl />
      </div>

      {variant === "draft" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2.5">
          <p className="text-[12px] text-[var(--text-muted)]">
            Fixture simulation only — swaps this page&apos;s local props to the completed fixture. Never a production mutation.
          </p>
          <TouchlineButton variant="secondary" size="sm" onClick={() => setVariant("completed")}>
            Continue fixture simulation → Complete report
          </TouchlineButton>
        </div>
      )}

      <PostMatchReportPageShell
        matchId={fx.matchId}
        breadcrumbHref="#matches"
        title={`${MATCH_B_TEAM_NAME} vs ${fx.opponentName}`}
        surfaceState={surfaceState}
        completedByLabel={fx.initialReport.completedBy ? `Completed by ${fx.initialReport.completedBy}` : null}
        presentation={fx.matchIdentity}
        ownKitColor={MATCH_B_TEAM_KIT_COLOR}
        afterData={fx.afterData}
        reviewHref="#review"
        matchDetailHref="#match-detail"
        ownTeamName={MATCH_B_TEAM_NAME}
        opponentName={fx.opponentName}
        postMatchPageProps={{
          matchId: fx.matchId,
          initialReport: fx.initialReport,
          allPlayers: fx.allPlayers,
          hasFinalizedSelections: true,
          goalAttributionGap: fx.afterData.goalAttributionGap,
          timingReview: fx.timingReview,
          outOfRangeEventCount: fx.afterData.outOfRangeEventCount,
        }}
        observationSectionProps={{ matchId: fx.matchId, existingObservation: null, isLocked: variant === "completed", matchFit: "NOT_ASSESSED" }}
        debriefProps={{
          reportRef: { kind: "LEAGUE", matchId: fx.matchId },
          debriefId: "debrief-gate-b-05",
          status: "SUBMITTED",
          initialAnswers: { version: DEBRIEF_SCHEMA_VERSION, answers: fx.debriefAnswers },
          opponentName: fx.opponentName,
          matchupLabel: `${MATCH_B_TEAM_NAME} vs ${fx.opponentName}`,
          playerOptions: fx.allPlayers.map((p) => ({ id: p.id, name: p.name })),
          periodOptions: ["First half", "Second half"],
        }}
        footballObservationProps={{
          matchId: fx.matchId,
          players: fx.allPlayers.map((p) => ({ id: p.id, name: p.name })),
          existingObservations: [
            {
              id: "obs-gb5-1",
              playerId: "player-gb5-elias",
              observationCode: "WORK_RATE_EFFECTIVE",
              polarity: "POSITIVE",
              note: "Energetic every time he was on the ball after coming on.",
              observedAt: fx.matchIdentity.kickoffDate ?? "",
            },
          ],
          isLocked: variant === "completed",
        }}
        legacyFeedbackProps={{ feedback: [], players: fx.allPlayers.map((p) => ({ id: p.id, name: p.name })) }}
        combinationEvidenceProps={{ evidence: fx.afterData.combinationEvidence, players: fx.allPlayers.map((p) => ({ id: p.id, name: p.name })) }}
      />
    </div>
  );
}
