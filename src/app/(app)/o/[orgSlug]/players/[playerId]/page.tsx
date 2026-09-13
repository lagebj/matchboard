import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getPlayerAllTimeStats } from "@/lib/selection/effective-participation";
import { getPlayerRecentOpportunity } from "@/lib/players/get-player-recent-opportunity";
import { getPlayerMatchHistory } from "@/lib/players/get-player-match-history";
import { getEffectivePlayerPositionProfileForPlayer } from "@/lib/player-development/get-effective-position-profile";
import { availabilityOptions, preferredFootOptions, secondaryFootOptions, bestSideOptions, goalkeeperAbilityOptions } from "@/lib/player-form-options";
import { playerPositionOptions, optionalPlayerPositionOptions } from "@/lib/player-form-options";
import { formatPlayerName } from "@/lib/player-metrics";

import { TabRail, type TabItem } from "@/components/ui/tab-rail";
import { PlayerIdentityHeaderClient } from "@/components/players/player-identity-header-client";
import { PlayerParticipationStrip } from "@/components/touchline/player/player-participation-strip";
import { PlayerPositionMapWidget } from "@/components/touchline/player/player-position-map-widget";
import { PlayerDevelopmentFocus } from "@/components/touchline/player/player-development-focus";
import { PlayerObservationStory } from "@/components/touchline/player/player-observation-story";
import { PlayerRecentFootball } from "@/components/touchline/player/player-recent-football";
import { PlayerMatchTimeline } from "@/components/touchline/player/player-match-timeline";
import { PlayerPositionTimeline } from "@/components/touchline/player/player-position-timeline";
import { PlayerDevelopmentTimeline } from "@/components/touchline/player/player-development-timeline";
import { OpportunityWidget } from "@/components/touchline/widgets/opportunity-widget";
import { EvidenceStory } from "@/components/touchline/evidence/evidence-story";
import { Sparkline } from "@/components/touchline/viz/sparkline";
import { StackedDistribution } from "@/components/touchline/viz/stacked-distribution";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";

import { PlayerDetailsPanel } from "@/components/players/player-details-panel";
import { PlayerPositionProfile } from "@/components/players/player-position-profile";
import { PlayerAttributesPanel } from "@/components/players/player-attributes-panel";
import { PlayerAvailabilityPanel } from "@/components/players/player-availability-panel";
import { AssessmentHistoryPanel } from "@/components/players/player-assessment-history-panel";
import { CoachContextPanel as PlayerCoachContextPanel } from "@/components/players/player-coach-context-panel";
import { PlayerReadinessPanel } from "@/components/players/player-readiness-panel";
import { PlayerDevelopmentThreadsPanel } from "@/components/players/player-development-threads-panel";
import { PlayerQuickObservationsPanel } from "@/components/players/player-quick-observations-panel";
import { PlayerSquadContextPanel } from "@/components/players/player-squad-context-panel";
import { PlayerOutfieldRoleSuitabilityPanel } from "@/components/players/player-outfield-role-suitability-panel";
import { updatePlayerFieldAction } from "@/app/(app)/players/[playerId]/inline-actions";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

import { buildPlayerIdentityViewModel } from "@/lib/touchline/presentation/player-identity-view-model";
import {
  buildIdentityInput,
  buildOverviewInput,
  buildMatchesInput,
  buildDevelopmentInput,
  buildEvidenceStories,
} from "@/lib/touchline/presentation/player-detail-production-adapter";
import { buildPlayerOverviewViewModel } from "@/lib/touchline/presentation/player-overview-view-model";
import { buildPlayerMatchesViewModel } from "@/lib/touchline/presentation/player-matches-view-model";
import { buildPlayerEvidenceViewModel } from "@/lib/touchline/presentation/player-evidence-view-model";
import { TACTICAL_FUNCTION_LABELS } from "@/domain/team-composition/team-composition-types";
import { getPlayerOutfieldRoleSuitability } from "@/lib/players/get-player-outfield-role-suitability";

type PlayerPageProps = {
  params: Promise<{
    orgSlug: string;
    playerId: string;
  }>;
  searchParams: Promise<{
    tab?: string;
    error?: string;
    saved?: string;
  }>;
};

type TabKey = "overview" | "matches" | "development" | "evidence" | "manage";

const TAB_KEYS: readonly TabKey[] = ["overview", "matches", "development", "evidence", "manage"];

function resolveTab(value: string | undefined): TabKey {
  return TAB_KEYS.includes((value ?? "overview") as TabKey) ? ((value ?? "overview") as TabKey) : "overview";
}

function formatSavedMessage(saved?: string): string | null {
  if (saved === "updated") return "Player updated.";
  if (saved === "status") return "Player status updated.";
  if (saved === "restored") return "Player restored.";
  return null;
}

/** Per-tab data loading (contract §8): only the active tab's expensive queries run. */
export default async function PlayerPage({ params, searchParams }: PlayerPageProps) {
  const [{ orgSlug, playerId }, query] = await Promise.all([params, searchParams]);
  const activeTab = resolveTab(query.tab);

  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;
  const orgFilter = ctx.orgFilter;

  const player = await db.player.findFirst({
    where: { id: playerId, ...orgWhere },
    include: { coreTeam: { include: { group: { select: { id: true, name: true, slug: true } } } } },
  });
  if (!player) notFound();

  const groupLabel = player.coreTeam?.group ? `${player.coreTeam.group.name}` : null;

  // Identity always loads with the shell (contract §8) — the effective position profile is
  // the one position model the identity header and the position map both consume.
  const profile = await getEffectivePlayerPositionProfileForPlayer(playerId, orgFilter);

  const identity = buildPlayerIdentityViewModel(
    buildIdentityInput(
      {
        playerId: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        shirtNumber: player.shirtNumber,
        currentAvailability: player.currentAvailability,
        coreTeamName: player.coreTeam?.name ?? null,
        coreTeamKitColor: player.coreTeam?.kitColor ?? null,
        groupLabel,
      },
      profile,
    ),
  );

  // Record-to-record prev/next (feature file: "Record-to-record navigation").
  const orderedPlayerIds = await db.player.findMany({
    where: { removedAt: null, ...orgWhere },
    select: { id: true },
    orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }, { lastName: "asc" }, { playerCode: "asc" }],
  });
  const orderedIds = orderedPlayerIds.map((entry) => entry.id);
  const currentPlayerIndex = orderedIds.indexOf(player.id);
  const previousPlayerId = currentPlayerIndex > 0 ? orderedIds[currentPlayerIndex - 1] : null;
  const nextPlayerId =
    currentPlayerIndex >= 0 && currentPlayerIndex < orderedIds.length - 1 ? orderedIds[currentPlayerIndex + 1] : null;

  const savedMessage = formatSavedMessage(query.saved);

  const tabs: TabItem<TabKey>[] = [
    { key: "overview", label: "Overview", href: `/o/${orgSlug}/players/${playerId}?tab=overview` },
    { key: "matches", label: "Matches", href: `/o/${orgSlug}/players/${playerId}?tab=matches` },
    { key: "development", label: "Development", href: `/o/${orgSlug}/players/${playerId}?tab=development` },
    { key: "evidence", label: "Evidence", href: `/o/${orgSlug}/players/${playerId}?tab=evidence` },
    { key: "manage", label: "Manage", href: `/o/${orgSlug}/players/${playerId}?tab=manage` },
  ];

  return (
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134 Phase 8).
    <div className="touchline mx-auto flex max-w-[520px] flex-col gap-6 px-4 py-6 medium:max-w-[720px] large:max-w-[820px]">
      {query.error ? (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] px-3 py-2 text-xs text-[var(--danger)]">
          {query.error}
        </div>
      ) : null}
      {savedMessage ? (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--success-subtle)] px-3 py-2 text-xs text-[var(--success)]">
          {savedMessage}
        </div>
      ) : null}

      <PlayerIdentityHeaderClient
        identity={identity}
        playerId={player.id}
        playerActive={player.active}
        playerRemoved={player.removedAt != null}
        playerDisplayName={formatPlayerName(player)}
        previousPlayerId={previousPlayerId}
        nextPlayerId={nextPlayerId}
        backHref={`/o/${orgSlug}/players`}
      />

      <TabRail items={tabs} activeKey={activeTab} ariaLabel="Player detail tabs" />

      {activeTab === "overview" ? <OverviewTab playerId={playerId} orgSlug={orgSlug} orgFilter={orgFilter} profile={profile} /> : null}
      {activeTab === "matches" ? <MatchesTab playerId={playerId} orgSlug={orgSlug} orgFilter={orgFilter} /> : null}
      {activeTab === "development" ? <DevelopmentTab playerId={playerId} orgFilter={orgFilter} /> : null}
      {activeTab === "evidence" ? <EvidenceTab playerId={playerId} orgSlug={orgSlug} orgFilter={orgFilter} profile={profile} /> : null}
      {activeTab === "manage" ? (
        <ManageTab player={player} orgFilter={orgFilter} updateFieldAction={updatePlayerFieldAction} />
      ) : null}
    </div>
  );
}

type OrgFilter = Awaited<ReturnType<typeof requirePageActorContext>>["orgFilter"];
type PositionProfile = Awaited<ReturnType<typeof getEffectivePlayerPositionProfileForPlayer>>;
/** The player row shape the page's own query returns (with core team + group). */
type PlayerRecord = NonNullable<
  Awaited<ReturnType<typeof db.player.findFirst<{ include: { coreTeam: { include: { group: { select: { id: true, name: true, slug: true } } } } } }>>>
>;

/**
 * Each tab component is rendered by React as its own async Server Component — it does NOT run
 * inside the page component's continuation, so the tenant ALS context the page sets does not
 * flow into it (AGENTS.md's `setTenantOrganisationId()` propagation rule; the exact failure
 * this guards against is the fail-closed `TenantContextError` on the tab's own direct queries).
 * Each tab therefore re-establishes tenant scope from the page's already-trusted resolved org
 * id before its first query — the same per-entry-point discipline every server action follows.
 */
function establishTabTenantContext(orgFilter: OrgFilter) {
  if (orgFilter.type === "org") {
    setTenantOrganisationId(orgFilter.organisationId);
  }
}

async function OverviewTab({
  playerId,
  orgSlug,
  orgFilter,
  profile,
}: {
  playerId: string;
  orgSlug: string;
  orgFilter: OrgFilter;
  profile: PositionProfile;
}) {
  establishTabTenantContext(orgFilter);
  const [seasonStats, recentOpportunity, matchHistory, developmentThreads, latestObservationRow] = await Promise.all([
    getPlayerAllTimeStats(playerId),
    getPlayerRecentOpportunity(playerId),
    getPlayerMatchHistory(playerId, orgFilter),
    db.developmentThread.findMany({
      where: { playerId, status: "ACTIVE", ...orgFilter.filter },
      select: { id: true, focus: true, category: true, startedAt: true },
      orderBy: { startedAt: "desc" },
      take: 1,
    }),
    loadLatestObservation(playerId, orgFilter),
  ]);

  const overview = buildOverviewInput({
    playerId,
    orgSlug,
    seasonStats,
    recentOpportunity,
    profile,
    activeFocus:
      developmentThreads.length > 0
        ? { id: developmentThreads[0].id, focus: developmentThreads[0].focus, category: developmentThreads[0].category }
        : null,
    latestObservation: latestObservationRow,
    matchHistory,
  });
  const vm = buildPlayerOverviewViewModel(overview);

  return (
    <div className="flex flex-col gap-4">
      <PlayerParticipationStrip {...vm.participation} scopeLabel="All time" />
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
        {vm.opportunity ? <OpportunityWidget {...vm.opportunity} /> : null}
        <PlayerPositionMapWidget positions={vm.effectivePositions} />
      </div>
      <PlayerObservationStory observation={vm.latestObservation} />
      <PlayerDevelopmentFocus focus={vm.activeDevelopmentFocus} />
      <PlayerRecentFootball matches={vm.recentMatches} viewAllHref={`/o/${orgSlug}/players/${playerId}?tab=matches`} />
    </div>
  );
}

/** The latest authored observation across the canonical observation surfaces (contract §4 "Latest observation / review"). */
async function loadLatestObservation(playerId: string, orgFilter: OrgFilter) {
  const [devObservation, threadObservation] = await Promise.all([
    db.playerDevelopmentObservation.findFirst({
      where: { playerId, ...orgFilter.filterNullable, observableNote: { not: null } },
      select: { id: true, observableNote: true, createdAt: true, observedAt: true, kind: true },
      orderBy: { observedAt: "desc" },
    }),
    db.developmentThreadObservation.findFirst({
      where: { thread: { playerId, ...orgFilter.filter } },
      select: { id: true, evidence: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (devObservation?.observableNote) {
    return {
      id: devObservation.id,
      note: devObservation.observableNote,
      createdAt: devObservation.observedAt,
      sourceLabel: "Football observation",
      themes: [] as string[],
    };
  }
  if (threadObservation) {
    return {
      id: threadObservation.id,
      note: threadObservation.evidence,
      createdAt: threadObservation.createdAt,
      sourceLabel: "Development thread",
      themes: [] as string[],
    };
  }
  return null;
}

async function MatchesTab({
  playerId,
  orgSlug,
  orgFilter,
}: {
  playerId: string;
  orgSlug: string;
  orgFilter: OrgFilter;
}) {
  establishTabTenantContext(orgFilter);
  const [seasonStats, matchHistory] = await Promise.all([
    getPlayerAllTimeStats(playerId),
    getPlayerMatchHistory(playerId, orgFilter),
  ]);
  const vm = buildPlayerMatchesViewModel(
    buildMatchesInput({ orgSlug, seasonStats, matchHistory }),
  );

  return (
    <div className="flex flex-col gap-4">
      <PlayerParticipationStrip {...vm.seasonSummary} scopeLabel="All time" />
      <PlayerPositionTimeline entries={vm.positionTimeline} />
      <PlayerMatchTimeline matches={vm.matches} />
    </div>
  );
}

async function DevelopmentTab({
  playerId,
  orgFilter,
}: {
  playerId: string;
  orgFilter: OrgFilter;
}) {
  establishTabTenantContext(orgFilter);
  const threads = await db.developmentThread.findMany({
    where: { playerId, ...orgFilter.filter },
    select: {
      id: true,
      focus: true,
      category: true,
      rationale: true,
      status: true,
      startedAt: true,
      completedAt: true,
      observations: { select: { id: true, evidence: true, createdAt: true, matchId: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { startedAt: "desc" },
  });

  const activeThread = threads.find((t) => t.status === "ACTIVE") ?? null;
  const pendingReview = activeThread
    ? await db.decisionReview.findFirst({
        where: { targetType: "DEVELOPMENT_THREAD", targetId: activeThread.id, ...orgFilter.filterNullable, status: "PENDING" },
        select: { dueAt: true },
        orderBy: { dueAt: "asc" },
      })
    : null;

  const observations = threads
    .flatMap((t) =>
      t.observations.map((o) => ({
        id: o.id,
        note: o.evidence,
        createdAt: o.createdAt,
        matchId: o.matchId,
        threadFocus: t.focus,
      })),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const matchIds = [...new Set(threads.flatMap((t) => t.observations.map((o) => o.matchId)).filter((m): m is string => m != null))];
  const matches =
    matchIds.length > 0
      ? await db.match.findMany({ where: { id: { in: matchIds }, ...orgFilter.filter }, select: { id: true, opponent: true } })
      : [];
  const opponentById = new Map(matches.map((m) => [m.id, m.opponent]));

  const vm = buildDevelopmentInput({
    playerId,
    activeThread: activeThread
      ? {
          id: activeThread.id,
          focus: activeThread.focus,
          category: activeThread.category,
          rationale: activeThread.rationale,
          startedAt: activeThread.startedAt,
          reviewState: pendingReview ? "PENDING" : null,
          reviewDueAt: pendingReview?.dueAt ?? null,
          observationCount: activeThread.observations.length,
        }
      : null,
    observations: observations.map((o) => ({
      id: o.id,
      note: o.note,
      createdAt: o.createdAt,
      matchLabel: o.matchId ? (opponentById.get(o.matchId) ?? null) : null,
    })),
    completedFocusHistory: threads
      .filter((t) => t.status === "COMPLETED" && t.completedAt)
      .map((t) => ({
        id: t.id,
        focus: t.focus,
        category: t.category,
        startedAt: t.startedAt,
        completedAt: t.completedAt!,
      })),
  });

  return (
    <div className="flex flex-col gap-4">
      <TouchlineWidget>
        <WidgetHeader eyebrow="Development focus" title={vm.activeFocus ? vm.activeFocus.focus : "No active focus"} />
        {vm.activeFocus ? (
          <div className="mt-2 flex flex-col gap-1 text-[13px] text-[var(--text-soft)]">
            {vm.activeFocus.rationale ? <p>{vm.activeFocus.rationale}</p> : null}
            <p className="text-[12px] text-[var(--text-muted)]">
              Started {vm.activeFocus.startedAt} · {vm.activeFocus.observationCount} observations
              {vm.activeFocus.reviewDueAt ? ` · Review due ${vm.activeFocus.reviewDueAt}` : ""}
            </p>
          </div>
        ) : null}
      </TouchlineWidget>
      <PlayerDevelopmentTimeline observations={vm.observationTimeline} completedFocusHistory={vm.completedFocusHistory} />
    </div>
  );
}

async function EvidenceTab({
  playerId,
  orgSlug,
  orgFilter,
  profile,
}: {
  playerId: string;
  orgSlug: string;
  orgFilter: OrgFilter;
  profile: PositionProfile;
}) {
  establishTabTenantContext(orgFilter);
  const [seasonStats, recentOpportunity, matchHistory] = await Promise.all([
    getPlayerAllTimeStats(playerId),
    getPlayerRecentOpportunity(playerId),
    getPlayerMatchHistory(playerId, orgFilter),
  ]);

  const vm = buildPlayerEvidenceViewModel({
    stories: buildEvidenceStories({ playerId, orgSlug, seasonStats, recentOpportunity, profile, matchHistory }),
  });

  return (
    <div className="flex flex-col gap-4">
      {(["OPPORTUNITY", "POSITION", "MATCH_CONTEXT"] as const).map((group) => {
        const stories = vm.storiesByGroup[group];
        if (stories.length === 0) return null;
        return (
          <div key={group} className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {group === "OPPORTUNITY" ? "Opportunity" : group === "POSITION" ? "Position" : "Match context"}
            </p>
            {stories.map((s) => (
              <EvidenceStory
                key={s.id}
                question={s.question}
                label={group === "OPPORTUNITY" ? "Opportunity" : group === "POSITION" ? "Position" : "Match context"}
                title={s.title}
                value={s.value}
                valueCaption={s.valueCaption}
                sample={s.sample}
                confidence={s.confidence}
                interpretation={s.interpretation}
                detailHref={s.detailHref}
                visual={
                  s.sparkline ? (
                    <Sparkline question={s.question} values={s.sparkline} periodLabels={s.sparklineLabels ?? []} />
                  ) : s.positionShares ? (
                    <StackedDistribution
                      question={s.question}
                      segments={s.positionShares.map((p) => ({ label: p.code, value: p.sharePercent }))}
                    />
                  ) : undefined
                }
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

async function ManageTab({
  player,
  orgFilter,
  updateFieldAction,
}: {
  player: PlayerRecord;
  orgFilter: OrgFilter;
  updateFieldAction: typeof updatePlayerFieldAction;
}) {
  establishTabTenantContext(orgFilter);
  const [teams, rotationPaths, movementCandidates, readinessSignals, outfieldRoleSuitability, developmentThreads] =
    await Promise.all([
      db.team.findMany({
        where: { archivedAt: null, ...orgFilter.filter },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.rotationPath.findMany({
        where: {
          OR: [{ fromTeamId: player.coreTeamId ?? "" }, { toTeamId: player.coreTeamId ?? "" }],
          fromTeam: { archivedAt: null },
          toTeam: { archivedAt: null },
          ...orgFilter.filter,
        },
        include: { fromTeam: { select: { id: true, name: true } }, toTeam: { select: { id: true, name: true } } },
        orderBy: [{ fromTeamId: "asc" }, { role: "asc" }],
      }),
      db.movementCandidate.findMany({
        where: { playerId: player.id, ...orgFilter.filter },
        include: { rotationPath: { include: { fromTeam: { select: { name: true } }, toTeam: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
      db.playerReadinessSignal.findMany({
        where: { playerId: player.id, ...orgFilter.filter },
        orderBy: { signalType: "asc" },
      }),
      getPlayerOutfieldRoleSuitability(player.id),
      db.developmentThread.findMany({
        where: { playerId: player.id, status: "ACTIVE", ...orgFilter.filter },
        include: { observations: { orderBy: { createdAt: "asc" } } },
        orderBy: [{ startedAt: "desc" }],
      }),
    ]);

  const openQuickObservations = await db.quickObservation.findMany({
    where: { status: "OPEN", ...orgFilter.filter },
    orderBy: { createdAt: "desc" },
  });
  // `playerIds` is a Json column — array-membership filtering happens in memory (the org's open
  // inbox is small), matching the pre-migration page's own approach.
  const quickObservations = openQuickObservations.filter(
    (o) => Array.isArray(o.playerIds) && (o.playerIds as string[]).includes(player.id),
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-[var(--text-muted)]">
        Editable administrative record. The other tabs stay read-only dashboards.
      </p>
      <PlayerDetailsPanel
        player={player}
        teams={teams}
        footOptions={preferredFootOptions}
        secondaryFootOptions={secondaryFootOptions}
        bestSideOptions={bestSideOptions}
        goalkeeperAbilityOptions={goalkeeperAbilityOptions}
        updateFieldAction={updateFieldAction}
      />
      <PlayerPositionProfile
        player={player}
        positionOptions={playerPositionOptions}
        optionalPositionOptions={optionalPlayerPositionOptions}
        updateFieldAction={updateFieldAction}
      />
      <PlayerAvailabilityPanel player={player} availabilityOptions={availabilityOptions} updateFieldAction={updateFieldAction} />
      <PlayerAttributesPanel player={player} updateFieldAction={updateFieldAction} />
      <PlayerCoachContextPanel player={player} updateFieldAction={updateFieldAction} />
      <PlayerReadinessPanel
        playerId={player.id}
        signals={readinessSignals.map((s) => ({ id: s.id, signalType: s.signalType, value: s.value, note: s.note }))}
      />
      <PlayerSquadContextPanel
        rotationPaths={rotationPaths.map((rp) => ({
          id: rp.id,
          fromTeamName: rp.fromTeam.name,
          toTeamName: rp.toTeam.name,
          role: rp.role,
          active: rp.active,
        }))}
        movementCandidates={movementCandidates.map((mc) => ({
          id: mc.id,
          rotationPathId: mc.rotationPathId,
          fromTeamName: mc.rotationPath.fromTeam.name,
          toTeamName: mc.rotationPath.toTeam.name,
          role: mc.role,
          status: mc.status,
          rationaleCategory: mc.rationaleCategory,
          rationaleNote: mc.rationaleNote,
        }))}
        coreTeamId={player.coreTeamId}
      />
      <PlayerDevelopmentThreadsPanel
        playerId={player.id}
        threads={developmentThreads.map((t) => ({
          id: t.id,
          playerId: t.playerId,
          focus: t.focus,
          rationale: t.rationale,
          status: t.status as "ACTIVE" | "COMPLETED" | "CLOSED",
          category: t.category as string | null,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          closedAt: t.closedAt,
          recordedBy: t.recordedBy,
          observations: t.observations.map((o) => ({
            id: o.id,
            threadId: o.threadId,
            matchId: o.matchId,
            evidence: o.evidence,
            context: o.context,
            recordedBy: o.recordedBy,
            createdAt: o.createdAt,
          })),
        }))}
      />
      <PlayerQuickObservationsPanel
        playerId={player.id}
        observations={quickObservations.map((o) => ({
          id: o.id,
          matchId: o.matchId,
          playerIds: o.playerIds as string[],
          note: o.note,
          status: o.status as "OPEN" | "CONVERTED" | "KEPT_AS_NOTE" | "DISCARDED",
          convertedToType: o.convertedToType,
          createdAt: o.createdAt,
        }))}
      />
      {outfieldRoleSuitability ? (
        <PlayerOutfieldRoleSuitabilityPanel
          outfieldRoles={outfieldRoleSuitability.outfieldRoles}
          tacticalFunctions={outfieldRoleSuitability.tacticalFunctions.map((f) => ({
            function: f.function,
            label: TACTICAL_FUNCTION_LABELS[f.function],
            tier: f.tier,
          }))}
          leagueSeasonLabel={outfieldRoleSuitability.leagueSeasonLabel}
        />
      ) : null}
      <AssessmentHistoryPanel playerId={player.id} />
    </div>
  );
}