import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { SeasonOverviewClient } from "@/app/(app)/season/season-client";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";
import { SeasonFinalizeControls } from "@/app/(app)/season/season-finalize-controls";

export const dynamic = "force-dynamic";

const READINESS_LABELS: Record<string, string> = {
  EFFORT_TREND: "Effort trend falling",
  ATTENDANCE_RELIABILITY: "Low attendance reliability",
  LEARNING_BEHAVIOR: "Needs attention in learning behavior",
  TEAM_FIRST_BEHAVIOR: "Needs attention in team-first behavior",
  RESET_AFTER_ERROR_RELIABILITY: "Needs attention in reset-after-error reliability",
  COACH_TRUST: "Low coach trust",
};

export default async function SeasonPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<{ created?: string }> }) {
  const { orgSlug } = await params;
  const { created } = await searchParams;
  const ctx = await requireActorContext(orgSlug);
  const orgWhere = ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {};

  const leagueSeasons = await db.leagueSeason.findMany({
    where: orgWhere,
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true, status: true, finalizedAt: true, finalizedBy: true },
  });

  const activeLeagueSeason = leagueSeasons[0] ?? null;

  const leagueSeasonIntent = activeLeagueSeason
    ? await db.coachingIntent.findFirst({
        where: { scopeType: "LEAGUE_SEASON", scopeId: activeLeagueSeason.id, ...orgWhere },
        select: { id: true, category: true },
      })
    : null;

  const readinessWarnings = await db.playerReadinessSignal.findMany({
    where: { value: { in: ["FALLING", "LOW", "NEEDS_ATTENTION"] }, ...orgWhere },
    select: {
      playerId: true,
      signalType: true,
      value: true,
    },
  });

  const readinessPlayerIds = [...new Set(readinessWarnings.map((rw) => rw.playerId))];

  const readinessPlayers = readinessPlayerIds.length > 0
    ? await db.player.findMany({
        where: { id: { in: readinessPlayerIds }, ...orgWhere },
        select: { id: true, firstName: true, lastName: true, coreTeam: { select: { id: true, name: true } } },
      })
    : [];

  const playerMap = new Map(readinessPlayers.map((p) => [p.id, p]));

  const readinessWarningData = readinessWarnings.map((rw) => {
    const player = playerMap.get(rw.playerId);
    return {
      playerId: rw.playerId,
      playerName: player ? `${player.firstName} ${player.lastName ?? ""}`.trim() : rw.playerId,
      teamName: player?.coreTeam?.name ?? "Unassigned",
      signalType: rw.signalType,
      value: rw.value,
      label: READINESS_LABELS[rw.signalType] ?? rw.signalType,
    };
  });

  return (
    <div className="flex flex-col gap-3">
      {created && (
        <div className="rounded-md border border-emerald-700/40 bg-emerald-950/20 px-3 py-2 text-xs font-medium text-emerald-300">
          League season created.
        </div>
      )}
      {!activeLeagueSeason && (
        <a
          href={`/o/${orgSlug}/season/new`}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-2.5 py-1 text-xs font-medium text-zinc-100 hover:bg-[var(--accent)]/20 transition-colors"
        >
          Create league season
        </a>
      )}
      {activeLeagueSeason && (
        <SeasonFinalizeControls
          leagueSeasonId={activeLeagueSeason.id}
          leagueSeasonName={activeLeagueSeason.name}
          status={activeLeagueSeason.status}
          finalizedAt={activeLeagueSeason.finalizedAt}
          finalizedBy={activeLeagueSeason.finalizedBy}
        />
      )}
      {activeLeagueSeason && (
        <CoachingIntentSelector
          scopeType="LEAGUE_SEASON"
          scopeId={activeLeagueSeason.id}
          currentIntent={leagueSeasonIntent?.category ?? undefined}
          currentIntentId={leagueSeasonIntent?.id ?? undefined}
          label="League season intent"
        />
      )}
      {readinessWarningData.length > 0 && (
        <div className="rounded-2xl border border-amber-700/30 bg-amber-900/10 px-4 py-3">
          <p className="text-xs font-medium text-amber-200">Readiness signals requiring attention</p>
          <div className="mt-2 flex flex-col gap-1">
            {readinessWarningData.map((rw, i) => (
              <a key={i} href={`/o/${orgSlug}/players/${rw.playerId}#readiness`} className="text-[11px] text-amber-300/70 hover:text-amber-200 transition-colors">
                {rw.playerName} <span className="text-zinc-500">·</span> {rw.teamName} <span className="text-zinc-500">·</span> {rw.label}
              </a>
            ))}
          </div>
        </div>
      )}
      <SeasonOverviewClient
        leagueSeasons={leagueSeasons.map((ls) => ({
          id: ls.id,
          name: ls.name,
          startDate: ls.startDate,
          endDate: ls.endDate,
          status: ls.status,
          finalizedAt: ls.finalizedAt,
        }))}
        activeLeagueSeasonId={activeLeagueSeason?.id ?? null}
      />
    </div>
  );
}