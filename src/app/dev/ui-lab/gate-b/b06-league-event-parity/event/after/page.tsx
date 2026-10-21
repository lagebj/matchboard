import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { PostMatchReportShell } from "@/components/matches/post-match-report-shell";
import { PostMatchDebrief } from "@/components/post-match/debrief/post-match-debrief";
import { FootballObservationSection } from "@/components/player-development/football-observation-section";
import { MatchCombinationEvidencePanel } from "@/components/matches/match-combination-evidence-panel";
import { DEBRIEF_SCHEMA_VERSION } from "@/lib/post-match/debrief/v1";
import { CompareNav } from "../../shared/compare-nav";
import {
  identity,
  matchIdentity,
  eventName,
  eventSquadName,
  opponentName,
  report,
  actions,
  capabilities,
  availablePlayers,
  debriefAnswers,
  footballObservations,
  combinationEvidence,
  B06_EVENT_MATCH_ID,
} from "./fixtures";

/**
 * B06 — Event · After (completed, report locked, read-only). Reuses the real `PostMatchReportShell`
 * plus the same `extraSections` composition `EventMatchReportPanel` builds in production
 * (`PostMatchDebrief`, `FootballObservationSection`, `MatchCombinationEvidencePanel`) — the genuine
 * editing capability is equivalent to League's; what differs is purely informational architecture
 * (one scrollable panel here vs. League's dedicated tabbed `/post-match` route).
 */
export default function B06EventAfterPage() {
  const presentPlayers = report.players.map((p) => ({ id: p.playerId, name: p.playerName }));
  const matchupLabel = `${eventSquadName} 3–1 ${opponentName}`;

  return (
    <div className="touchline mx-auto flex max-w-[900px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate B
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">B06 — Event · After, completed match</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
      </div>

      <CompareNav active="event-after" />
      <AppearanceControl />

      <DecisionBanner
        variant="note"
        title="Return destination is Event-scoped, not match-scoped"
        description={`Production returns the coach to this Event's own page (revalidatePath("/events/${"${eventId}"}")) after ending a live session or closing this report — not a dedicated route for this specific match the way League's "← Back to match" always resolves to /o/[orgSlug]/matches/[matchId]. See League · After for the comparison, and SOURCE_RECONCILIATION.md for why this is a design question B06 raises rather than a confirmed defect.`}
      />

      <p className="text-[12px] text-[var(--text-muted)]">
        Event: <span className="font-[600] text-[var(--foreground)]">{eventName}</span> · Squad:{" "}
        <span className="font-[600] text-[var(--foreground)]">{eventSquadName}</span> · Match ID:{" "}
        <code>{B06_EVENT_MATCH_ID}</code>
      </p>

      <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
        <MatchIdentityCard presentation={matchIdentity} ownKitColor={null} />
      </div>

      <PostMatchReportShell
        report={report}
        actions={actions}
        capabilities={capabilities}
        availablePlayers={availablePlayers}
        onChanged={() => {}}
        extraSections={
          <>
            <PostMatchDebrief
              reportRef={{ kind: "EVENT", eventMatchId: B06_EVENT_MATCH_ID }}
              debriefId="debrief-gate-b-06-event"
              status="SUBMITTED"
              initialAnswers={{ version: DEBRIEF_SCHEMA_VERSION, answers: debriefAnswers }}
              opponentName={opponentName}
              matchupLabel={matchupLabel}
              playerOptions={presentPlayers}
              periodOptions={["First half", "Second half", "Multiple periods", "Not sure"]}
              readOnly
            />
            <FootballObservationSection
              eventMatchId={B06_EVENT_MATCH_ID}
              players={presentPlayers}
              existingObservations={footballObservations}
              isLocked
            />
            <MatchCombinationEvidencePanel evidence={combinationEvidence} players={presentPlayers} />
          </>
        }
      />

      <p className="text-[12px] text-[var(--text-muted)]">
        Every editing control above is genuinely disabled (report status LOCKED), not visually disabled while
        secretly interactive — the only reachable action, &ldquo;Reopen report&rdquo;, resolves to an honest
        failure in this candidate rather than a silent production mutation.
      </p>
    </div>
  );
}
