"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Radio, Tv } from "lucide-react";
import { MatchDetailHeader } from "@/components/matches/match-detail/match-detail-header";
import { BeforeMatchOverview } from "@/components/matches/match-detail/before-match-overview";
import { AfterMatchOverview } from "@/components/matches/match-detail/after-match-overview";
import { MatchEventsPanel } from "@/components/matches/match-detail/match-events-panel";
import { MatchStatsPanel } from "@/components/matches/match-detail/match-stats-panel";
import { MatchAfterMatchPanel } from "@/components/matches/match-detail/match-after-match-panel";
import { MatchHistoryPanel } from "@/components/matches/match-detail/match-history-panel";
import { MatchOpponentContextPanel } from "@/components/matches/match-detail/match-opponent-context-panel";
import { MatchNotesTab } from "@/components/matches/match-detail/match-notes-tab";
import { MatchTacticsPanel } from "@/components/matches/match-tactics-panel";
import { PlannedRotationPanel } from "@/components/matches/planned-rotation-panel";
import { MatchEditForm } from "@/components/matches/match-edit-form";
import { MatchHelpersPanel } from "@/components/matches/match-helpers-panel";
import { LeagueMatchGuestsPanel } from "@/components/matches/league-match-guests-panel";
import { TabRail } from "@/components/ui/tab-rail";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { TouchlineButton } from "@/components/touchline";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import { getMatchDetailTabs, resolveMatchDetailTab, type MatchDetailSurfaceState, type MatchDetailTabKey } from "@/lib/matches/match-detail-tabs";
import { formatWarningCode } from "@/lib/match-utils";
import { buildMatchMetaLine } from "@/lib/matches/match-detail-format";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import type { PlannedRotationWithChanges } from "@/lib/planned-rotation/planned-rotation";
import type { OpponentHistoryData } from "@/lib/audit/opponent-history";
import type { PlannedMatchAdvisorViewModel } from "@/lib/ai/presentation/planned-match-advisor";
import { cancelMatchAction, reopenMatchAction } from "@/app/(app)/matches/actions";

type SelectionRow = {
  playerId: string;
  playerName: string;
  playerFirstName: string;
  playerLastName: string | null;
  coreTeamName: string;
  role: string;
  status: string;
  primaryPosition: string;
  secondaryPosition: string | null;
  absenceReason?: string | null;
};

type WarningRow = { id: string; code: string; severity: string; message: string };

type MatchFormatSnapshot = { numberOfPeriods: number; periodDurationMinutes: number; breakDurationMinutes: number };

export type MatchDetailShellProps = {
  surfaceState: MatchDetailSurfaceState;
  matchId: string;
  teamId: string;
  teamName: string;
  opponent: string;
  ownKitColor: string | null;
  presentation: MatchPresentation;
  lifecycleStatus: MatchLifecycleStatus;
  isCancelled: boolean;
  cancelledReason: string | null;
  isLive: boolean;
  canLiveReport: boolean;
  canFollowLive: boolean;
  venue: string;
  matchType: string;
  gameFormat: string;
  matchFit: string;
  dateLabel: string | null;
  kickoffTimeLabel: string | null;
  roundLabel: string | null;
  matchRoundId: string;
  matchRoundName: string;
  notes: string | null;
  selections: SelectionRow[];
  warnings: WarningRow[];
  /** Existence-only — the real lineup content now renders directly via `MatchTacticsPanel` on
   * Overview, which fetches its own data; this narrow flag only feeds the Match preparation
   * checklist's "Lineup set" item. */
  hasLineup: boolean;
  plannedRotation: PlannedRotationWithChanges | null;
  opponentTeamId: string | null;
  opponentHistory: OpponentHistoryData | null;
  opponentConcernCount: number;
  opponentLatestConcernDate: string | null;
  currentMatchStyleTags: string[];
  coachingIntent?: string;
  coachingIntentId?: string;
  matchFormatState?: {
    matchOverride: MatchFormatSnapshot | null;
    inheritedFormat: MatchFormatSnapshot | null;
    liveReportingStarted: boolean;
    frozenFormat: MatchFormatSnapshot | null;
  };
  /** Only present when `surfaceState === "AFTER"` — the bounded server read model
   * (`get-match-detail-after-data.ts`). */
  afterData?: MatchDetailAfterData;
  phaseStartDate?: Date;
  phaseEndDate?: Date;
  startsAt: Date;
  /** `null` when there is nothing for the Advisor to show (no connection, AI disabled, or no
   * useful persisted `lineup_review`/`match_prep` review); only rendered on the BEFORE-match
   * Overview tab. */
  advisorViewModel: PlannedMatchAdvisorViewModel | null;
};

/**
 * MatchDetailShell — the lifecycle orchestrator that replaces the former monolithic
 * `match-detail.tsx` (`08_COMPONENT_AND_ROUTE_ARCHITECTURE.md`). Reads `?tab=`, resolves it
 * against the current surface's real tab set, and renders shared header/action grammar plus the
 * correct leaf content. No business-rule duplication — every lifecycle/report fact arrives
 * already computed from the server.
 */
export function MatchDetailShell(props: MatchDetailShellProps) {
  const {
    surfaceState,
    matchId,
    teamId,
    teamName,
    opponent,
    ownKitColor,
    presentation,
    lifecycleStatus,
    isCancelled,
    cancelledReason,
    isLive,
    canLiveReport,
    canFollowLive,
    venue,
    matchType,
    gameFormat,
    matchFit,
    dateLabel,
    kickoffTimeLabel,
    roundLabel,
    matchRoundId,
    matchRoundName,
    notes,
    selections,
    warnings,
    hasLineup,
    plannedRotation,
    opponentTeamId,
    opponentHistory,
    opponentConcernCount,
    opponentLatestConcernDate,
    currentMatchStyleTags,
    coachingIntent,
    coachingIntentId,
    matchFormatState,
    afterData,
    phaseStartDate,
    phaseEndDate,
    startsAt,
    advisorViewModel,
  } = props;

  const orgUrl = useOrgUrl();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const tabs = getMatchDetailTabs(surfaceState);
  const activeTab = resolveMatchDetailTab(surfaceState, searchParams.get("tab"));

  function selectTab(tab: MatchDetailTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function tabHref(tab: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    return `?${params.toString()}`;
  }

  function handleCancel() {
    startTransition(async () => {
      await cancelMatchAction(matchId, cancelReason || undefined);
      router.refresh();
      setShowCancelDialog(false);
    });
  }

  function handleReopen() {
    if (!confirm("Reopen this match? It will be restored to scheduled status and will require normal post-match reporting.")) return;
    startTransition(async () => {
      await reopenMatchAction(matchId);
      router.refresh();
    });
  }

  const metaLine = buildMatchMetaLine({ dateLabel, kickoffTimeLabel, venue, matchType, gameFormat, roundLabel });
  const title = `${teamName} vs ${opponent}`;

  const blockingWarnings = warnings.filter((w) => w.severity === "HARD_BLOCK");
  const requiresOverrideWarnings = warnings.filter((w) => w.severity === "REQUIRES_OVERRIDE");

  const primaryAction =
    surfaceState === "BEFORE" && canLiveReport ? (
      <TouchlineButton
        as={Link}
        href={orgUrl(`/matches/${matchId}/live`)}
        variant="primary"
        size="sm"
        leadingIcon={<Radio className="h-3.5 w-3.5" aria-hidden="true" />}
      >
        {isLive ? "Open live reporting" : "Start live reporting"}
      </TouchlineButton>
    ) : undefined;

  const overflowAction = (
    <div className="flex items-center gap-2">
      {isLive && canFollowLive && (
        <TouchlineButton
          as={Link}
          href={orgUrl(`/matches/${matchId}/live/follow`)}
          variant="ghost"
          size="sm"
          leadingIcon={<Tv className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          Follow live
        </TouchlineButton>
      )}
      <TouchlineButton as={Link} href={orgUrl(`/matches/${matchId}/review`)} variant="ghost" size="sm">
        Review
      </TouchlineButton>
    </div>
  );

  return (
    <div className="touchline flex flex-col gap-5">
      <MatchDetailHeader
        breadcrumbLabel="Matches"
        breadcrumbHref={orgUrl("/fixtures")}
        title={title}
        lifecycleStatus={lifecycleStatus}
        metaLine={metaLine}
        primaryAction={primaryAction}
        overflowAction={overflowAction}
      />

      {isCancelled && (
        <DecisionBanner
          variant="blocked"
          title="Match cancelled"
          description={
            cancelledReason
              ? `This match was cancelled and will not require post-match reporting. Planned squad is kept for reference but will not count as played. Reason: ${cancelledReason}`
              : "This match was cancelled and will not require post-match reporting. Planned squad is kept for reference but will not count as played."
          }
          action={
            <TouchlineButton variant="secondary" size="sm" onClick={handleReopen} disabled={isPending}>
              {isPending ? "Reopening…" : "Reopen match"}
            </TouchlineButton>
          }
        />
      )}

      {(blockingWarnings.length > 0 || requiresOverrideWarnings.length > 0) && (
        <div className="flex flex-col gap-2">
          {[...blockingWarnings, ...requiresOverrideWarnings].map((w) => (
            <DecisionBanner
              key={w.id}
              variant={w.severity === "HARD_BLOCK" ? "blocked" : "decision"}
              title={formatWarningCode(w.code)}
              description={w.message}
            />
          ))}
        </div>
      )}

      <TabRail items={tabs} activeKey={activeTab} variant="pill" ariaLabel="Match sections" onSelect={selectTab} />

      {surfaceState === "BEFORE" ? (
        <BeforeMatchTabContent
          activeTab={activeTab}
          orgUrl={orgUrl}
          matchId={matchId}
          teamId={teamId}
          teamName={teamName}
          gameFormat={gameFormat}
          presentation={presentation}
          ownKitColor={ownKitColor}
          venue={venue}
          matchType={matchType}
          matchFit={matchFit}
          selections={selections}
          hasLineup={hasLineup}
          notes={notes}
          plannedRotation={plannedRotation}
          opponentTeamId={opponentTeamId}
          opponentHistory={opponentHistory}
          opponentConcernCount={opponentConcernCount}
          opponentLatestConcernDate={opponentLatestConcernDate}
          currentMatchStyleTags={currentMatchStyleTags}
          coachingIntent={coachingIntent}
          coachingIntentId={coachingIntentId}
          matchFormatState={matchFormatState}
          tabHref={tabHref}
          matchRoundId={matchRoundId}
          matchRoundName={matchRoundName}
          startsAt={startsAt}
          phaseStartDate={phaseStartDate ?? startsAt}
          phaseEndDate={phaseEndDate ?? startsAt}
          isCancelled={isCancelled}
          showCancelDialog={showCancelDialog}
          setShowCancelDialog={setShowCancelDialog}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          handleCancel={handleCancel}
          isPending={isPending}
          advisorViewModel={advisorViewModel}
        />
      ) : (
        afterData && (
          <AfterMatchTabContent
            activeTab={activeTab}
            orgUrl={orgUrl}
            matchId={matchId}
            teamId={teamId}
            teamName={teamName}
            gameFormat={gameFormat}
            presentation={presentation}
            ownKitColor={ownKitColor}
            opponent={opponent}
            matchFit={matchFit}
            selections={selections}
            afterData={afterData}
            opponentTeamId={opponentTeamId}
            opponentHistory={opponentHistory}
            opponentConcernCount={opponentConcernCount}
            opponentLatestConcernDate={opponentLatestConcernDate}
            currentMatchStyleTags={currentMatchStyleTags}
            tabHref={tabHref}
            postMatchHref={orgUrl(`/matches/${matchId}/post-match`)}
          />
        )
      )}
    </div>
  );
}

function BeforeMatchTabContent(props: {
  activeTab: MatchDetailTabKey;
  orgUrl: (path: string) => string;
  matchId: string;
  teamId: string;
  teamName: string;
  gameFormat: string;
  presentation: MatchPresentation;
  ownKitColor: string | null;
  venue: string;
  matchType: string;
  matchFit: string;
  selections: SelectionRow[];
  hasLineup: boolean;
  notes: string | null;
  plannedRotation: PlannedRotationWithChanges | null;
  opponentTeamId: string | null;
  opponentHistory: OpponentHistoryData | null;
  opponentConcernCount: number;
  opponentLatestConcernDate: string | null;
  currentMatchStyleTags: string[];
  coachingIntent?: string;
  coachingIntentId?: string;
  matchFormatState?: MatchDetailShellProps["matchFormatState"];
  tabHref: (tab: string) => string;
  matchRoundId: string;
  matchRoundName: string;
  startsAt: Date;
  phaseStartDate: Date;
  phaseEndDate: Date;
  isCancelled: boolean;
  showCancelDialog: boolean;
  setShowCancelDialog: (v: boolean) => void;
  cancelReason: string;
  setCancelReason: (v: string) => void;
  handleCancel: () => void;
  isPending: boolean;
  advisorViewModel: PlannedMatchAdvisorViewModel | null;
}) {
  const { activeTab } = props;

  const preparationInput = {
    squadSelectedCount: props.selections.filter((s) => s.role !== "HELPER").length,
    squadTarget: props.selections.filter((s) => s.role !== "HELPER").length || 1,
    hasLineup: props.hasLineup,
    hasPlannedRotation: Boolean(props.plannedRotation && props.plannedRotation.changes.length > 0),
  };

  if (activeTab === "overview") {
    return (
      <BeforeMatchOverview
        presentation={props.presentation}
        ownKitColor={props.ownKitColor}
        preparationInput={preparationInput}
        venue={props.venue}
        matchType={props.matchType}
        gameFormat={props.gameFormat}
        matchFit={props.matchFit}
        matchId={props.matchId}
        teamId={props.teamId}
        teamName={props.teamName}
        selections={props.selections}
        planningEditable={!props.isCancelled}
        coachingIntent={props.coachingIntent}
        coachingIntentId={props.coachingIntentId}
        matchFormatState={props.matchFormatState}
        notes={props.notes}
        rotationChangeCount={props.plannedRotation?.changes.length ?? 0}
        opponentEncounterCount={props.opponentHistory?.totalPlayed ?? 0}
        opponentHasProfile={props.opponentTeamId != null}
        tabHref={props.tabHref}
        advisorViewModel={props.advisorViewModel}
      />
    );
  }

  if (activeTab === "rotations") {
    return (
      <PlannedRotationPanel
        matchId={props.matchId}
        teamId={props.teamId}
        rotation={props.plannedRotation ?? null}
        squadPlayers={props.selections.map((s) => ({
          id: s.playerId,
          firstName: s.playerFirstName,
          lastName: s.playerLastName,
          primaryPosition: s.primaryPosition,
        }))}
        readOnly={props.isCancelled}
      />
    );
  }

  if (activeTab === "opponent-context") {
    return (
      <MatchOpponentContextPanel
        opponentTeamId={props.opponentTeamId}
        opponentHistory={props.opponentHistory}
        opponentConcernCount={props.opponentConcernCount}
        opponentLatestConcernDate={props.opponentLatestConcernDate}
        currentMatchStyleTags={props.currentMatchStyleTags}
        opponentDetailHref={props.orgUrl(`/opponents/${props.opponentTeamId}`)}
      />
    );
  }

  // "notes"
  return (
    <div className="flex flex-col gap-4">
      <MatchNotesTab matchId={props.matchId} notes={props.notes} />

      {!props.isCancelled && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MatchHelpersPanel matchId={props.matchId} />
          <LeagueMatchGuestsPanel matchId={props.matchId} />
        </div>
      )}

      <Surface padding="md">
        <SectionHeader title="Match administration" description="Change kickoff, or cancel this match." />
        <div className="mt-3 flex flex-col gap-3">
          <MatchEditForm
            matchId={props.matchId}
            startsAt={props.startsAt}
            matchRoundName={props.matchRoundName}
            phaseStartDate={props.phaseStartDate}
            phaseEndDate={props.phaseEndDate}
          />
          {!props.isCancelled &&
            (props.showCancelDialog ? (
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="Cancellation reason (optional)"
                  value={props.cancelReason}
                  onChange={(e) => props.setCancelReason(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <TouchlineButton variant="danger" size="sm" onClick={props.handleCancel} disabled={props.isPending}>
                    {props.isPending ? "Cancelling…" : "Confirm cancellation"}
                  </TouchlineButton>
                  <TouchlineButton variant="ghost" size="sm" onClick={() => props.setShowCancelDialog(false)}>
                    Cancel
                  </TouchlineButton>
                </div>
              </div>
            ) : (
              <TouchlineButton variant="ghost" size="sm" className="self-start text-[var(--danger)]" onClick={() => props.setShowCancelDialog(true)}>
                Mark as cancelled
              </TouchlineButton>
            ))}
        </div>
      </Surface>
    </div>
  );
}

function AfterMatchTabContent(props: {
  activeTab: MatchDetailTabKey;
  orgUrl: (path: string) => string;
  matchId: string;
  teamId: string;
  teamName: string;
  gameFormat: string;
  presentation: MatchPresentation;
  ownKitColor: string | null;
  opponent: string;
  matchFit: string;
  selections: SelectionRow[];
  afterData: MatchDetailAfterData;
  opponentTeamId: string | null;
  opponentHistory: OpponentHistoryData | null;
  opponentConcernCount: number;
  opponentLatestConcernDate: string | null;
  currentMatchStyleTags: string[];
  tabHref: (tab: string) => string;
  postMatchHref: string;
}) {
  const { activeTab } = props;

  if (activeTab === "overview") {
    return (
      <AfterMatchOverview
        presentation={props.presentation}
        ownKitColor={props.ownKitColor}
        data={props.afterData}
        ownTeamName={props.teamName}
        opponentName={props.opponent}
        matchFit={props.matchFit}
        matchId={props.matchId}
        teamId={props.teamId}
        gameFormat={props.gameFormat}
        selections={props.selections}
        tabHref={props.tabHref}
        postMatchHref={props.postMatchHref}
      />
    );
  }

  if (activeTab === "events") {
    return <MatchEventsPanel timeline={props.afterData.timeline} ownTeamName={props.teamName} opponentName={props.opponent} />;
  }

  if (activeTab === "stats") {
    return <MatchStatsPanel data={props.afterData} />;
  }

  if (activeTab === "tactics") {
    return (
      <MatchTacticsPanel
        matchId={props.matchId}
        teamId={props.teamId}
        teamName={props.teamName}
        gameFormat={props.gameFormat}
        planningEditable={false}
        selections={props.selections}
      />
    );
  }

  if (activeTab === "after-match") {
    return <MatchAfterMatchPanel matchId={props.matchId} data={props.afterData} />;
  }

  if (activeTab === "opponent-context") {
    return (
      <MatchOpponentContextPanel
        opponentTeamId={props.opponentTeamId}
        opponentHistory={props.opponentHistory}
        opponentConcernCount={props.opponentConcernCount}
        opponentLatestConcernDate={props.opponentLatestConcernDate}
        currentMatchStyleTags={props.currentMatchStyleTags}
        opponentDetailHref={props.orgUrl(`/opponents/${props.opponentTeamId}`)}
      />
    );
  }

  // "history"
  return (
    <MatchHistoryPanel
      opponentTeamId={props.opponentTeamId}
      opponentHistory={props.opponentHistory}
      opponentConcernCount={props.opponentConcernCount}
      opponentLatestConcernDate={props.opponentLatestConcernDate}
    />
  );
}
